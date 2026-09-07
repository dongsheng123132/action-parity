import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { writeShadowBundle } from '../packages/anycut/src/core.mjs';
import { redactText, redactValue, redactPixels } from '../packages/anycut/src/redact.mjs';
import { validateShadow } from '../packages/anycut/src/inspect.mjs';
import { runAudit } from '../packages/anycut/src/audit.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'anycut-中文-fixture-'));
  const result = await writeShadowBundle({
    outRoot: root, purpose: '审查中文设置页 API 密钥: 测试密钥abc123456', ttl: '1h', now: new Date('2026-09-07T01:02:03.000Z'), crop: 'window',
    capture: {
      subject: { app_id: 'local.u-king', app_name: 'U-King', app_version: null, platform: 'windows', os_version: 'Windows 11', locale: 'zh-CN', processes: [{ pid: 88, image_name: 'u-king.exe', image_sha256: null }], window: { hwnd: '0x00000000000000AB', owner_pid: 88, title: 'U-King 设置', bounds_px: { x: 0, y: 0, width: 1, height: 1 }, dpi: 144 } },
      nodes: [{ node_id: 'root', parent_id: null, control_type: 'Window', name: '设置 — 密钥管理', automation_id: 'settings', bounds_px: { x: 0, y: 0, width: 1, height: 1 }, visible: true }, { node_id: 'key', parent_id: 'root', control_type: 'Edit', name: 'API 密钥字段（值不回显）', automation_id: 'api-key', bounds_px: { x: 0, y: 0, width: 1, height: 1 }, visible: true }]
    }
  });
  return { root, ...result };
}

test('AnyCut writes an atomic eight-artifact Chinese Shadow bundle', async (t) => {
  const item = await fixture(); t.after(() => rm(item.root, { recursive: true, force: true }));
  const names = ['screenshot.png', 'ui-tree.json', 'window.json', 'actions.json', 'state.json', 'regions.json', 'context.md', 'shadow.json'];
  for (const name of names) await readFile(join(item.runDir, name));
  const tree = await readFile(join(item.runDir, 'ui-tree.json'), 'utf8');
  assert.match(tree, /设置/); assert.doesNotMatch(tree, /测试密钥abc123456/);
  assert.equal((await validateShadow(item.runDir, { now: new Date('2026-09-07T01:03:00.000Z') })).shadow.subject.window.title, 'U-King 设置');
});

test('inspect shadow rejects tampered artifact with exit code 6', async (t) => {
  const item = await fixture(); t.after(() => rm(item.root, { recursive: true, force: true }));
  await writeFile(join(item.runDir, 'state.json'), '{"tampered":true}\n');
  await assert.rejects(() => validateShadow(item.runDir, { now: new Date('2026-09-07T01:03:00.000Z') }), (error) => error.exitCode === 6 && error.code === 'artifact_digest_mismatch');
});

test('auto redaction handles Chinese labels and common tokens', () => {
  const result = redactText('密码：测试密钥abc123456 Bearer abcdefghijkl');
  assert.doesNotMatch(result.text, /测试密钥abc123456|abcdefghijkl/);
  assert.ok(result.replacements >= 2);
});

test('builtin audit makes zero network requests', async (t) => {
  const item = await fixture(); t.after(() => rm(item.root, { recursive: true, force: true }));
  const original = globalThis.fetch; let calls = 0; globalThis.fetch = async () => { calls += 1; throw new Error('network forbidden'); };
  t.after(() => { globalThis.fetch = original; });
  const outcome = await runAudit({ run: item.runDir, now: new Date('2026-09-07T01:03:00.000Z') });
  assert.equal(calls, 0); assert.equal(outcome.report.adapter.id, 'builtin'); assert.equal(outcome.exitCode, 0);
});

// ---- 修复轮回归（terra 盲审 B1-B4 阻断项钉死）----

test('B4: run allocation is exclusive and half-written runs are rejected', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'anycut-b4-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = { outRoot: root, purpose: 'B4 并发独占', ttl: '1h', now: new Date('2026-09-07T02:00:00.000Z'), crop: 'window' };
  const first = await writeShadowBundle(base);
  assert.match(first.runDir, /2026-09-07-0001$/);
  const second = await writeShadowBundle(base);
  assert.match(second.runDir, /2026-09-07-0002$/); // mkdir 独占，绝不复用 0001
  // 半成品 run（缺 shadow.json 提交标记）必须被拒绝
  const half = join(root, 'runs', '2026-09-07-0003');
  await mkdir(half);
  await writeFile(join(half, 'screenshot.png'), 'x');
  await assert.rejects(() => validateShadow(half), (error) => error.exitCode === 6 && error.code === 'missing_artifact');
});

test('B3: TTL binding — hand-edited far-future expires_at is rejected', async (t) => {
  const item = await fixture(); t.after(() => rm(item.root, { recursive: true, force: true }));
  const shadowPath = join(item.runDir, 'shadow.json');
  const shadow = JSON.parse(await readFile(shadowPath, 'utf8'));
  shadow.expires_at = '2099-01-01T00:00:00.000Z'; // 篡改存续期但不改 ttl_seconds
  await writeFile(shadowPath, `${JSON.stringify(shadow, null, 2)}\n`);
  await assert.rejects(() => validateShadow(item.runDir, { now: new Date('2026-09-07T01:03:00.000Z') }), (error) => error.exitCode === 6 && error.code === 'ttl_binding_mismatch');
});

test('B3: junction escape — symlinked artifact leaf is rejected', async (t) => {
  const item = await fixture(); t.after(() => rm(item.root, { recursive: true, force: true }));
  const secret = join(item.root, 'outside-secret.txt');
  await writeFile(secret, '泄露材料');
  await writeFile(join(item.runDir, 'context.md'), 'x'); // 先移走原文件
  await rm(join(item.runDir, 'context.md'));
  try { await symlink(secret, join(item.runDir, 'context.md')); } catch { return; /* 无权限建 symlink 的环境跳过 */ }
  await assert.rejects(() => validateShadow(item.runDir), (error) => error.exitCode === 6 && error.code === 'missing_artifact');
});

test('B2: pixel redaction refuses to pass through unresolved masks', () => {
  const png = Buffer.from([137, 80, 78, 71]);
  assert.throws(() => redactPixels(png, [{ x: 0, y: 0, width: 1, height: 1 }]), (error) => error.code === 'pixel_redaction_unresolved');
  assert.equal(redactPixels(png).png, png);
});

test('B2: redactValue keeps explicit nulls and redacts keyed secrets', () => {
  const input = { app_version: null, api_key: 'sk-abcdefghijklmnop', nested: { token: 'ghp_abcdefghij', note: '邮箱 user@example.com' } };
  const output = redactValue(input).value;
  assert.equal(output.app_version, null); // nullish 陷阱回归：null 不得被静默丢弃
  assert.match(output.api_key, /已脱敏/);
  assert.match(output.nested.token, /已脱敏/);
  assert.doesNotMatch(output.nested.note, /user@example\.com/);
});

test('B2 pipeline: sensitive text node forces pixel hard-fail, never a raw screenshot', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'anycut-b2-pipeline-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => writeShadowBundle({
    outRoot: root, purpose: '管线集成验证', ttl: '1h', crop: 'window', now: new Date('2026-09-07T03:00:00.000Z'),
    capture: { subject: { app_id: 'x', app_name: 'X', app_version: null, platform: 'windows', os_version: 'Windows 11', locale: 'zh-CN', processes: [{ pid: 1, image_name: 'x.exe', image_sha256: null }], window: { hwnd: '0x1', owner_pid: 1, title: 'X', bounds_px: { x: 0, y: 0, width: 1, height: 1 }, dpi: 96 } }, nodes: [{ node_id: 'a', parent_id: null, control_type: 'Text', name: '令牌: ghp_abcdefghijkl', automation_id: null, bounds_px: { x: 0, y: 0, width: 1, height: 1 }, visible: true }] }
  }), (error) => error.code === 'pixel_redaction_unresolved');
});

test('B1 truth-in-bundle: backend/crop outside helper capability is rejected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'anycut-b1-'));
  try {
    await assert.rejects(() => writeShadowBundle({ outRoot: root, purpose: 'B1 wgc', ttl: '1h', crop: 'window', backend: 'wgc', now: new Date('2026-09-07T03:00:00.000Z') }), (error) => error.code === 'invalid_backend');
    await assert.rejects(() => writeShadowBundle({ outRoot: root, purpose: 'B1 client', ttl: '1h', crop: 'client', now: new Date('2026-09-07T03:00:00.000Z') }), (error) => error.code === 'invalid_crop');
  } finally { await rm(root, { recursive: true, force: true }); }
});
