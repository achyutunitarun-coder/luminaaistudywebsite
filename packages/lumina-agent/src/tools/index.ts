// @ts-nocheck
/**
 * LUMINA CODE — The Ultimate AI Coding Agent
 * 
 * Better than Claude Code. Better than Codex. Better than Cursor.
 * 
 * Architecture:
 * - Single model: openrouter/owl-alpha (best reasoning, 1M+ context)
 * - Effort levels: quick, normal, beast
 * - Full filesystem access
 * - Multi-file operations
 * - Self-healing code
 * - Automatic deployment
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, unlinkSync, renameSync, copyFileSync } from 'fs';
import { join, basename, dirname, resolve, relative } from 'path';
import { homedir } from 'os';

// ── Shell Detection ─────────────────────────────────────────────────
export function getShell(): string {
  if (process.platform === 'win32') return process.env.COMSPEC || 'cmd.exe';
  return process.env.SHELL || '/bin/bash';
}

export function detectOS(): { os: 'windows' | 'mac' | 'linux'; arch: string } {
  const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';
  return { os, arch: process.arch };
}

// ── Command Execution ───────────────────────────────────────────────
export function runCommand(command: string, cwd: string, timeout = 120_000): { stdout: string; stderr: string; code: number } {
  try {
    const result = execSync(command, {
      cwd, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024, timeout,
      stdio: ['pipe', 'pipe', 'pipe'], shell: getShell(),
      env: { ...process.env, PYTHONUNBUFFERED: '1', FORCE_COLOR: '0' },
    });
    return { stdout: result, stderr: '', code: 0 };
  } catch (e: any) {
    return { stdout: e.stdout?.toString() || '', stderr: e.stderr?.toString() || e.message || '', code: e.status || 1 };
  }
}

export function runCommandStreaming(command: string, cwd: string, onOutput: (text: string) => void): Promise<number> {
  return new Promise((resolve) => {
    const shell = getShell();
    const child = spawn(command, { cwd, shell, stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    child.stdout?.on('data', (d) => onOutput(d.toString()));
    child.stderr?.on('data', (d) => onOutput(d.toString()));
    child.on('close', (code) => resolve(code || 0));
    child.on('error', () => resolve(1));
  });
}

// ── File Operations ─────────────────────────────────────────────────
export function readFile(path: string): string {
  if (!existsSync(path)) throw new Error('File not found: ' + path);
  return readFileSync(path, 'utf-8');
}

export function writeFile(path: string, content: string) {
  const dir = dirname(resolve(path));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, 'utf-8');
}

export function editFile(path: string, replacements: Array<{ search: string; replace: string }>): void {
  let content = readFile(path);
  for (const { search, replace } of replacements) {
    if (!content.includes(search)) throw new Error('String not found in ' + path + ': "' + search.slice(0, 80) + '"');
    content = content.replace(search, replace);
  }
  writeFile(path, content);
}

export function deleteFile(path: string) {
  if (existsSync(path)) unlinkSync(path);
}

export function moveFile(from: string, to: string) {
  const dir = dirname(resolve(to));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  renameSync(from, to);
}

export function copyFile(from: string, to: string) {
  const dir = dirname(resolve(to));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  copyFileSync(from, to);
}

export function listDir(path: string): { name: string; isDir: boolean; size: number; modified: number }[] {
  if (!existsSync(path)) throw new Error('Directory not found: ' + path);
  return readdirSync(path, { withFileTypes: true }).map(e => {
    const p = join(path, e.name);
    const stat = statSync(p);
    return { name: e.name, isDir: e.isDirectory(), size: stat.size, modified: stat.mtimeMs };
  });
}

export function searchFiles(pattern: string, cwd: string): string[] {
  // Simple glob-like search using fs
  const results: string[] = [];
  const searchDir = (dir: string, depth: number) => {
    if (depth > 5) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath, depth + 1);
        } else {
          // Simple pattern matching
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
          if (regex.test(entry.name)) {
            results.push(relative(cwd, fullPath));
          }
        }
      }
    } catch { /* ignore */ }
  };
  searchDir(cwd, 0);
  return results;
}

export function grep(pattern: string, path: string, context = 2): string[] {
  try {
    const content = readFile(path);
    const lines = content.split('\n');
    const regex = new RegExp(pattern, 'gi');
    const results: string[] = [];
    lines.forEach((line, i) => {
      if (regex.test(line)) {
        const start = Math.max(0, i - context);
        const end = Math.min(lines.length, i + context + 1);
        results.push(lines.slice(start, end).map((l, j) => `${start + j + 1}: ${l}`).join('\n'));
      }
    });
    return results;
  } catch { return []; }
}

export function getFileTree(path: string, depth = 3, prefix = ''): string {
  if (depth === 0) return '';
  const entries = listDir(path).filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist');
  return entries.map((e, i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';
    let line = prefix + connector + e.name + (e.isDir ? '/' : ` (${formatSize(e.size)})`);
    if (e.isDir) line += '\n' + getFileTree(join(path, e.name), depth - 1, prefix + childPrefix);
    return line;
  }).join('\n');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

// ── Git Operations ──────────────────────────────────────────────────
export function git(args: string, cwd: string): string {
  const { stdout, stderr, code } = runCommand('git ' + args, cwd);
  if (code !== 0) throw new Error(stderr || ('git ' + args + ' failed'));
  return stdout.trim();
}

export function gitStatus(cwd: string): string { return git('status --short', cwd); }
export function gitDiff(cwd: string): string { return git('diff', cwd); }
export function gitLog(cwd: string, n = 10): string { return git('log --oneline -' + n, cwd); }
export function gitCommit(message: string, cwd: string): string { return git('add -A && git commit -m "' + message.replace(/"/g, '\\"') + '"', cwd); }
export function gitPush(cwd: string): string { return git('push', cwd); }
export function gitBranch(cwd: string): string { return git('branch --show-current', cwd); }
export function gitCreateBranch(name: string, cwd: string): string { return git('checkout -b ' + name, cwd); }

// ── Package Manager ─────────────────────────────────────────────────
export function detectPackageManager(cwd: string): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  if (existsSync(join(cwd, 'bun.lockb')) || existsSync(join(cwd, 'bun.lock'))) return 'bun';
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

export function pkgInstall(packages: string[], cwd: string, dev = false): string {
  const pm = detectPackageManager(cwd);
  const cmd = pm === 'bun' ? 'bun add' : pm === 'yarn' ? 'yarn add' : pm === 'pnpm' ? 'pnpm add' : 'npm install';
  const flag = dev ? (pm === 'yarn' ? ' -D' : ' --save-dev') : '';
  return runCommand(`${cmd}${flag} ${packages.join(' ')}`, cwd).stdout;
}

export function pkgRun(script: string, cwd: string): string {
  const pm = detectPackageManager(cwd);
  const cmd = pm === 'bun' ? 'bun run' : pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : 'npm run';
  return runCommand(`${cmd} ${script}`, cwd).stdout;
}

// ── Deployment ──────────────────────────────────────────────────────
export function deployVercel(cwd: string): string {
  const { stdout, stderr, code } = runCommand('npx vercel deploy --prod --yes', cwd, 300_000);
  if (code !== 0) throw new Error(stderr || 'Vercel deploy failed');
  const urlMatch = stdout.match(/https:\/\/[a-z0-9-]+\.vercel\.app/);
  return urlMatch ? urlMatch[0] : stdout.trim();
}

export function deployNetlify(cwd: string): string {
  const { stdout, stderr, code } = runCommand('npx netlify deploy --prod --dir=dist', cwd, 300_000);
  if (code !== 0) throw new Error(stderr || 'Netlify deploy failed');
  return stdout.trim();
}

// ── Project Detection ───────────────────────────────────────────────
export function detectProjectType(cwd: string): Record<string, boolean> {
  return {
    react: existsSync(join(cwd, 'package.json')) && (readFileSync(join(cwd, 'package.json'), 'utf-8').includes('"react"') || existsSync(join(cwd, 'src/App.tsx')) || existsSync(join(cwd, 'src/App.jsx'))),
    nextjs: existsSync(join(cwd, 'next.config.js')) || existsSync(join(cwd, 'next.config.ts')) || existsSync(join(cwd, 'next.config.mjs')),
    vite: existsSync(join(cwd, 'vite.config.ts')) || existsSync(join(cwd, 'vite.config.js')),
    typescript: existsSync(join(cwd, 'tsconfig.json')),
    tailwind: existsSync(join(cwd, 'tailwind.config.ts')) || existsSync(join(cwd, 'tailwind.config.js')),
    node: existsSync(join(cwd, 'package.json')),
    python: existsSync(join(cwd, 'requirements.txt')) || existsSync(join(cwd, 'pyproject.toml')) || existsSync(join(cwd, 'setup.py')),
    rust: existsSync(join(cwd, 'Cargo.toml')),
    go: existsSync(join(cwd, 'go.mod')),
    docker: existsSync(join(cwd, 'Dockerfile')),
  };
}

// ── LLM API ─────────────────────────────────────────────────────────
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export async function callLLM(
  apiKey: string,
  messages: Message[],
  tools?: object[],
  onChunk?: (text: string) => void,
  model = 'openrouter/owl-alpha',
): Promise<{ content: string; toolCalls: ToolCall[]; tokens: number }> {
  const keys = [apiKey, ...(process.env.OPENROUTER_API_KEY ? [process.env.OPENROUTER_API_KEY] : [])].filter(Boolean);
  
  for (const key of keys) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': 'https://luminaai.co.in',
          'X-Title': 'Lumina Code',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => m.role === 'tool' ? { role: 'tool', content: m.content, tool_call_id: m.tool_call_id } : { role: m.role, content: m.content }),
          tools: tools || undefined,
          stream: true,
          max_tokens: 32000,
          temperature: 0.1,
        }),
      });

      if (!res.ok) { const err = await res.text().catch(() => ''); console.error(`Model error ${res.status}: ${err.slice(0, 200)}`); continue; }

      const reader = res.body?.getReader();
      if (!reader) continue;

      const decoder = new TextDecoder();
      let buf = '', content = '', toolCalls: ToolCall[] = [], tokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed?.choices?.[0]?.delta;
            if (delta?.content) { content += delta.content; onChunk?.(delta.content); }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = toolCalls.length;
                if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id || '', type: 'function', function: { name: tc.function?.name || '', arguments: '' } };
                if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
            if (parsed.usage?.total_tokens) tokens = parsed.usage.total_tokens;
          } catch { buf = line + '\n' + buf; break; }
        }
      }

      if (content || toolCalls.length > 0) return { content, toolCalls, tokens };
    } catch (e) { console.error('LLM call failed:', e); continue; }
  }

  throw new Error('All LLM calls failed');
}
