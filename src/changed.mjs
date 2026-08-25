import path from "node:path";
import { runCommand } from "./exec.mjs";

/**
 * Decide which Actions a working-tree change can affect.
 *
 * The rule this module exists to enforce: work is skipped only when the plan
 * proves it is safe to skip. A changed file that cannot be attributed to an
 * Action widens the run back to everything. Narrowing by accident would let a
 * scoped pass stand in for evidence it never produced.
 */
export async function resolveChangedScope(manifest, plan, options = {}) {
  const planDirectory = path.resolve(options.planDirectory ?? process.cwd());
  const manifestPath = path.resolve(options.manifestPath);
  const planPath = options.planPath ? path.resolve(options.planPath) : null;
  const base = options.base ?? "HEAD";

  const git = await changedFiles(planDirectory, base);
  if (git.error) {
    return {
      mode: "changed",
      base,
      error: git.error,
      full: true,
      full_reason: git.error,
      changed_files: [],
      affected_action_ids: [],
      unattributed_files: [],
      tests: []
    };
  }

  const allActionIds = manifest.actions.map((action) => action.id);
  const ignore = (plan.scope_ignore ?? []).map((pattern) => globToRegExp(pattern));
  const sources = plan.sources ?? {};
  const declaredSourceIds = Object.keys(sources);

  const testRefToActions = new Map();
  for (const action of manifest.actions) {
    for (const binding of action.bindings) {
      if (!binding.test) continue;
      if (!testRefToActions.has(binding.test)) testRefToActions.set(binding.test, new Set());
      testRefToActions.get(binding.test).add(action.id);
    }
  }

  const affected = new Set();
  const unattributed = [];
  const attribution = [];
  let full = false;
  let fullReason = null;

  for (const absolute of git.files) {
    const relativeToPlan = toPosix(path.relative(planDirectory, absolute));

    if (ignore.some((pattern) => pattern.test(relativeToPlan))) {
      attribution.push({ file: relativeToPlan, via: "ignored", action_ids: [] });
      continue;
    }

    if (planPath && absolute === planPath) {
      full = true;
      fullReason = "the verification plan changed, so every Binding is measured differently";
      attribution.push({ file: relativeToPlan, via: "plan", action_ids: allActionIds });
      continue;
    }

    if (absolute === manifestPath) {
      const manifestScope = await manifestActionDelta(manifestPath, base, manifest, planDirectory);
      if (manifestScope.full) {
        full = true;
        fullReason = manifestScope.reason;
      } else {
        for (const id of manifestScope.action_ids) affected.add(id);
      }
      attribution.push({
        file: relativeToPlan,
        via: "manifest",
        action_ids: manifestScope.full ? allActionIds : manifestScope.action_ids
      });
      continue;
    }

    const matchedIds = declaredSourceIds.filter((id) =>
      (sources[id] ?? []).some((pattern) => globToRegExp(pattern).test(relativeToPlan))
    );
    if (matchedIds.length > 0) {
      for (const id of matchedIds) affected.add(id);
      attribution.push({ file: relativeToPlan, via: "sources", action_ids: matchedIds });
      continue;
    }

    const testRef = [...testRefToActions.keys()].find(
      (ref) => path.resolve(planDirectory, ref) === absolute
    );
    if (testRef) {
      const ids = [...testRefToActions.get(testRef)];
      for (const id of ids) affected.add(id);
      attribution.push({ file: relativeToPlan, via: "test", action_ids: ids });
      continue;
    }

    unattributed.push(relativeToPlan);
    attribution.push({ file: relativeToPlan, via: "unattributed", action_ids: [] });
  }

  if (unattributed.length > 0 && !full) {
    full = true;
    fullReason = `${unattributed.length} changed file(s) could not be attributed to an Action`;
  }

  const affectedIds = full ? allActionIds : [...affected];
  const requiredTests = new Set();
  for (const action of manifest.actions) {
    if (!affectedIds.includes(action.id)) continue;
    for (const binding of action.bindings) {
      if (binding.test) requiredTests.add(binding.test);
    }
  }

  return {
    mode: "changed",
    base,
    error: null,
    full,
    full_reason: fullReason,
    changed_files: git.files.map((file) => toPosix(path.relative(planDirectory, file))),
    attribution,
    unattributed_files: unattributed,
    affected_action_ids: affectedIds.sort(),
    skipped_action_ids: allActionIds.filter((id) => !affectedIds.includes(id)).sort(),
    tests: [...requiredTests].sort()
  };
}

/**
 * Files changed against `base`, plus anything uncommitted or untracked. A quick
 * loop is run on a dirty tree, so a committed-only diff would miss the edit the
 * developer is actually asking about.
 */
async function changedFiles(cwd, base) {
  try {
    const root = await runCommand(["git", "rev-parse", "--show-toplevel"], { cwd, timeoutMs: 5_000 });
    if (root.exit_code !== 0) return { error: "not a git repository", files: [] };
    const repoRoot = root.stdout.trim();

    const diff = await runCommand(["git", "diff", "--name-only", base], { cwd, timeoutMs: 15_000 });
    if (diff.exit_code !== 0) {
      return { error: `git diff against ${base} failed`, files: [] };
    }
    const status = await runCommand(["git", "status", "--porcelain"], { cwd, timeoutMs: 15_000 });
    if (status.exit_code !== 0) return { error: "git status failed", files: [] };

    const names = new Set();
    for (const line of diff.stdout.split("\n")) {
      const name = line.trim();
      if (name) names.add(name);
    }
    for (const line of status.stdout.split("\n")) {
      const name = line.slice(3).trim();
      if (!name) continue;
      // Renames arrive as "old -> new"; the new path is what can affect behavior.
      const arrow = name.lastIndexOf(" -> ");
      names.add(arrow === -1 ? name : name.slice(arrow + 4));
    }
    return {
      error: null,
      files: [...names].map((name) => path.resolve(repoRoot, name)).sort()
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), files: [] };
  }
}

/**
 * Which Actions changed in the Manifest itself. Anything outside the action
 * list -- surfaces, spec version, application identity -- widens to a full run,
 * because those change what every Binding is measured against.
 */
async function manifestActionDelta(manifestPath, base, current, cwd) {
  const relative = await runCommand(["git", "ls-files", "--full-name", manifestPath], {
    cwd,
    timeoutMs: 5_000
  });
  const tracked = relative.stdout.trim();
  if (relative.exit_code !== 0 || !tracked) {
    return { full: true, reason: "the Manifest is not tracked, so no base version exists", action_ids: [] };
  }
  const show = await runCommand(["git", "show", `${base}:${tracked}`], { cwd, timeoutMs: 10_000 });
  if (show.exit_code !== 0) {
    return { full: true, reason: `no Manifest at ${base} to compare against`, action_ids: [] };
  }
  let previous;
  try {
    previous = JSON.parse(show.stdout);
  } catch {
    return { full: true, reason: "the Manifest at the base revision is not valid JSON", action_ids: [] };
  }

  const framing = (manifest) =>
    JSON.stringify({
      spec_version: manifest.spec_version,
      application: manifest.application,
      surfaces: manifest.surfaces
    });
  if (framing(previous) !== framing(current)) {
    return { full: true, reason: "surfaces, spec version, or application identity changed", action_ids: [] };
  }

  const previousById = new Map((previous.actions ?? []).map((action) => [action.id, action]));
  const currentById = new Map(current.actions.map((action) => [action.id, action]));
  for (const id of previousById.keys()) {
    if (!currentById.has(id)) {
      return { full: true, reason: `Action ${id} was removed`, action_ids: [] };
    }
  }

  const changed = [];
  for (const [id, action] of currentById) {
    const before = previousById.get(id);
    if (!before || JSON.stringify(before) !== JSON.stringify(action)) changed.push(id);
  }
  return { full: false, reason: null, action_ids: changed };
}

/**
 * A deliberately small glob: `**` spans directories, `*` and `?` stay inside a
 * segment. Patterns are matched against plan-relative POSIX paths.
 */
export function globToRegExp(pattern) {
  let source = "";
  const normalized = toPosix(pattern);
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === "*") {
      if (normalized[index + 1] === "*") {
        const skipSlash = normalized[index + 2] === "/";
        source += skipSlash ? "(?:.*/)?" : ".*";
        index += skipSlash ? 2 : 1;
      } else {
        source += "[^/]*";
      }
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += character.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}
