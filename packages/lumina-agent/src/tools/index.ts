import { execSync, spawn } from 'cross-spawn';
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { glob } from 'glob';

// ── Shell Detection ──────────────────────────────────────────────────
export function getShell(): { cmd: string; args: string[] } {
  if (process.platform === 'win32') {
    return { cmd: 'cmd.exe', args: ['/c'] };
  }
  const shell = process.env.SHELL || '/bin/bash';
  return { cmd: shell, args: ['-c'] };
}

export function runCommand(command: string, cwd: string): { stdout: string; stderr: string; code: number } {
  const { cmd, args } = getShell();
  try {
    const result = execSync(command, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: result, stderr: '', code: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout?.toString() || '',
      stderr: e.stderr?.toString() || e.message || '',
      code: e.status || 1,
    };
  }
}

// ── File Tools ───────────────────────────────────────────────────────
export function readFile(path: string): string {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
  return readFileSync(path, 'utf-8');
}

export function writeFile(path: string, content: string) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

export function editFile(path: string, oldString: string, newString: string): void {
  const content = readFile(path);
  if (!content.includes(oldString)) {
    throw new Error(`String not found in ${path}: "${oldString.slice(0, 80)}..."`);
  }
  writeFile(path, content.replace(oldString, newString));
}

export function listDir(path: string): { name: string; isDir: boolean; size: number }[] {
  if (!existsSync(path)) throw new Error(`Directory not found: ${path}`);
  const entries = readdirSync(path, { withFileTypes: true });
  return entries.map(e => ({
    name: e.name,
    isDir: e.isDirectory(),
    size: e.isFile() ? statSync(join(path, e.name)).size : 0,
  }));
}

export function searchFiles(pattern: string, cwd: string): string[] {
  return glob.sync(pattern, { cwd, nodir: true });
}

export function grep(pattern: string, path: string): string[] {
  const content = readFile(path);
  const lines = content.split('\n');
  const regex = new RegExp(pattern, 'i');
  return lines
    .map((line, i) => ({ line, num: i + 1 }))
    .filter(({ line }) => regex.test(line))
    .map(({ line, num }) => `${num}: ${line}`);
}

// ── Git Tools ────────────────────────────────────────────────────────
export function git(args: string, cwd: string): string {
  const { stdout, stderr, code } = runCommand(`git ${args}`, cwd);
  if (code !== 0) throw new Error(stderr || `git ${args} failed`);
  return stdout.trim();
}

// ── Npm Tools ────────────────────────────────────────────────────────
export function npm(args: string, cwd: string): string {
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const { stdout, stderr, code } = runCommand(`${cmd} ${args}`, cwd);
  if (code !== 0) throw new Error(stderr || `npm ${args} failed`);
  return stdout.trim();
}

// ── Deploy Tools ─────────────────────────────────────────────────────
export function deployVercel(cwd: string): string {
  const { stdout, stderr, code } = runCommand('npx vercel deploy --prod --yes', cwd);
  if (code !== 0) throw new Error(stderr || 'Vercel deploy failed');
  // Extract URL from output
  const urlMatch = stdout.match(/https:\/\/[a-z0-9-]+\.vercel\.app/);
  return urlMatch ? urlMatch[0] : stdout.trim();
}
