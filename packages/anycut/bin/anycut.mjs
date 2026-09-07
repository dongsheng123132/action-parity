#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { writeShadowBundle, AnyCutError, planMasks, rebaseMasks, verifyMasks } from '../src/core.mjs';
import { inspectRun, validateShadow } from '../src/inspect.mjs';
import { listAuditors, runAudit } from '../src/audit.mjs';
import { callWindowsHelper } from '../src/adapter.mjs';

function parse(argv) {
  const positionals = []; const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) { positionals.push(token); continue; }
    const key = token.slice(2);
    if (['json', 'no-input', 'strict', 'prepare'].includes(key)) { flags[key] = true; continue; }
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new AnyCutError(2, 'missing_option_value', `--${key} 缺少值`);
    flags[key] = value;
  }
  return { positionals, flags };
}
const defaultOut = () => join(process.env.LOCALAPPDATA ?? process.cwd(), 'AnyCut');
const respond = (data, exitCode = 0) => { process.stdout.write(`${JSON.stringify({ ok: exitCode === 0, data: data ?? null, error: exitCode ? { code: data?.code ?? 'failed', message: data?.message ?? '命令失败', retryable: exitCode === 5 } : null })}\n`); process.exitCode = exitCode; };

async function capture(flags) {
  if (!flags.app || !flags.purpose) throw new AnyCutError(2, 'missing_capture_argument', 'capture 需要 --app 和 --purpose');
  if (flags.redact && flags.redact !== 'auto') throw new AnyCutError(2, 'invalid_redact', 'v0.1 只支持 --redact auto');
  // B1 companion fix: do not accept a backend the helper cannot honour —
  // recording "wgc" while capturing via PrintWindow would produce a lying bundle.
  const backend = flags.backend ?? 'printwindow';
  if (backend !== 'printwindow') throw new AnyCutError(2, 'invalid_backend', 'v0.1 helper 仅实现 printwindow；wgc 列为 R2');
  if (flags.crop && flags.crop !== 'window') throw new AnyCutError(2, 'invalid_crop', 'v0.1 helper 捕获整个窗口；client 裁剪列为 R2');
  const listed = await callWindowsHelper({ op: 'list', filter: flags.app }, { timeoutMs: Number(flags.timeout ?? 15000) });
  const windows = listed.control.windows ?? [];
  const chosen = flags.window ? windows.find((item) => item.hwnd === flags.window) : windows.length === 1 ? windows[0] : null;
  if (!chosen) throw new AnyCutError(2, 'window_ambiguous', '无法唯一确定窗口；请传 --window');
  const timeoutMs = Number(flags.timeout ?? 15000);
  // UIA 真树：不可用即拒绝无树捕获（fail closed——像素无法定位即不可证明脱敏）。
  let treed;
  try {
    treed = await callWindowsHelper({ op: 'tree', hwnd: chosen.hwnd }, { timeoutMs });
  } catch (error) {
    throw new AnyCutError(5, 'tree_failed', `UIA 树不可用，拒绝无树捕获（${error.code ?? error.message}）`);
  }
  if (!Array.isArray(treed.tree) || treed.tree.length === 0) throw new AnyCutError(5, 'tree_failed', 'UIA 树为空，拒绝无树捕获');
  const planned = planMasks(treed.tree);
  const masksForHelper = planned.masks.map(({ x, y, width, height }) => ({ x, y, width, height }));
  // C1 partial process identity: helper now reports the owning process's real
  // exe path. The bundle stores only the public image name (privacy: no user
  // names / directories) while the path is hashed into the verification
  // material below; full startup-time re-verification lands in R2.
  const captured = await callWindowsHelper({ op: 'capture', hwnd: chosen.hwnd, backend: 'printwindow', masks: masksForHelper }, { timeoutMs });
  if ((captured.control.masks_applied ?? -1) !== masksForHelper.length) throw new AnyCutError(5, 'mask_count_mismatch', 'helper 遮盖数量与请求不一致');
  const origin = { x: chosen.bounds_px.x, y: chosen.bounds_px.y };
  verifyMasks(captured.frame, rebaseMasks(planned.masks, origin));
  const treeNote = treed.control.truncated ? 'UIA 树截断 partial' : 'UIA 控制视图全树';
  return writeShadowBundle({ outRoot: flags.out ?? defaultOut(), purpose: flags.purpose, ttl: flags.ttl ?? '1h', crop: 'window', backend: 'printwindow', screenshot: captured.frame, adapter: 'windows-native', coordinate_origin: origin, masksApplied: masksForHelper, treeStatus: treed.control.truncated ? 'partial' : 'complete', capture: { subject: { app_id: flags.app, app_name: chosen.title, app_version: null, platform: 'windows', os_version: 'Windows 11', locale: 'zh-CN', processes: [{ pid: chosen.pid, image_name: chosen.image_name ?? 'unknown.exe', image_sha256: null }], window: { hwnd: chosen.hwnd, owner_pid: chosen.pid, title: chosen.title, bounds_px: chosen.bounds_px, dpi: chosen.dpi ?? 96 } }, nodes: treed.tree, process_identity: { image_path: chosen.image_path ?? '', strategy: 'K32GetModuleFileNameExW@capture-time', reverify: 'R2' }, known_limitations: [treeNote, '进程身份捕获时核验，启动时间/捕获后复核待 R2'] } });
}

async function tutorial(run, flags) {
  const { shadow } = await validateShadow(run);
  const root = flags.out ?? join(resolve(run), 'tutorial');
  await mkdir(root, { recursive: true });
  const name = flags.format === 'html' ? 'tutorial.html' : 'tutorial.md';
  const title = flags.title ?? '界面说明';
  const body = flags.format === 'html' ? `<!doctype html><meta charset="utf-8"><title>${title.replaceAll('<', '&lt;')}</title><h1>${title.replaceAll('<', '&lt;')}</h1><p>界面发生变化前的观察说明。</p>` : `# ${title}\n\n界面说明：${shadow.subject.window.title}\n\n此文档不推断用户执行了操作。\n`;
  await writeFile(join(root, name), body, { encoding: 'utf8', flag: 'w' });
  return { file: join(root, name), shadow_id: shadow.shadow_id };
}

async function main() {
  const { positionals: p, flags } = parse(process.argv.slice(2));
  const command = p.shift();
  if (command === 'capture') return respond(await capture(flags));
  if (command === 'inspect') {
    if (flags.run) throw new AnyCutError(2, 'usage', '用法：anycut inspect <run> [--section tree|window|actions|state|regions]（run 为位置参数，不用 --run）');
    if (p[0] === 'shadow') {
      if (!p[1]) throw new AnyCutError(2, 'usage', '用法：anycut inspect [shadow] <run> [--section tree|window|actions|state|regions]');
      return respond(await validateShadow(p[1]));
    }
    if (!p[0]) throw new AnyCutError(2, 'usage', '用法：anycut inspect <run> [--section tree|window|actions|state|regions]');
    const strict = flags.strict === true;
    const outcome = await inspectRun(p[0], { section: flags.section, node: flags.node });
    // strict mode: a partial capture is a threshold failure (exit 7), per plan §7.8
    if (strict && (outcome.capture?.status === 'partial' || outcome.capture?.tree_status === 'partial' || outcome.capture?.tree_status === 'unavailable')) return respond(outcome, 7);
    return respond(outcome);
  }
  if (command === 'audit') {
    if (p[0] === 'adapters' && p[1] === 'list') return respond(listAuditors());
    if (p[0] === 'adapters') throw new AnyCutError(3, 'adapter_registry_restricted', 'v0.1 仅启用内置 auditor；第三方注册需要受限子进程');
    if (flags.run) throw new AnyCutError(2, 'usage', '用法：anycut audit <run> [--auditor builtin]（run 为位置参数，不用 --run）');
    if (!p[0]) throw new AnyCutError(2, 'usage', '用法：anycut audit <run> [--auditor builtin]');
    const outcome = await runAudit({ run: p[0], auditor: flags.auditor ?? 'builtin', ruleset: flags.ruleset ?? 'builtin-v0.1', failOn: flags['fail-on'] ?? 'high' });
    // Plan §7.8: audit completion and review verdict are separate — exit 7
    // still reports ok:true with the completed report; the exit code alone
    // expresses "threshold reached".
    return respond({ ok: true, report: outcome.report, threshold_reached: outcome.exitCode === 7 }, outcome.exitCode);
  }
  if (command === 'record') throw new AnyCutError(5, 'record_requires_live_capture', 'record 骨架已保留；需要 Windows 真机捕获验收');
  if (command === 'tutorial') return respond(await tutorial(p[0] ?? flags.run, flags));
  throw new AnyCutError(2, 'usage', '用法：anycut capture|inspect|audit|record|tutorial');
}
main().catch((error) => {
  const safe = error instanceof AnyCutError ? error : new AnyCutError(5, 'internal_error', 'AnyCut 未预期失败');
  respond({ code: safe.code, message: safe.message }, safe.exitCode);
});
