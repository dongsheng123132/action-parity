import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { writeShadowBundle } from '../packages/anycut/src/core.mjs';
import { planMasks, rebaseMasks, verifyMasks } from '../packages/anycut/src/core.mjs';
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

// ---- UIA 真树链路纯函数（§9.5 M1-P2 复测钉死）----

test('planMasks: 涉密节点产出屏幕空间 mask，干净节点零 mask', () => {
  const hit = planMasks([{ node_id: 'd', parent_id: null, control_type: 'Document', name: '编辑器', value: 'api-key = sk-test-FAKE-0000', bounds_px: { x: 10, y: 20, width: 100, height: 50 }, visible: true }]);
  assert.equal(hit.masks.length, 1);
  assert.equal(hit.masks[0].x, 10); assert.equal(hit.masks[0].y, 20);
  assert.equal(hit.masks[0].width, 100); assert.equal(hit.masks[0].height, 50);
  assert.equal(hit.masks[0].ref, 'ui-tree.json#/nodes/d');
  assert.ok(hit.replacements >= 1);
  assert.doesNotMatch(JSON.stringify(hit.sanitizedNodes), /sk-test-FAKE-0000/);
  const clean = planMasks([{ node_id: 'd', parent_id: null, control_type: 'Document', name: '编辑器', value: '普通中文文本', bounds_px: { x: 10, y: 20, width: 100, height: 50 }, visible: true }]);
  assert.equal(clean.masks.length, 0);
  const hidden = planMasks([{ node_id: 'd', parent_id: null, control_type: 'Document', name: '编辑器', value: 'api-key = sk-test-FAKE-0000', bounds_px: { x: 10, y: 20, width: 100, height: 50 }, visible: false }]);
  assert.equal(hidden.masks.length, 0); // 不可见节点不规划像素遮盖
});

test('rebaseMasks: 按 capture 原点平移，无原点直通', () => {
  const masks = [{ x: 666, y: 261, width: 100, height: 50, ref: 'r', rule: 'text-node-hit' }];
  assert.deepEqual(rebaseMasks(masks, { x: 660, y: 186 }), [{ x: 6, y: 75, width: 100, height: 50, ref: 'r', rule: 'text-node-hit' }]);
  assert.deepEqual(rebaseMasks(masks, null), masks);
});

function tinyPng(width, height, paint) {
  // 与 helper 一致：8-bit RGBA 非交错，filter-0 行。
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4, 0);
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y);
      row[1 + x * 4] = r; row[1 + x * 4 + 1] = g; row[1 + x * 4 + 2] = b; row[1 + x * 4 + 3] = a;
    }
    rows.push(row);
  }
  const idat = deflateSync(Buffer.concat(rows));
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); table[n] = c; }
  const crc = (buf) => { let c = -1; for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'ascii');
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

test('verifyMasks: 遮盖色通过、未遮盖/无交集硬失败', () => {
  const png = tinyPng(4, 3, (x, y) => (x < 2 && y < 2 ? [0x2e, 0x2e, 0x2e, 255] : [255, 255, 255, 255]));
  assert.deepEqual(verifyMasks(png, [{ x: 0, y: 0, width: 2, height: 2, ref: 'm0' }]), { checked: 1 });
  assert.deepEqual(verifyMasks(png, []), { checked: 0 }); // 无 mask 直通
  assert.throws(() => verifyMasks(png, [{ x: 2, y: 0, width: 2, height: 2, ref: 'm1' }]), (error) => error.code === 'mask_verification_failed');
  assert.throws(() => verifyMasks(png, [{ x: 10, y: 10, width: 2, height: 2, ref: 'm2' }]), (error) => error.code === 'mask_verification_failed');
  assert.throws(() => verifyMasks(Buffer.from([1, 2, 3]), [{ x: 0, y: 0, width: 1, height: 1 }]), (error) => error.code === 'unsupported_png');
});
