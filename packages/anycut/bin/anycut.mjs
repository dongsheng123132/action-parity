#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { AnyCutError } from '../src/core.mjs';
import { captureFrame, recordSession, buildTutorial, listSessionFrames } from '../src/record.mjs';
import { inspectRun, validateShadow } from '../src/inspect.mjs';
import { listAuditors, runAudit } from '../src/audit.mjs';

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
  const { runDir, shadow } = await captureFrame({
    app: flags.app, window: flags.window, purpose: flags.purpose, ttl: flags.ttl ?? '1h',
    timeoutMs: Number(flags.timeout ?? 15000), outRoot: flags.out ?? defaultOut(),
    backend: flags.backend ?? 'printwindow', crop: flags.crop ?? 'window',
  });
  return { runDir, shadow_id: shadow.shadow_id };
}

async function tutorial(run, flags) {
  if (flags.session) {
    const steps = flags.steps ? JSON.parse(flags.steps) : [];
    const built = await buildTutorial(flags.session, { title: flags.title ?? '界面说明', format: flags.format ?? 'md', steps });
    const root = flags.out ?? join(resolve(flags.session), 'tutorial');
    await mkdir(root, { recursive: true });
    await writeFile(join(root, built.file), built.body, { encoding: 'utf8', flag: 'w' });
    return { file: join(root, built.file), steps: steps.length };
  }
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
  if (command === 'record') {
    if (p[0] === 'sessions' && p[1] === 'list' && p[2]) return respond(await listSessionFrames(p[2]));
    if (!flags.app || !flags.purpose) throw new AnyCutError(2, 'missing_capture_argument', 'record 需要 --app 和 --purpose');
    return respond(await recordSession({
      app: flags.app, window: flags.window, purpose: flags.purpose, ttl: flags.ttl ?? '1h',
      frames: flags.frames ?? 3, intervalMs: flags.interval ?? 1500,
      timeoutMs: Number(flags.timeout ?? 15000), outRoot: flags.out ?? defaultOut(),
    }));
  }
  if (command === 'tutorial') return respond(await tutorial(p[0] ?? flags.run, flags));
  throw new AnyCutError(2, 'usage', '用法：anycut capture|inspect|audit|record|tutorial');
}
main().catch((error) => {
  const safe = error instanceof AnyCutError ? error : new AnyCutError(5, 'internal_error', 'AnyCut 未预期失败');
  respond({ code: safe.code, message: safe.message }, safe.exitCode);
});
