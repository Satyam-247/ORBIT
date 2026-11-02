import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_PROCESSES = 100;

export function runScheduler(algorithm, processes, timeQuantum = 2) {
  const allowed = new Set(['FCFS', 'SJF', 'PRIORITY', 'RR']);
  if (!allowed.has(algorithm)) return Promise.reject(new Error('Unsupported scheduling algorithm.'));
  if (!Array.isArray(processes) || processes.length < 1 || processes.length > MAX_PROCESSES) {
    return Promise.reject(new Error(`Scheduler requires between 1 and ${MAX_PROCESSES} processes.`));
  }
  for (const p of processes) {
    if (![p.id, p.arrival, p.burst, p.priority].every(Number.isSafeInteger) || p.id < 1 || p.arrival < 0 || p.burst < 1 || p.priority < 1 || p.priority > 5) {
      return Promise.reject(new Error('Invalid process data supplied to scheduler.'));
    }
  }
  const configured = process.env.SCHEDULER_PATH;
  const schedulerPath = configured
    ? path.resolve(process.cwd(), configured)
    : path.resolve(__dirname, '../../scheduler', process.platform === 'win32' ? 'scheduler.exe' : 'scheduler');
  const input = [`${algorithm}`, `${processes.length}`];
  if (algorithm === 'RR') input.push(String(timeQuantum));
  for (const p of processes) input.push(`${p.id},${p.arrival},${p.burst},${p.priority}`);

  return new Promise((resolve, reject) => {
    const child = spawn(schedulerPath, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false;
    const timeout = setTimeout(() => { child.kill(); finish(new Error('Scheduler timed out.')); }, 10000);
    function finish(error, value) {
      if (settled) return; settled = true; clearTimeout(timeout);
      if (error) reject(error); else resolve(value);
    }
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdin.on('error', error => finish(new Error(`Could not send input to scheduler: ${error.message}`)));
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 2_000_000) child.kill(); });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => finish(new Error(`Could not start scheduler at ${schedulerPath}: ${error.message}`)));
    child.on('close', code => {
      if (code !== 0) return finish(new Error(stderr.trim() || `Scheduler exited with code ${code}.`));
      try {
        const result = JSON.parse(stdout);
        if (!Array.isArray(result.results) || !Array.isArray(result.schedule)) throw new Error('Missing scheduler results.');
        finish(null, result);
      } catch (error) { finish(new Error(`Invalid scheduler output: ${error.message}`)); }
    });
    child.stdin.end(`${input.join('\n')}\n`);
  });
}
