import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import readline from 'node:readline';

const TOOL_BLOCK_RE = /```tool\n([\s\S]*?)```/g;

export function parseToolBlocks(text) {
  const blocks = [];
  let match;
  while ((match = TOOL_BLOCK_RE.exec(text)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;

    const lines = raw.split('\n');
    const firstLine = lines[0].trim();
    const colonIdx = firstLine.indexOf(':');
    const operation = colonIdx > 0 ? firstLine.slice(0, colonIdx).trim() : null;
    const mainArg = colonIdx > 0 ? firstLine.slice(colonIdx + 1).trim() : firstLine;
    if (!operation) continue;

    blocks.push({
      operation,
      mainArg,
      parameters: parseKeyValues(lines.slice(1).join('\n').trim())
    });
  }
  return blocks;
}

function parseKeyValues(text) {
  const result = {};
  const sepIdx = text.indexOf('\n---\n');
  let kvText = text;
  let bodyText = '';

  if (sepIdx !== -1) {
    kvText = text.slice(0, sepIdx).trim();
    bodyText = text.slice(sepIdx + 5).trim();
  }

  for (const line of kvText.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      result[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
    }
  }

  if (bodyText) result._body = bodyText;
  return result;
}

function truncate(str, max = 2000) {
  if (!str || str.length <= max) return str || '';
  return str.slice(0, max) + '\n... (truncated, ' + str.length + ' chars total)';
}

function runToolRead(args, mainArg) {
  const filePath = args.file || mainArg;
  if (!filePath) return 'Error: no file path specified';
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return 'Error: file not found: ' + filePath;
  const content = fs.readFileSync(resolved, 'utf-8');
  const lines = content.split('\n');
  return lines.slice(0, 500).map((l, i) => `${i + 1}: ${l}`).join('\n');
}

function runToolWrite(args, mainArg) {
  const filePath = args.file || mainArg;
  const content = args._body || args.content;
  if (!filePath) return 'Error: no file path specified';
  if (!content) return 'Error: no content provided';
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(resolved, content, 'utf-8');
  return 'Written ' + content.length + ' bytes to ' + filePath;
}

function runToolEdit(args, mainArg) {
  const filePath = args.file || mainArg;
  const oldStr = args.old_string;
  const newStr = args.new_string;
  if (!filePath) return 'Error: no file path specified';
  if (!oldStr) return 'Error: no old_string provided';
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return 'Error: file not found: ' + filePath;
  const content = fs.readFileSync(resolved, 'utf-8');

  const count = content.split(oldStr).length - 1;
  if (count === 0) return 'Error: old_string not found in file';
  if (count > 1 && !args.replace_all) {
    return 'Error: found ' + count + ' matches. Use replace_all: true to replace all.';
  }

  const newContent = args.replace_all
    ? content.split(oldStr).join(newStr || '')
    : content.replace(oldStr, newStr || '');

  fs.writeFileSync(resolved, newContent, 'utf-8');
  return 'Edited ' + filePath + ' (' + count + ' occurrence(s) replaced)';
}

function runToolGrep(args, mainArg) {
  const pattern = args.pattern || mainArg;
  if (!pattern) return 'Error: no pattern specified';
  const searchPath = args.path || process.cwd();
  const include = args.include || '';

  const tryCmd = (cmd) => {
    try {
      const r = execSync(cmd, { encoding: 'utf-8', maxBuffer: 1024 * 1024, timeout: 15000 }).trim();
      return r || null;
    } catch { return null; }
  };

  let result = tryCmd(`rg -n "${pattern.replace(/"/g, '\\"')}" ${include ? '--glob "' + include + '"' : ''} "${searchPath}" 2>nul || cd .`);
  if (result === null) {
    result = tryCmd(`findstr /s /n "${pattern}" "${searchPath}\\${include || '*.*'}" 2>nul || cd .`);
  }
  if (result === null) {
    result = tryCmd(`powershell -Command "Get-ChildItem -Recurse -Filter '${include || '*.*'}' '${searchPath}' | Select-String -Pattern '${pattern.replace(/"/g, '""')}' | ForEach-Object { \\"$($$.Path):$($$.LineNumber): $($$.Line)\\" }" 2>nul || cd .`);
  }

  return truncate(result || 'No matches found for: ' + pattern, 5000);
}

async function runToolGlob(args, mainArg) {
  const pattern = args.pattern || mainArg;
  if (!pattern) return 'Error: no glob pattern specified';
  const searchPath = args.path || process.cwd();
  const fullPattern = path.join(searchPath, pattern).replace(/\\/g, '/');

  try {
    const r = execSync(`powershell -Command "Get-ChildItem -Path '${searchPath}' -Recurse -Filter '${path.basename(pattern)}' | ForEach-Object { $_.FullName }" 2>nul || cd .`, { encoding: 'utf-8', maxBuffer: 1024 * 1024, timeout: 15000 }).trim();
    if (r) return truncate(r, 3000);
  } catch {}

  try {
    const { globSync } = await import('glob');
    const files = globSync(fullPattern);
    if (files.length > 0) return truncate(files.join('\n'), 3000);
  } catch {}

  return 'No files matched: ' + pattern;
}

function runToolBash(args, mainArg) {
  const cmd = args.command || mainArg;
  if (!cmd) return 'Error: no command specified';

  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
      cwd: process.cwd(),
      windowsHide: true
    }).trim();
    return truncate(result || '(command completed with no output)', 5000);
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString().trim() : '';
    const stdout = e.stdout ? e.stdout.toString().trim() : '';
    return truncate(
      'Exit code: ' + e.status +
      (stdout ? '\n' + stdout : '') +
      (stderr ? '\nstderr:\n' + stderr : ''),
      5000
    );
  }
}

async function runToolQuestion(args, mainArg) {
  const question = args.question || mainArg || 'Proceed?';
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\n\x1b[33m[?]\x1b[0m ' + question + ' ', (answer) => {
      rl.close();
      resolve(answer || '(no response)');
    });
  });
}

const READONLY_TOOLS = new Set(['read', 'grep', 'glob']);

export async function executeTool(toolBlock) {
  const { operation, mainArg, parameters } = toolBlock;
  try {
    switch (operation) {
      case 'read': return runToolRead(parameters, mainArg);
      case 'write': return runToolWrite(parameters, mainArg);
      case 'edit': return runToolEdit(parameters, mainArg);
      case 'grep': return runToolGrep(parameters, mainArg);
      case 'glob': return await runToolGlob(parameters, mainArg);
      case 'bash': return runToolBash(parameters, mainArg);
      case 'question': return await runToolQuestion(parameters, mainArg);
      default: return 'Unknown tool: ' + operation + '. Available: read, write, edit, grep, glob, bash, question';
    }
  } catch (err) {
    return 'Tool error: ' + err.message;
  }
}

export async function executeToolBlocks(blocks, onStatus) {
  const results = [];
  const readonly = blocks.filter(b => READONLY_TOOLS.has(b.operation));
  const mutating = blocks.filter(b => !READONLY_TOOLS.has(b.operation));

  if (readonly.length > 0) {
    const tasks = readonly.map(async (block) => {
      const label = block.operation + '(' + (block.mainArg || '') + ')';
      if (onStatus) onStatus(label);
      const result = await executeTool(block);
      return { block, result, label };
    });
    const completed = await Promise.all(tasks);
    results.push(...completed);
  }

  for (const block of mutating) {
    const label = block.operation + '(' + (block.mainArg || '') + ')';
    if (onStatus) onStatus(label);
    const result = await executeTool(block);
    results.push({ block, result, label });
  }

  return results;
}

export const TOOL_DEFINITIONS = `
You have access to tools that let you interact with the filesystem and run commands. To use a tool, output a code block with language "tool":

\`\`\`tool
<operation>: <primary argument>
<key>: <value>
\`\`\`

CRITICAL RULES:
1. BATCH independent tool calls in ONE response — read, grep, and glob are parallel-safe and run simultaneously. Do NOT call them one at a time.
2. Tool preference order: read > grep > glob > bash. Use a dedicated tool before falling back to bash.
3. Always explain in text what you're doing between tool calls.

Available tools:

**read** — Read a file with line numbers.
\`\`\`tool
read: path/to/file
\`\`\`

**write** — Write content to a file (creates directories). Overwrites existing files.
\`\`\`tool
write: path/to/file
---
content
\`\`\`

**edit** — Replace text in a file (exact match). Add replace_all: true to replace all occurrences.
\`\`\`tool
edit: path/to/file
old_string: exact text
new_string: replacement
\`\`\`

**grep** — Search file contents with a regex pattern. Returns matches with line numbers.
\`\`\`tool
grep: <pattern>
path: <optional directory>
include: <optional file pattern>
\`\`\`

**glob** — Find files by name pattern.
\`\`\`tool
glob: **/*.js
path: <optional directory>
\`\`\`

**bash** — Execute a shell command.
\`\`\`tool
bash: <command>
\`\`\`

**question** — Ask the user when you need input.
\`\`\`tool
question: <what to ask>
\`\`\``;

export async function runAutoLoop(messages, provider, config, onStatus) {
  const MAX_ITERATIONS = 8;
  const budget = config.tokenBudget === 'unlimited' ? 8192 : Math.max(config.tokenBudget, 4096);
  const withRetry = async (fn, retries = 2) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try { return await fn(); } catch (err) {
        if (attempt === retries) throw err;
        const msg = err.message || '';
        if (msg.includes('429') || msg.includes('500') || msg.includes('503') || msg.includes('fetch') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET')) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
  };

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let full;
    try {
      full = await withRetry(() => provider.chat(messages, {
        model: config.defaultModel,
        maxTokens: budget,
        onToken: onStatus && i === 0 ? onStatus : undefined
      }));
    } catch (err) {
      return 'Error: ' + err.message;
    }

    const toolBlocks = parseToolBlocks(full);
    const noToolText = full.replace(TOOL_BLOCK_RE, '').trim();

    if (toolBlocks.length === 0) {
      if (noToolText) messages.push({ role: 'assistant', content: noToolText });
      return full;
    }

    if (noToolText) messages.push({ role: 'assistant', content: noToolText });
    messages.push({ role: 'assistant', content: full });

    const results = await executeToolBlocks(toolBlocks, (label) => {
      console.error('\n  \x1b[36m\u25B6\x1b[0m ' + label);
    });

    for (const { label, result } of results) {
      const lines = result.split('\n');
      const truncatedResult = lines.length > 80 ? lines.slice(0, 80).join('\n') + '\n... (truncated, ' + lines.length + ' lines total)' : result;
      messages.push({
        role: 'system',
        content: '[' + label + ']\n\n' + truncatedResult
      });
    }
  }

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  return lastAssistant ? lastAssistant.content : '(no output)';
}
