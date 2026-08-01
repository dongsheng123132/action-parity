import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "skills", "action-parity");
const targets = [
  path.join(root, ".agents", "skills", "action-parity"),
  path.join(root, ".claude", "skills", "action-parity")
];
const checkMode = process.argv.includes("--check");
const sourceFiles = await listFiles(source);
const results = [];

for (const target of targets) {
  for (const relative of sourceFiles) {
    const sourcePath = path.join(source, relative);
    const targetPath = path.join(target, relative);
    const expected = await readFile(sourcePath);
    let actual = null;
    try {
      actual = await readFile(targetPath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const current = actual?.equals(expected) === true;
    if (!checkMode && !current) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, expected);
    }
    results.push({ path: targetPath, status: current ? "current" : checkMode ? "drifted" : "synced" });
  }
}

for (const result of results) process.stdout.write(`${result.status}\t${result.path}\n`);
if (checkMode && results.some((result) => result.status !== "current")) process.exitCode = 1;

async function listFiles(directory, prefix = "") {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) output.push(...(await listFiles(path.join(directory, entry.name), relative)));
    else if (entry.isFile()) output.push(relative);
  }
  return output.sort();
}
