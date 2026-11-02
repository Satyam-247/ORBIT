import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function runBanker({ available, processes }) {
  if (!Array.isArray(available) || available.length < 1 || available.length > 10 ||
      !Array.isArray(processes) || processes.length < 1 || processes.length > 100) {
    return Promise.reject(new Error('Banker input must contain 1-100 processes and 1-10 resource types.'));
  }
  const resourceCount = available.length;
  if (!available.every((x) => Number.isSafeInteger(x) && x >= 0)) {
    return Promise.reject(new Error('Invalid available-resource vector.'));
  }
  const ids = new Set();
  for (const p of processes) {
    if (!Number.isSafeInteger(p.id) || p.id < 1 || ids.has(p.id) ||
        !Array.isArray(p.allocation) || !Array.isArray(p.maximum) ||
        p.allocation.length !== resourceCount || p.maximum.length !== resourceCount ||
        !p.allocation.every((x, i) => Number.isSafeInteger(x) && x >= 0 && Number.isSafeInteger(p.maximum[i]) && p.maximum[i] >= x)) {
      return Promise.reject(new Error('Invalid process allocation/maximum matrix.'));
    }
    ids.add(p.id);
  }
  const configured = process.env.DEADLOCK_PATH;
  const binary = configured ? path.resolve(process.cwd(), configured)
    : path.resolve(here, '../../scheduler', process.platform === 'win32' ? 'deadlock.exe' : 'deadlock');
  const lines = [`${processes.length} ${resourceCount}`, available.join(' ')];
  for (const p of processes) lines.push([p.id, ...p.allocation, ...p.maximum].join(' '));
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false;
    const timer = setTimeout(() => { child.kill(); finish(new Error('Deadlock checker timed out.')); }, 5000);
    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    }
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.length > 1_000_000) child.kill(); });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => finish(new Error(`Could not start deadlock checker at ${binary}: ${error.message}`)));
    child.on('close', (code) => {
      if (code !== 0) return finish(new Error(stderr.trim() || `Deadlock checker exited with code ${code}.`));
      try { finish(null, JSON.parse(stdout)); }
      catch (error) { finish(new Error(`Invalid deadlock checker output: ${error.message}`)); }
    });
    child.stdin.end(`${lines.join('\n')}\n`);
  });
}
