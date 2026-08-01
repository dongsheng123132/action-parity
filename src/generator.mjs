import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateManifestObject } from "./validator.mjs";

export const REGISTRY_BUNDLE_FORMAT = "action-parity.registry-bundle/v1";

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}
export function stableStringify(value, space = 0) {
  return JSON.stringify(canonicalize(value), null, space);
}

export function validateRegistryBundle(bundle) {
  if (!bundle || bundle.format !== REGISTRY_BUNDLE_FORMAT) {
    throw new Error(`Expected registry bundle format ${REGISTRY_BUNDLE_FORMAT}.`);
  }
  if (!bundle.manifest || !bundle.cli_help || !bundle.mcp_tools) {
    throw new Error("Registry bundle must contain manifest, cli_help, and mcp_tools.");
  }
  const report = validateManifestObject(bundle.manifest);
  if (!report.ok) {
    const details = report.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(`Generated manifest is invalid:\n${details}`);
  }
  return report;
}

export async function readRegistryBundle(bundlePath) {
  return JSON.parse(await readFile(bundlePath, "utf8"));
}

export async function materializeRegistryBundle(bundle, outputDirectory) {
  validateRegistryBundle(bundle);
  await mkdir(outputDirectory, { recursive: true });
  const artifacts = registryArtifacts(bundle);
  for (const [filename, value] of artifacts) {
    await atomicWrite(path.join(outputDirectory, filename), `${stableStringify(value, 2)}\n`);
  }
  return artifacts.map(([filename]) => path.join(outputDirectory, filename));
}

export async function checkRegistryBundle(bundle, outputDirectory) {
  validateRegistryBundle(bundle);
  const files = [];
  for (const [filename, value] of registryArtifacts(bundle)) {
    const target = path.join(outputDirectory, filename);
    const expected = `${stableStringify(value, 2)}\n`;
    let actual = null;
    try {
      actual = await readFile(target, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    files.push({ path: target, status: actual === expected ? "current" : actual === null ? "missing" : "drifted" });
  }
  return { ok: files.every((file) => file.status === "current"), files };
}

function registryArtifacts(bundle) {
  return [
    ["action-parity.json", bundle.manifest],
    ["cli-help.json", bundle.cli_help],
    ["mcp-tools.json", bundle.mcp_tools]
  ];
}

async function atomicWrite(target, content) {
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, target);
}
