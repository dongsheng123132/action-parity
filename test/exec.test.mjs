import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCommand } from "../src/exec.mjs";

/**
 * These tests exist because the U-King pilot shipped a subprocess launcher the
 * hard way: on Windows, npm-family tools are .cmd shims, CreateProcess refuses
 * them (ENOENT / os error 193), a killed cmd.exe leaves grandchildren holding
 * the pipes, and exit codes must survive the trip. Every behavior asserted
 * here is one of those real failures.
 */

const isWindows = process.platform === "win32";
const windowsOnly = { skip: isWindows ? false : "Windows-only behavior" };

test("runCommand captures stdout and the exit code of a plain executable", async () => {
  const result = await runCommand(["git", "--version"], { timeoutMs: 30_000 });
  assert.equal(result.spawn_error, null);
  assert.equal(result.exit_code, 0);
  assert.match(result.stdout, /^git version/);
});

test("a .cmd shim resolves and runs where a bare spawn would fail", windowsOnly, async () => {
  const { root } = await makeShimRepo();
  const result = await runCommand(["demo-cmd", "--version"], { cwd: root, timeoutMs: 30_000 });
  assert.equal(result.spawn_error, null);
  assert.equal(result.exit_code, 0);
  assert.match(result.stdout, /demo-cmd-1\.2\.3/);
});

test("exit codes survive the cmd.exe batch wrapper", windowsOnly, async () => {
  const { root } = await makeShimRepo();
  const result = await runCommand(["demo-cmd", "--fail"], { cwd: root, timeoutMs: 30_000 });
  assert.equal(result.exit_code, 7);
  assert.equal(result.timed_out, false);
});

test("arguments with spaces arrive intact through the wrapper", windowsOnly, async () => {
  const { root } = await makeShimRepo();
  const result = await runCommand(["demo-cmd", "echo-arg", "two parts & here"], { cwd: root, timeoutMs: 30_000 });
  assert.equal(result.exit_code, 0);
  assert.match(result.stdout, /ARG=\[two parts & here\]/);
});

test("a timeout kills the whole tree instead of hanging on orphaned pipes", windowsOnly, async () => {
  const { root } = await makeShimRepo();
  const started = Date.now();
  const result = await runCommand(["demo-cmd", "--hang"], { cwd: root, timeoutMs: 3_000 });
  const elapsed = Date.now() - started;
  assert.equal(result.timed_out, true);
  // If taskkill missed the tree, node holds the pipe open and this waits.
  assert.ok(elapsed < 15_000, `kill-tree took ${elapsed}ms; grandchildren likely survived`);
});

test("an unknown program reports a spawn error instead of throwing", async () => {
  const result = await runCommand(["definitely-not-a-real-program-xyz", "--version"]);
  assert.notEqual(result.spawn_error, null);
});

async function makeShimRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ap-exec-"));
  try {
    await writeFile(
      path.join(root, "demo-cmd.cmd"),
      [
        "@echo off",
        "if \"%~1\"==\"--version\" echo demo-cmd-1.2.3 & exit /b 0",
        "if \"%~1\"==\"--fail\" exit /b 7",
        "if \"%~1\"==\"--hang\" ping -n 61 127.0.0.1 >nul & exit /b 9",
        "if \"%~1\"==\"echo-arg\" echo ARG=[%~2] & exit /b 0",
        "echo unknown args & exit /b 1"
      ].join("\r\n"),
      "utf8"
    );
    return { root };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
