import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AnyCutError, planMasks, rebaseMasks, verifyMasks, writeShadowBundle, ttlSeconds } from './core.mjs';
import { callWindowsHelper } from './adapter.mjs';
import { validateShadow } from './inspect.mjs';

/**
 * M4 record：复用单帧 capture 链逐帧落盘。record 只组装“已证明安全”的帧——
 * 键盘输入从不进包（helper 只给截图+UIA 树），像素遮盖证明沿用帧内逻辑。
 */

export async function captureFrame({ app, window, purpose, ttl = '1h', timeoutMs = 15000, outRoot, backend = 'printwindow', crop = 'window' }) {
  if (!app || !purpose) throw new AnyCutError(2, 'missing_capture_argument', 'capture 需要 --app 和 --purpose');
  if (backend !== 'printwindow') throw new AnyCutError(2, 'invalid_backend', 'v0.1 helper 仅实现 printwindow；wgc 列为 R2');
  if (crop !== 'window') throw new AnyCutError(2, 'invalid_crop', 'v0.1 helper 捕获整个窗口；client 裁剪列为 R2');
  const listed = await callWindowsHelper({ op: 'list', filter: app }, { timeoutMs });
  const windows = listed.control.windows ?? [];
  const chosen = window ? windows.find((item) => item.hwnd === window) : windows.length === 1 ? windows[0] : null;
  if (!chosen) throw new AnyCutError(2, 'window_ambiguous', '无法唯一确定窗口；请传 --window');
  let treed;
  try {
    treed = await callWindowsHelper({ op: 'tree', hwnd: chosen.hwnd }, { timeoutMs });
  } catch (error) {
    throw new AnyCutError(5, 'tree_failed', `UIA 树不可用，拒绝无树捕获（${error.code ?? error.message}）`);
  }
  if (!Array.isArray(treed.tree) || treed.tree.length === 0) throw new AnyCutError(5, 'tree_failed', 'UIA 树为空，拒绝无树捕获');
  const planned = planMasks(treed.tree);
  const masksForHelper = planned.masks.map(({ x, y, width, height }) => ({ x, y, width, height }));
  const captured = await callWindowsHelper({ op: 'capture', hwnd: chosen.hwnd, backend: 'printwindow', masks: masksForHelper }, { timeoutMs });
  if ((captured.control.masks_applied ?? -1) !== masksForHelper.length) throw new AnyCutError(5, 'mask_count_mismatch', 'helper 遮盖数量与请求不一致');
  const origin = { x: chosen.bounds_px.x, y: chosen.bounds_px.y };
  verifyMasks(captured.frame, rebaseMasks(planned.masks, origin));
  const treeNote = treed.control.truncated ? 'UIA 树截断 partial' : 'UIA 控制视图全树';
  return writeShadowBundle({
    outRoot, purpose, ttl, crop: 'window', backend: 'printwindow', screenshot: captured.frame,
    adapter: 'windows-native', coordinate_origin: origin, masksApplied: masksForHelper,
    treeStatus: treed.control.truncated ? 'partial' : 'complete',
    capture: {
      subject: {
        app_id: app, app_name: chosen.title, app_version: null, platform: 'windows', os_version: 'Windows 11',
        locale: 'zh-CN', processes: [{ pid: chosen.pid, image_name: chosen.image_name ?? 'unknown.exe', image_sha256: null }],
        window: { hwnd: chosen.hwnd, owner_pid: chosen.pid, title: chosen.title, bounds_px: chosen.bounds_px, dpi: chosen.dpi ?? 96 },
      },
      nodes: treed.tree,
      process_identity: { image_path: chosen.image_path ?? '', strategy: 'K32GetModuleFileNameExW@capture-time', reverify: 'R2' },
      known_limitations: [treeNote, '进程身份捕获时核验，启动时间/捕获后复核待 R2'],
    },
  });
}

/** 会话目标身份一致性：hwnd+owner_pid+image_name 三 anchored，任一漂移即拒绝组会话。 */
export function assertSessionIdentity(shadows) {
  if (!shadows?.length) throw new AnyCutError(2, 'empty_session', 'record 至少需要 1 帧');
  const key = (shadow) => {
    const window = shadow?.subject?.window ?? {};
    const process = shadow?.subject?.processes?.[0] ?? {};
    return `${window.hwnd}|${window.owner_pid}|${process.image_name}`;
  };
  const first = key(shadows[0]);
  shadows.forEach((shadow, index) => {
    if (key(shadow) !== first) throw new AnyCutError(5, 'session_identity_changed', `第 ${index} 帧目标身份变化，拒绝组会话`);
  });
  return { hwnd: shadows[0].subject.window.hwnd, frames: shadows.length };
}

/** 会话到期上限：首帧 created_at + ttl，录制不延长任何帧的保留期。 */
export function sessionExpiry(firstCreatedAt, ttl = '1h') {
  const seconds = ttlSeconds(ttl);
  return new Date(Date.parse(firstCreatedAt) + seconds * 1000).toISOString();
}

export async function recordSession({ app, window, purpose, ttl = '1h', frames = 3, intervalMs = 1500, timeoutMs = 15000, outRoot, onFrame }) {
  if (!outRoot) throw new AnyCutError(2, 'missing_capture_argument', 'record 需要 --out');
  const count = Number(frames);
  if (!Number.isInteger(count) || count < 1 || count > 25) throw new AnyCutError(2, 'invalid_frames', 'record 帧数必须为 1–25');
  const sessionId = `${new Date().toISOString().slice(0, 10)}-${String(Date.now() % 100000).padStart(5, '0')}`;
  const sessionDir = join(outRoot, 'sessions', sessionId);
  await mkdir(sessionDir, { recursive: true });
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, Number(intervalMs)));
    if (onFrame) await onFrame(index);
    const { runDir, shadow } = await captureFrame({ app, window, purpose: `${purpose}（第${index + 1}/${count}帧）`, ttl, timeoutMs, outRoot: join(sessionDir, `frame-${index}`) });
    entries.push({ index, run_dir: runDir, shadow_id: shadow.shadow_id, captured_at: shadow.created_at });
  }
  // 目标身份一致性在落盘后复核（帧内已各自 fail-closed）。
  const validated = [];
  for (const entry of entries) {
    const { shadow } = await validateShadow(entry.run_dir, { checkExpiry: false });
    validated.push(shadow);
    entry.shadow_id = shadow.shadow_id;
    entry.captured_at = shadow.created_at;
  }
  const identity = assertSessionIdentity(validated);
  const session = {
    format: 'anycut.record-session', spec_version: '0.1.0', session_id: sessionId,
    subject: { app_id: app, hwnd: identity.hwnd },
    frames: entries,
    session_expires_at: sessionExpiry(validated[0].created_at, ttl),
    ttl_seconds: ttlSeconds(ttl),
    keyboard_captured: false, other_apps_captured: false,
    created_at: new Date().toISOString(),
  };
  await writeFile(join(sessionDir, 'session.json'), `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  return { sessionDir, session };
}

async function loadSession(sessionDir) {
  let session;
  try {
    session = JSON.parse(await readFile(join(sessionDir, 'session.json'), 'utf8'));
  } catch {
    throw new AnyCutError(6, 'missing_session', 'record 会话不存在或已损坏');
  }
  if (session.format !== 'anycut.record-session') throw new AnyCutError(6, 'invalid_session', '不是合法 record 会话');
  return session;
}

/**
 * tutorial 引用校验：步骤引用的帧与节点必须存在且未到期；无证据步骤只能写
 * “界面发生变化”/“人工说明”，绝不补写点击。
 */
export async function validateTutorialRefs(sessionDir, steps, { now = new Date() } = {}) {
  const session = await loadSession(sessionDir);
  const byIndex = new Map(session.frames.map((frame) => [frame.index, frame]));
  const checked = [];
  for (const step of steps ?? []) {
    if (!step.ref) {
      if (!/界面发生变化|人工说明/.test(step.text ?? '')) {
        throw new AnyCutError(2, 'tutorial_evidence_required', `第 ${step.index} 步无引用，必须写“界面发生变化”或“人工说明”`);
      }
      checked.push({ index: step.index, ref: null });
      continue;
    }
    const match = String(step.ref).match(/^frame-(\d+)#nodes\/(.+)$/);
    if (!match) throw new AnyCutError(2, 'invalid_tutorial_ref', `第 ${step.index} 步引用格式非法: ${step.ref}`);
    const frame = byIndex.get(Number(match[1]));
    if (!frame) throw new AnyCutError(2, 'tutorial_ref_not_found', `第 ${step.index} 步引用帧不存在: ${step.ref}`);
    const { shadow } = await validateShadow(frame.run_dir, { now });
    const tree = JSON.parse(await readFile(join(frame.run_dir, 'ui-tree.json'), 'utf8'));
    if (!tree.nodes?.some((node) => node.node_id === match[2])) {
      throw new AnyCutError(2, 'tutorial_ref_not_found', `第 ${step.index} 步引用节点不存在: ${step.ref}`);
    }
    checked.push({ index: step.index, ref: step.ref, shadow_id: shadow.shadow_id });
  }
  return checked;
}

export async function buildTutorial(sessionDir, { title = '界面说明', format = 'md', steps = [], now } = {}) {
  const checked = await validateTutorialRefs(sessionDir, steps, { now: now ?? new Date() });
  const refOf = (index) => checked.find((item) => item.index === index)?.ref;
  const safe = String(title).replaceAll('<', '＜');
  if (format === 'html') {
    const items = steps.map((step) => {
      const ref = refOf(step.index);
      return `<h2>步骤 ${step.index + 1}</h2><p>${String(step.text).replaceAll('<', '&lt;')}</p><p>${ref ? `证据：${ref}` : '（人工说明，无界面证据）'}</p>`;
    }).join('\n');
    return { file: 'tutorial.html', body: `<!doctype html><meta charset="utf-8"><title>${safe}</title><h1>${safe}</h1>${items}` };
  }
  const lines = [`# ${safe}`, ''];
  for (const step of steps) {
    const ref = refOf(step.index);
    lines.push(`## 步骤 ${step.index + 1}`, '', step.text, '', ref ? `证据：${ref}` : '（人工说明，无界面证据）', '');
  }
  return { file: 'tutorial.md', body: `${lines.join('\n')}\n` };
}

export async function listSessionFrames(sessionDir) {
  const session = await loadSession(sessionDir);
  const frames = [];
  for (const frame of session.frames) {
    const runs = await readdir(join(frame.run_dir)).catch(() => []);
    frames.push({ ...frame, artifacts_present: runs });
  }
  return { session_id: session.session_id, frames };
}
