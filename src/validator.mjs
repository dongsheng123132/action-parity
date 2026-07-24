import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const schemaUrl = new URL("../schema/action-parity.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8"));
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false
});
const validateSchema = ajv.compile(schema);

const MACHINE_SURFACE_KINDS = new Set(["cli", "mcp", "api", "ipc", "test"]);

function issue(severity, code, path, message) {
  return { severity, code, path, message };
}

function addSchemaIssues(issues) {
  for (const error of validateSchema.errors ?? []) {
    issues.push(
      issue(
        "error",
        "schema_validation",
        error.instancePath || "/",
        error.message ?? "Schema validation failed."
      )
    );
  }
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return duplicates;
}

export async function readManifest(path) {
  const text = await readFile(path, "utf8");
  return JSON.parse(text);
}

export function validateManifestObject(manifest) {
  const issues = [];
  const schemaValid = validateSchema(manifest);

  if (!schemaValid) {
    addSchemaIssues(issues);
    return buildReport(manifest, issues);
  }

  const surfaceById = new Map(manifest.surfaces.map((surface) => [surface.id, surface]));
  const actionById = new Map(manifest.actions.map((action) => [action.id, action]));
  const targetLevels = new Set(manifest.conformance_targets ?? []);
  const requiredSurfaces = manifest.surfaces.filter((surface) => surface.required_for_parity);

  for (const id of duplicateValues(manifest.surfaces.map((surface) => surface.id))) {
    issues.push(issue("error", "duplicate_surface_id", "/surfaces", `Duplicate Surface ID: ${id}`));
  }

  for (const id of duplicateValues(manifest.actions.map((action) => action.id))) {
    issues.push(issue("error", "duplicate_action_id", "/actions", `Duplicate Action ID: ${id}`));
  }

  if ((targetLevels.has("AP-2") || targetLevels.has("AP-3") || targetLevels.has("AP-4")) && requiredSurfaces.length === 0) {
    issues.push(
      issue(
        "error",
        "no_required_surface",
        "/surfaces",
        "AP-2 or higher requires at least one Surface with required_for_parity=true."
      )
    );
  }

  for (const [actionIndex, action] of manifest.actions.entries()) {
    const actionPath = `/actions/${actionIndex}`;
    const boundSurfaceIds = new Set();
    const exceptionSurfaceIds = new Set();

    if (!action.execution.headless) {
      issues.push(
        issue(
          "error",
          "action_not_headless",
          `${actionPath}/execution/headless`,
          `${action.id} is a business Action but is not headless.`
        )
      );
    }

    for (const [bindingIndex, binding] of action.bindings.entries()) {
      const bindingPath = `${actionPath}/bindings/${bindingIndex}`;
      const surface = surfaceById.get(binding.surface);

      if (!surface) {
        issues.push(
          issue(
            "error",
            "unknown_binding_surface",
            `${bindingPath}/surface`,
            `${action.id} references undeclared Surface ${binding.surface}.`
          )
        );
        continue;
      }

      boundSurfaceIds.add(binding.surface);

      const exposesJson =
        binding.target.includes("--json") ||
        binding.target.startsWith("cli:always-json/");

      if (surface.kind === "cli" && !exposesJson) {
        issues.push(
          issue(
            "warning",
            "cli_binding_json_not_visible",
            `${bindingPath}/target`,
            `${action.id} CLI binding does not show a --json mode.`
          )
        );
      }

      if (targetLevels.has("AP-4") && !binding.test) {
        issues.push(
          issue(
            "error",
            "binding_test_missing",
            bindingPath,
            `${action.id} binding for ${binding.surface} lacks AP-4 test evidence.`
          )
        );
      }
    }

    for (const [exceptionIndex, exception] of (action.parity_exceptions ?? []).entries()) {
      const exceptionPath = `${actionPath}/parity_exceptions/${exceptionIndex}`;
      exceptionSurfaceIds.add(exception.surface);

      if (!surfaceById.has(exception.surface)) {
        issues.push(
          issue(
            "error",
            "unknown_exception_surface",
            `${exceptionPath}/surface`,
            `${action.id} exception references undeclared Surface ${exception.surface}.`
          )
        );
      }

      if (boundSurfaceIds.has(exception.surface)) {
        issues.push(
          issue(
            "warning",
            "redundant_parity_exception",
            exceptionPath,
            `${action.id} has both a Binding and exception for ${exception.surface}.`
          )
        );
      }
    }

    for (const surface of requiredSurfaces) {
      if (!boundSurfaceIds.has(surface.id) && !exceptionSurfaceIds.has(surface.id)) {
        issues.push(
          issue(
            "error",
            "missing_required_binding",
            `${actionPath}/bindings`,
            `${action.id} has no Binding or declared exception for required Surface ${surface.id}.`
          )
        );
      }
    }

    const hasMachineBinding = action.bindings.some((binding) => {
      const surface = surfaceById.get(binding.surface);
      return surface && MACHINE_SURFACE_KINDS.has(surface.kind);
    });

    if (!hasMachineBinding) {
      issues.push(
        issue(
          "error",
          "machine_surface_missing",
          `${actionPath}/bindings`,
          `${action.id} has no non-visual machine Surface.`
        )
      );
    }

    const requiresConfirmation =
      action.effects.risk === "high" ||
      action.effects.risk === "critical" ||
      action.effects.class === "destructive" ||
      action.effects.class === "financial";

    if (requiresConfirmation && action.effects.confirmation === "never") {
      issues.push(
        issue(
          "error",
          "unsafe_confirmation_policy",
          `${actionPath}/effects/confirmation`,
          `${action.id} requires conditional or always confirmation.`
        )
      );
    }

    if (
      (targetLevels.has("AP-3") || targetLevels.has("AP-4")) &&
      action.effects.class !== "read" &&
      !action.effects.audit_required
    ) {
      issues.push(
        issue(
          "error",
          "audit_required_for_state_change",
          `${actionPath}/effects/audit_required`,
          `${action.id} changes or reaches outside the application but does not require audit.`
        )
      );
    }

    if (action.effects.rollback_action && !actionById.has(action.effects.rollback_action)) {
      issues.push(
        issue(
          "error",
          "unknown_rollback_action",
          `${actionPath}/effects/rollback_action`,
          `${action.id} references missing rollback Action ${action.effects.rollback_action}.`
        )
      );
    }

    if (action.execution.timeout_ms > 300000) {
      issues.push(
        issue(
          "warning",
          "long_default_timeout",
          `${actionPath}/execution/timeout_ms`,
          `${action.id} has a default timeout longer than five minutes.`
        )
      );
    }

    if (action.execution.progress_events && !action.execution.cancellable) {
      issues.push(
        issue(
          "warning",
          "progress_without_cancellation",
          `${actionPath}/execution`,
          `${action.id} reports progress but cannot be cancelled.`
        )
      );
    }
  }

  return buildReport(manifest, issues);
}

function buildReport(manifest, issues) {
  const surfaces = Array.isArray(manifest?.surfaces) ? manifest.surfaces : [];
  const actions = Array.isArray(manifest?.actions) ? manifest.actions : [];
  const requiredSurfaces = surfaces.filter((surface) => surface?.required_for_parity);
  const requiredSurfaceIds = new Set(requiredSurfaces.map((surface) => surface.id));

  let presentRequiredBindings = 0;
  let exceptionCount = 0;
  const perSurface = requiredSurfaces.map((surface) => {
    let mappedActions = 0;
    for (const action of actions) {
      if ((action.bindings ?? []).some((binding) => binding.surface === surface.id)) {
        mappedActions += 1;
      }
    }
    presentRequiredBindings += mappedActions;
    return {
      id: surface.id,
      kind: surface.kind,
      mapped_actions: mappedActions,
      total_actions: actions.length,
      coverage_percent: actions.length === 0 ? 0 : roundPercent(mappedActions, actions.length)
    };
  });

  for (const action of actions) {
    exceptionCount += (action.parity_exceptions ?? []).filter((exception) =>
      requiredSurfaceIds.has(exception.surface)
    ).length;
  }

  const totalRequiredBindings = actions.length * requiredSurfaces.length;
  const errors = issues.filter((item) => item.severity === "error").length;
  const warnings = issues.filter((item) => item.severity === "warning").length;

  return {
    ok: errors === 0,
    spec_version: manifest?.spec_version ?? null,
    application: manifest?.application ?? null,
    summary: {
      actions: actions.length,
      surfaces: surfaces.length,
      required_surfaces: requiredSurfaces.length,
      headless_actions: actions.filter((action) => action.execution?.headless).length,
      present_required_bindings: presentRequiredBindings,
      total_required_bindings: totalRequiredBindings,
      strict_parity_percent:
        totalRequiredBindings === 0 ? 0 : roundPercent(presentRequiredBindings, totalRequiredBindings),
      declared_exceptions: exceptionCount,
      errors,
      warnings
    },
    surfaces: perSurface,
    issues
  };
}

function roundPercent(numerator, denominator) {
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function schemaPath() {
  return fileURLToPath(schemaUrl);
}
