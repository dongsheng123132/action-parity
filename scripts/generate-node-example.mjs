import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  checkRegistryBundle,
  generatedTextMatches,
  materializeRegistryBundle,
  stableStringify
} from "../src/generator.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const example = path.join(root, "examples", "node-registry");
const output = path.join(example, "generated");
const checkMode = process.argv.includes("--check");
const jsonMode = process.argv.includes("--json");

const bundle = await exportBundle();
if (checkMode) {
  const result = await checkRegistryBundle(bundle, output, { typescript: true });
  const bundleStatus = await checkFile(
    path.join(output, "registry-bundle.json"),
    `${stableStringify(bundle, 2)}\n`
  );
  result.files.push(bundleStatus);
  result.ok = result.ok && bundleStatus.status === "current";
  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    for (const file of result.files) process.stdout.write(`${file.status}\t${file.path}\n`);
  }
  process.exitCode = result.ok ? 0 : 1;
} else {
  await materializeRegistryBundle(bundle, output, { typescript: true });
  await writeFile(
    path.join(output, "registry-bundle.json"),
    `${stableStringify(bundle, 2)}\n`,
    "utf8"
  );
  if (jsonMode) process.stdout.write(`${JSON.stringify({ ok: true, output })}\n`);
  else process.stdout.write(`Generated Node registry artifacts in ${output}\n`);
}

function exportBundle() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(example, "src", "cli.mjs"), "export"], {
      cwd: example,
      // The exporter must describe the registry, not whatever board a developer
      // happens to have on disk.
      env: { ...process.env, TASKS_FILE: "" },
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "inherit"]
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Node registry exporter exited with ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Node registry exporter returned invalid JSON: ${error.message}`));
      }
    });
  });
}

async function checkFile(target, expected) {
  try {
    return {
      path: target,
      status: generatedTextMatches(await readFile(target, "utf8"), expected) ? "current" : "drifted"
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { path: target, status: "missing" };
    throw error;
  }
}
