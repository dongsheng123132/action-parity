import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(os.tmpdir(), "action-parity-release-"));

try {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const cargoToml = await readFile(path.join(root, "Cargo.toml"), "utf8");
  const cli = await readFile(path.join(root, "bin", "action-parity.mjs"), "utf8");
  const tauriCargo = await readFile(path.join(root, "adapters", "tauri", "Cargo.toml"), "utf8");
  const version = packageJson.version;

  assert(packageJson.private === false, "package.json must set private to false");
  assert(match(cargoToml, /\[workspace\.package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/)[1] === version,
    "npm and Cargo workspace versions must match");
  assert(match(cli, /const VERSION\s*=\s*"([^"]+)"/)[1] === version,
    "npm and CLI versions must match");
  assert(
    tauriCargo.includes(`action-parity-core = { version = "${version}", path = "../../crates/action-parity-core" }`),
    "the Tauri crate must declare both the published core version and local workspace path"
  );

  const pack = JSON.parse(
    await runNpm(["pack", "--json", "--pack-destination", temporary], root)
  )[0];
  const publishedPaths = new Set(pack.files.map((file) => file.path));
  for (const required of [
    "bin/action-parity.mjs",
    "src/generator.mjs",
    "src/typescript.mjs",
    "schema/action-parity.schema.json",
    "skills/action-parity/SKILL.md",
    "README.md",
    "README.zh-CN.md",
    "LICENSE"
  ]) {
    assert(publishedPaths.has(required), `npm package is missing ${required}`);
  }

  const consumer = path.join(temporary, "consumer");
  await mkdir(consumer);
  await writeFile(
    path.join(consumer, "package.json"),
    `${JSON.stringify({ name: "action-parity-release-smoke", private: true }, null, 2)}\n`,
    "utf8"
  );
  const tarball = path.join(temporary, pack.filename);
  await runNpm(
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    consumer
  );

  const installedCli = path.join(
    consumer,
    "node_modules",
    "action-parity",
    "bin",
    "action-parity.mjs"
  );
  const installedVersion = (await run(process.execPath, [installedCli, "--version"], consumer)).trim();
  assert(installedVersion === version, `installed CLI reported ${installedVersion}, expected ${version}`);

  const bundle = path.join(consumer, "registry-bundle.json");
  await copyFile(
    path.join(root, "examples", "rust-registry", "generated", "registry-bundle.json"),
    bundle
  );
  const generated = path.join(consumer, "generated");
  const generation = JSON.parse(
    await run(
      process.execPath,
      [installedCli, "generate", bundle, "--out-dir", generated, "--typescript", "--json"],
      consumer
    )
  );
  assert(generation.ok === true, "installed CLI failed to generate Registry artifacts");
  for (const filename of ["action-parity.json", "cli-help.json", "mcp-tools.json", "action-client.ts"]) {
    await access(path.join(generated, filename));
  }

  await run("cargo", ["package", "-p", "action-parity-core", "--allow-dirty", "--no-verify"], root);
  const tauriPackageFiles = await run(
    "cargo",
    ["package", "-p", "action-parity-tauri", "--allow-dirty", "--list"],
    root
  );
  for (const required of ["Cargo.toml", "README.md", "src/lib.rs"]) {
    assert(
      tauriPackageFiles.split(/\r?\n/).includes(required),
      `Tauri crate publish set is missing ${required}`
    );
  }

  process.stdout.write(
    `release-ready\t${version}\tnpm clean-install + 4 generated artifacts + core crate packaged + Tauri publish set checked\n`
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}

function run(program, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${program} ${args.join(" ")} exited ${code}\n${stderr || stdout}`));
    });
  });
}

function match(value, pattern) {
  const result = value.match(pattern);
  assert(result, `could not match ${pattern}`);
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runNpm(args, cwd) {
  if (process.env.npm_execpath) {
    return run(process.execPath, [process.env.npm_execpath, ...args], cwd);
  }
  if (process.platform !== "win32") return run("npm", args, cwd);

  const bundled = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  try {
    await access(bundled);
  } catch {
    throw new Error("Cannot locate npm-cli.js; run this check through `npm run check:release`.");
  }
  return run(process.execPath, [bundled, ...args], cwd);
}
