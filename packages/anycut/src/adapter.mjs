import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AnyCutError } from './core.mjs';

const MAX_CONTROL_BYTES = 64 * 1024;
const MAX_FRAME_BYTES = 64 * 1024 * 1024;

export function helperPath(repoRoot = process.cwd()) {
  const name = process.platform === 'win32' ? 'anycut-windows.exe' : 'anycut-windows';
  return join(repoRoot, 'target', 'debug', name);
}

/** Send one UTF-8 JSON line. Capture replies use JSON line then exact binary frame bytes. */
export async function callWindowsHelper(message, { executable = helperPath(), timeoutMs = 15_000 } = {}) {
  if (!existsSync(executable)) throw new AnyCutError(5, 'helper_missing', 'Windows helper 未构建');
  const encoded = Buffer.from(JSON.stringify(message), 'utf8');
  if (encoded.length > MAX_CONTROL_BYTES) throw new AnyCutError(2, 'control_message_too_large', '控制消息超过长度上限');
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const chunks = []; let stderr = ''; let settled = false; let received = 0;
    const done = (fn, value) => { if (!settled) { settled = true; clearTimeout(timer); fn(value); } };
    const timer = setTimeout(() => { child.kill(); done(reject, new AnyCutError(5, 'helper_timeout', 'Windows helper 超时且已终止')); }, timeoutMs);
    // Memory-exhaustion guard: stop buffering the moment the cap is exceeded,
    // instead of accumulating an unbounded stdout and checking only at close.
    child.stdout.on('data', (chunk) => { received += chunk.length; if (received > MAX_FRAME_BYTES + MAX_CONTROL_BYTES) { child.kill(); done(reject, new AnyCutError(5, 'helper_output_overflow', 'helper 输出超过帧上限')); return; } chunks.push(chunk); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); if (stderr.length > MAX_CONTROL_BYTES) { child.kill(); done(reject, new AnyCutError(5, 'helper_output_overflow', 'helper stderr 超过上限')); } });
    child.on('error', () => done(reject, new AnyCutError(5, 'helper_spawn_failed', '无法启动 Windows helper')));
    child.on('close', () => {
      const bytes = Buffer.concat(chunks); const newline = bytes.indexOf(0x0a);
      if (newline < 0 || newline > MAX_CONTROL_BYTES) return done(reject, new AnyCutError(5, 'helper_protocol_error', 'helper 未返回受限 JSON 控制消息'));
      try {
        const control = JSON.parse(bytes.subarray(0, newline).toString('utf8'));
        const frame = bytes.subarray(newline + 1);
        if (control.frame_bytes !== undefined && (control.frame_bytes !== frame.length || frame.length > MAX_FRAME_BYTES)) throw new Error('frame length');
        if (!control.ok) return done(reject, new AnyCutError(5, control.code ?? 'helper_failed', 'Windows helper 捕获失败'));
        done(resolve, { control, frame, stderr });
      } catch { done(reject, new AnyCutError(5, 'helper_protocol_error', 'helper 返回非法协议')); }
    });
    child.stdin.end(Buffer.concat([encoded, Buffer.from('\n')]));
  });
}
