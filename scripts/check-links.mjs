import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const ignoredDirectories = new Set([".git", "node_modules", "coverage", "artifacts"]);

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await markdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function localTargets(markdown) {
  const targets = [];
  const expression = /\[[^\]]*]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(expression)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (
      rawTarget.startsWith("http://") ||
      rawTarget.startsWith("https://") ||
      rawTarget.startsWith("mailto:") ||
      rawTarget.startsWith("#")
    ) {
      continue;
    }
    targets.push(rawTarget.split("#", 1)[0]);
  }
  return targets;
}

const missing = [];
for (const file of await markdownFiles(root)) {
  const markdown = await readFile(file, "utf8");
  for (const target of localTargets(markdown)) {
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
    try {
      await access(resolved);
    } catch {
      missing.push({
        file: path.relative(root, file),
        target
      });
    }
  }
}

if (missing.length > 0) {
  for (const item of missing) {
    process.stderr.write(`${item.file}: missing local link ${item.target}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("All local Markdown links resolve.\n");
}

