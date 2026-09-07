// Build the anycut v0.1 GitHub Release artifact: a self-contained Windows
// x64 zip carrying the Node CLI, its runtime deps (ajv), and the Rust
// helper exe, all traceable to one commit. See docs/RELEASING.md and
// ANYCUT_V0.1_PLAN.md §8.5 for the requirements this satisfies.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "packages", "anycut", "package.json"), "utf8"));
const version = pkg.version;
const distName = `anycut-v${version}-win-x64`;
const distRoot = path.join(root, "dist", distName);

async function main() {
  if (process.platform !== "win32") {
    throw new Error("anycut v0.1 targets Windows x64 only; run this on Windows");
  }

  // §8.5 "捕获来源、产物摘要、版本与验收日志可关联" — a dirty tree makes the
  // recorded commit hash a lie about what's actually in the zip.
  const gitStatus = await run("git", ["status", "--porcelain"], root);
  assert(gitStatus.trim() === "", "工作区不干净：提交或清理后再打包，避免 RELEASE.md 里的 commit hash 撒谎");
  const commit = (await run("git", ["rev-parse", "HEAD"], root)).trim();

  await rm(path.join(root, "dist"), { recursive: true, force: true });
  await mkdir(distRoot, { recursive: true });

  // 1. Node CLI + src, verbatim from packages/anycut.
  await cp(path.join(root, "packages", "anycut", "bin"), path.join(distRoot, "bin"), { recursive: true });
  await cp(path.join(root, "packages", "anycut", "src"), path.join(distRoot, "src"), { recursive: true });
  await writeFile(path.join(distRoot, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  // 2. Runtime deps — install ajv (and only ajv's tree) into the dist dir so
  //    the zip works standalone outside the workspace. §8.5 "干净中文
  //    Windows 11 普通用户环境可运行" broke on this in the M4 clean-machine
  //    run (had to hand-install ajv); this closes that gap in the artifact
  //    itself rather than in operator memory.
  const npmInstall = await mkdtemp(path.join(os.tmpdir(), "anycut-deps-"));
  try {
    await writeFile(
      path.join(npmInstall, "package.json"),
      `${JSON.stringify({ name: "anycut-release-deps", private: true, dependencies: pkg.dependencies }, null, 2)}\n`,
      "utf8"
    );
    await runNpm(["install", "--omit=dev", "--no-audit", "--no-fund"], npmInstall);
    await cp(path.join(npmInstall, "node_modules"), path.join(distRoot, "node_modules"), { recursive: true });
  } finally {
    await rm(npmInstall, { recursive: true, force: true });
  }

  // 3. Windows helper — build fresh from the same commit we just verified
  //    is clean, so the exe and the CLI can never drift to different
  //    source (§8.5 "Windows helper 与 CLI 来自同一源码提交").
  //
  //    Placement: src/adapter.mjs's helperPath() has no override — it always
  //    resolves to <cwd>/target/debug/anycut-windows.exe (see record.mjs,
  //    which never passes an explicit `executable`). We ship a release-mode
  //    binary but must place it at that exact relative path so the packaged
  //    CLI finds it when run from the unzipped root with no code change.
  await run("cargo", ["build", "-p", "anycut-windows", "--release"], root);
  const helperSrc = path.join(root, "target", "release", "anycut-windows.exe");
  await stat(helperSrc); // fail loudly if cargo didn't produce it
  const helperDestDir = path.join(distRoot, "target", "debug");
  await mkdir(helperDestDir, { recursive: true });
  await cp(helperSrc, path.join(helperDestDir, "anycut-windows.exe"));

  // 4. Hash manifest — every shipped file, so a recipient (or check-anycut-release.mjs)
  //    can verify nothing was swapped after packaging.
  const files = await listFilesRecursive(distRoot);
  const lines = [];
  for (const file of files.sort()) {
    const rel = path.relative(distRoot, file).split(path.sep).join("/");
    lines.push(`${await sha256(file)}  ${rel}`);
  }
  await writeFile(path.join(distRoot, "SHA256SUMS"), `${lines.join("\n")}\n`, "utf8");

  // 5. RELEASE.md — the §8.5 checklist made legible in the artifact itself.
  const releaseNotes = buildReleaseNotes({ version, commit });
  await writeFile(path.join(distRoot, "RELEASE.md"), releaseNotes, "utf8");

  // 6. Zip. Compress-Archive refuses to overwrite; the dist dir is fresh
  //    from step 0 so there's nothing to collide with.
  const zipPath = path.join(root, "dist", `${distName}.zip`);
  await run("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command",
    `Compress-Archive -Path '${distRoot}\\*' -DestinationPath '${zipPath}' -CompressionLevel Optimal`
  ], root);
  const zipHash = await sha256(zipPath);
  await writeFile(path.join(root, "dist", `${distName}.zip.sha256`), `${zipHash}  ${distName}.zip\n`, "utf8");

  process.stdout.write(`built ${zipPath}\n  commit ${commit}\n  sha256 ${zipHash}\n`);
}

function buildReleaseNotes({ version, commit }) {
  return `# AnyCut v${version} (Windows x64)

Built from commit \`${commit}\` — the Node CLI and \`anycut-windows.exe\` helper in this
zip are built from this exact same commit and no other (see \`SHA256SUMS\`).

## Install

Unzip anywhere. Requires Node.js >= 20 on PATH. Run all commands from the
**unzipped root directory** (the CLI locates its helper at the fixed relative
path \`target/debug/anycut-windows.exe\` under the current working directory —
that's a release-mode binary despite the \`debug\` folder name; don't move or
rename the \`target/\` folder):

\`\`\`
node bin/anycut.mjs capture --app <name> --purpose <text> --out <dir>
node bin/anycut.mjs inspect <run>
node bin/anycut.mjs audit <run>
node bin/anycut.mjs record --app <name> --purpose <text> --out <dir>
node bin/anycut.mjs tutorial <run>
\`\`\`

Fully offline after unzip: no network access, no AI account, no proxy dependency.
\`node_modules/\` ships \`ajv\` and its transitive deps so the CLI runs standalone
outside the source repository's workspace.

## 兼容性限制（Compatibility limitations）

- 首发平台仅中文 Windows 11 x64；未在其他 Windows 版本 / 语言区域验证。
- 首个已验证第三方目标：U-King（Tauri + WebView2），UIA 树暴露度「完备」
  （见 \`docs/ANYCUT_V0.1_PLAN.md\` §9.7）：首页 475 节点 / 设置页 182 节点，
  \`tree_status=complete\`，audit 零 finding。
- 第二个已验证目标：Notepad（\`docs/ANYCUT_V0.1_PLAN.md\` §9.2/§9.4/§9.5）。
- 未在 Electron 应用、非 WebView2 的 win32 原生窗口（除 Notepad 外）、
  UWP 应用、以 OCR 替代 UIA 的场景上验证；这些目标上的行为未知，不承诺覆盖。
- \`capture\` 的像素脱敏依赖 UIA 树定位可命中控件；当目标应用的 UIA 树不暴露
  内容节点（WebView2 完备但未必所有第三方应用都完备）时，像素遮盖可能不可用，
  此时仅文本脱敏生效——捕获涉密窗口前应先用 \`inspect --section tree\` 确认。
- 仅支持 \`--backend printwindow\`、\`--crop window\`；WGC 后端与客户端裁剪列为 R2。
- 第三方 auditor adapter 未在 v0.1 启用（\`audit adapters\`子命令受限）。

## 校验（Verification）

\`SHA256SUMS\` 列出包内每个文件的 sha256；本 zip 自身的摘要见随附的
\`${`anycut-v${version}-win-x64`}.zip.sha256\`。
`;
}

async function listFilesRecursive(dir) {
  const out = [];
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFilesRecursive(full)));
    else out.push(full);
  }
  return out;
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function run(program, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${program} ${args.join(" ")} exited ${code}\n${stderr || stdout}`));
    });
  });
}

async function runNpm(args, cwd) {
  if (process.env.npm_execpath) return run(process.execPath, [process.env.npm_execpath, ...args], cwd);
  const bundled = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  try {
    await stat(bundled);
  } catch {
    throw new Error("Cannot locate npm-cli.js; run this script through `npm run <script>`.");
  }
  return run(process.execPath, [bundled, ...args], cwd);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await main();
