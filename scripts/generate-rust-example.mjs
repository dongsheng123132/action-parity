import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { materializeRegistryBundle, stableStringify } from "../src/generator.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const example = path.join(root, "examples", "rust-registry");
const output = path.join(example, "generated");

const bundle = await exportBundle();
await materializeRegistryBundle(bundle, output);
await writeFile(path.join(output, "registry-bundle.json"), `${stableStringify(bundle, 2)}\n`, "utf8");
process.stdout.write(`Generated Rust registry artifacts in ${output}\n`);

function exportBundle() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cargo",
      ["run", "--quiet", "--manifest-path", path.join(example, "Cargo.toml"), "--", "export"],
      { cwd: root, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "inherit"] }
    );
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Rust registry exporter exited with ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Rust registry exporter returned invalid JSON: ${error.message}`));
      }
    });
  });
}
