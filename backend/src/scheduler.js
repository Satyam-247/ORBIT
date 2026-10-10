import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function runScheduler(algorithm, processes) {
  return new Promise((resolve, reject) => {
    const schedulerPath = path.resolve(__dirname, '..', process.env.SCHEDULER_PATH || '../scheduler/scheduler.exe');
    const child = spawn(schedulerPath, [], { windowsHide: true });
    let out='', err='';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(err || `Scheduler exited with ${code}`));
      try { resolve(JSON.parse(out)); } catch { reject(new Error(`Bad scheduler output: ${out}`)); }
    });
    child.stdin.write(`${algorithm}\n${processes.length}\n`);
    for (const p of processes) child.stdin.write(`${p.id},${p.arrival},${p.burst},${p.priority}\n`);
    child.stdin.end();
  });
}
