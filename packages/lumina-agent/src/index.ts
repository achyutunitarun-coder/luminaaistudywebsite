#!/usr/bin/env node
// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve, relative } from 'path';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

const CONFIG_DIR = join(homedir(), '.lumina');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try { if (!existsSync(CONFIG_FILE)) return null; return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch { return null; }
}
function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function onboarding() {
  console.log('');
  console.log('  ⚡ LUMINA CODE — AI Coding Agent');
  console.log('  Better than Claude Code. Better than Codex.');
  console.log('');
  console.log('  Welcome! Let\'s get you set up.');
  console.log('');

  const apiKey = await ask('  Enter your OpenRouter API key: ');
  if (!apiKey.trim() || apiKey.trim().length < 10) {
    console.log('  ❌ Invalid API key. Please try again.');
    process.exit(1);
  }

  const name = await ask('  What should I call you? (optional): ');

  saveConfig({ openrouterKey: apiKey.trim(), userName: name.trim() || 'User' });
  console.log('');
  console.log('  ✓ Setup complete! Let\'s build something amazing.');
  console.log('');
}

async function chat(config) {
  console.log('  Type what you want to build. I\'ll handle the rest.');
  console.log('  Commands: /help /clear /exit');
  console.log('');

  let messages = [];

  while (true) {
    const input = await ask('  > ');
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === '/exit' || trimmed === '/quit') break;
    if (trimmed === '/clear') { messages = []; console.log('  ✓ Cleared.'); continue; }
    if (trimmed === '/help') {
      console.log('  Commands: /help /clear /exit');
      continue;
    }

    messages.push({ role: 'user', content: trimmed });
    console.log('');

    try {
      const tools = [
        { type: 'function', function: { name: 'run_command', description: 'Run any shell command', parameters: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' }, timeout: { type: 'number' } }, required: ['command'] } } },
        { type: 'function', function: { name: 'read_file', description: 'Read file contents', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
        { type: 'function', function: { name: 'write_file', description: 'Create or overwrite a file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
        { type: 'function', function: { name: 'edit_file', description: 'Make precise edits to a file', parameters: { type: 'object', properties: { path: { type: 'string' }, search: { type: 'string' }, replace: { type: 'string' } }, required: ['path', 'search', 'replace'] } } },
        { type: 'function', function: { name: 'list_dir', description: 'List directory contents', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
        { type: 'function', function: { name: 'search_files', description: 'Find files by pattern', parameters: { type: 'object', properties: { pattern: { type: 'string' }, cwd: { type: 'string' } }, required: ['pattern'] } } },
        { type: 'function', function: { name: 'grep', description: 'Search file contents', parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern', 'path'] } } },
        { type: 'function', function: { name: 'git', description: 'Run git commands', parameters: { type: 'object', properties: { args: { type: 'string' }, cwd: { type: 'string' } }, required: ['args'] } } },
        { type: 'function', function: { name: 'npm', description: 'Run npm/yarn/pnpm/bun commands', parameters: { type: 'object', properties: { args: { type: 'string' }, cwd: { type: 'string' } }, required: ['args'] } } },
        { type: 'function', function: { name: 'deploy', description: 'Deploy to Vercel', parameters: { type: 'object', properties: { target: { type: 'string' }, cwd: { type: 'string' } } } } },
      ];

      let iterations = 0;
      const maxIterations = 30;
      let currentMessages = [...messages];

      while (iterations < maxIterations) {
        iterations++;
        process.stdout.write(`  ⏳ Working (step ${iterations})...\r`);

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.openrouterKey}`, 'HTTP-Referer': 'https://luminaai.co.in', 'X-Title': 'Lumina Code' },
          body: JSON.stringify({
            model: 'openrouter/owl-alpha',
            messages: [{ role: 'system', content: `You are LUMINA CODE — an elite AI coding agent.

WORKFLOW:
1. PLAN: Analyze the task. Create a brief plan.
2. ACT: Execute tools step by step. Read before writing.
3. VERIFY: Run builds, check for errors.
4. FIX: If something fails, debug and fix immediately.
5. DEPLOY: If requested, deploy automatically.

QUALITY: Production-grade code. No placeholders. No TODOs. No emoji in code.
Handle errors. TypeScript. Responsive. Accessible. Clean architecture.

FORBIDDEN: lorem ipsum, TODO comments, emoji in code, var keyword, any type, skipping error handling, hardcoded secrets.

When using a tool, output ONLY:
TOOL: <name>
PARAMS: <json>

Working directory: ${process.cwd()}` }, ...currentMessages],
            tools,
            stream: false,
            max_tokens: 32000,
            temperature: 0.1,
          }),
        });

        if (!res.ok) {
          const err = await res.text().catch(() => '');
          throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`);
        }

        const data = await res.json();
        const choice = data.choices?.[0];
        if (!choice) throw new Error('No response from model');

        const content = choice.message?.content || '';
        const toolCalls = choice.message?.tool_calls || [];

        currentMessages.push({ role: 'assistant', content });

        if (toolCalls.length === 0) {
          messages = currentMessages;
          console.log('  ✓ ' + content.slice(0, 500));
          if (content.length > 500) console.log('  ...');
          console.log('');
          break;
        }

        for (const tc of toolCalls) {
          const args = JSON.parse(tc.function.arguments || '{}');
          const toolName = tc.function.name;
          console.log(`  ⚙ ${toolName}(${JSON.stringify(args).slice(0, 80)})`);

          let output = '';
          try {
            switch (toolName) {
              case 'run_command': {
                const cwd = args.cwd || process.cwd();
                output = execSync(args.command, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: args.timeout || 120000, shell: true }) || '(no output)';
                break;
              }
              case 'read_file': output = readFileSync(args.path, 'utf-8'); break;
              case 'write_file': {
                const dir = dirname(resolve(args.path));
                if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                writeFileSync(args.path, args.content, 'utf-8');
                output = `Wrote ${args.content.length} chars to ${args.path}`;
                break;
              }
              case 'edit_file': {
                let fc = readFileSync(args.path, 'utf-8');
                if (!fc.includes(args.search)) throw new Error(`Not found: "${args.search.slice(0, 50)}"`);
                fc = fc.replace(args.search, args.replace);
                writeFileSync(args.path, fc, 'utf-8');
                output = `Edited ${args.path}`;
                break;
              }
              case 'list_dir': output = readdirSync(args.path, { withFileTypes: true }).map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`).join('\n'); break;
              case 'search_files': {
                const results = [];
                const search = (dir, depth) => {
                  if (depth > 5) return;
                  try { for (const e of readdirSync(dir, { withFileTypes: true })) { if (e.name.startsWith('.') || e.name === 'node_modules') continue; const fp = join(dir, e.name); if (e.isDirectory()) search(fp, depth + 1); else if (new RegExp(args.pattern.replace(/\*/g, '.*'), 'i').test(e.name)) results.push(relative(args.cwd || process.cwd(), fp)); } } catch {}
                };
                search(args.cwd || process.cwd(), 0);
                output = results.join('\n') || 'No files found';
                break;
              }
              case 'grep': {
                const c = readFileSync(args.path, 'utf-8');
                output = c.split('\n').map((l, i) => new RegExp(args.pattern, 'gi').test(l) ? `${i + 1}: ${l}` : null).filter(Boolean).join('\n') || 'No matches';
                break;
              }
              case 'git': output = execSync(`git ${args.args}`, { cwd: args.cwd || process.cwd(), encoding: 'utf-8', maxBuffer: 1024 * 1024 }) || '(ok)'; break;
              case 'npm': {
                const pm = existsSync(join(args.cwd || process.cwd(), 'bun.lockb')) ? 'bun' : existsSync(join(args.cwd || process.cwd(), 'yarn.lock')) ? 'yarn' : 'npm';
                output = execSync(`${pm} ${args.args}`, { cwd: args.cwd || process.cwd(), encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120000 }) || '(ok)';
                break;
              }
              case 'deploy': output = execSync('npx vercel deploy --prod --yes', { cwd: args.cwd || process.cwd(), encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 300000 }) || '(deployed)'; break;
              default: output = `Unknown tool: ${toolName}`;
            }
          } catch (e) { output = `Error: ${e.message}`; }

          currentMessages.push({ role: 'tool', content: output.slice(0, 2000), tool_call_id: tc.id });
          console.log(`  ✓ ${output.slice(0, 100)}`);
        }
      }
    } catch (e) {
      console.log(`  ⚠ Error: ${e.message}`);
      console.log('');
    }
  }

  rl.close();
}

// ── Main ────────────────────────────────────────────────────────────
const config = loadConfig();
if (!config?.openrouterKey) {
  onboarding().then(() => {
    const newConfig = loadConfig();
    chat(newConfig).then(() => process.exit(0));
  });
} else {
  chat(config).then(() => process.exit(0));
}
