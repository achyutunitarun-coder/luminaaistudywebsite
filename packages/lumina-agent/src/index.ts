#!/usr/bin/env node
// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve, relative, basename, extname } from 'path';
import { createInterface } from 'readline';
import { execSync, exec } from 'child_process';

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
  console.log('');
  const apiKey = await ask('  Enter your OpenRouter API key: ');
  if (!apiKey.trim() || apiKey.trim().length < 10) {
    console.log('  ❌ Invalid API key.');
    process.exit(1);
  }
  const name = await ask('  Your name (optional): ');
  saveConfig({ openrouterKey: apiKey.trim(), userName: name.trim() || 'User' });
  console.log('  ✓ Ready!');
  console.log('');
}

// ── Tool Execution ──────────────────────────────────────────────────
async function executeTool(name, args, cwd) {
  const workDir = cwd || process.cwd();
  let output = '';

  try {
    switch (name) {
      case 'run_command': {
        const cmdCwd = args.cwd || workDir;
        output = execSync(args.command, { cwd: cmdCwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: args.timeout || 120000 }) || '(ok)';
        break;
      }
      case 'read_file': {
        const p = args.path.startsWith('/') ? args.path : join(workDir, args.path);
        if (!existsSync(p)) { output = `File not found: ${args.path}`; break; }
        output = readFileSync(p, 'utf-8');
        break;
      }
      case 'write_file': {
        const p = args.path.startsWith('/') ? args.path : join(workDir, args.path);
        const dir = dirname(resolve(p));
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(p, args.content, 'utf-8');
        output = `✓ Created ${args.path} (${args.content.length} chars)`;
        break;
      }
      case 'edit_file': {
        const p = args.path.startsWith('/') ? args.path : join(workDir, args.path);
        let fc = readFileSync(p, 'utf-8');
        if (!fc.includes(args.search)) throw new Error(`Not found: "${args.search.slice(0, 50)}"`);
        fc = fc.replace(args.search, args.replace);
        writeFileSync(p, fc, 'utf-8');
        output = `✓ Edited ${args.path}`;
        break;
      }
      case 'list_dir': {
        const p = args.path || workDir;
        const entries = readdirSync(p, { withFileTypes: true });
        output = entries.slice(0, 50).map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`).join('\n');
        break;
      }
      case 'search_files': {
        const results = [];
        const search = (dir, depth) => {
          if (depth > 5) return;
          try {
            for (const e of readdirSync(dir, { withFileTypes: true })) {
              if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
              const fp = join(dir, e.name);
              if (e.isDirectory()) search(fp, depth + 1);
              else if (new RegExp(args.pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i').test(e.name))
                results.push(relative(workDir, fp));
            }
          } catch {}
        };
        search(args.cwd || workDir, 0);
        output = results.join('\n') || 'No files found';
        break;
      }
      case 'grep': {
        const p = args.path.startsWith('/') ? args.path : join(workDir, args.path);
        const c = readFileSync(p, 'utf-8');
        output = c.split('\n').map((l, i) => new RegExp(args.pattern, 'gi').test(l) ? `${i + 1}: ${l}` : null).filter(Boolean).join('\n') || 'No matches';
        break;
      }
      case 'git': {
        output = execSync(`git ${args.args}`, { cwd: args.cwd || workDir, encoding: 'utf-8', maxBuffer: 1024 * 1024 }) || '(ok)';
        break;
      }
      case 'npm': {
        const pm = existsSync(join(args.cwd || workDir, 'bun.lockb')) ? 'bun' : existsSync(join(args.cwd || workDir, 'yarn.lock')) ? 'yarn' : 'npm';
        output = execSync(`${pm} ${args.args}`, { cwd: args.cwd || workDir, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120000 }) || '(ok)';
        break;
      }
      case 'deploy': {
        output = execSync('npx vercel deploy --prod --yes', { cwd: args.cwd || workDir, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 300000 }) || '(deployed)';
        break;
      }
      default:
        output = `Unknown tool: ${name}`;
    }
  } catch (e) {
    output = `Error: ${e.message}`;
  }

  return output;
}

// ── Chat Loop ───────────────────────────────────────────────────────
async function chat(config) {
  console.log('  Type what you want to build. I\'ll handle the rest.');
  console.log('  Commands: /help /clear /files /exit');
  console.log('');

  let messages = [];
  const createdFiles = new Set();

  while (true) {
    const input = await ask('  > ');
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === '/exit' || trimmed === '/quit') break;
    if (trimmed === '/clear') { messages = []; console.log('  ✓ Cleared.'); continue; }
    if (trimmed === '/files') {
      if (createdFiles.size === 0) { console.log('  No files created yet.'); }
      else { console.log('  Created files:'); for (const f of createdFiles) console.log(`    ${f}`); }
      continue;
    }
    if (trimmed === '/help') {
      console.log('  Commands: /help /clear /files /exit');
      continue;
    }

    messages.push({ role: 'user', content: trimmed });
    console.log('');

    try {
      const systemPrompt = `You are LUMINA CODE — an elite AI coding agent.

WORKFLOW:
1. PLAN: Think about what files you need to create.
2. ACT: Use write_file to create each file. Use run_command to install packages, run builds.
3. VERIFY: Run builds to check for errors.
4. FIX: If something fails, debug and fix immediately.

QUALITY STANDARDS:
- Production-grade code, always
- TypeScript with proper types (never use 'any')
- Error handling everywhere
- Responsive design (320px to 2560px)
- Accessible (semantic HTML, ARIA, keyboard navigation)
- Clean architecture, modern patterns
- Beautiful UI (consistent spacing, typography, color)
- Use modern CSS (grid, flexbox, custom properties)
- Use Three.js or CSS 3D for 3D effects

FORBIDDEN:
- Lorem ipsum or placeholder content
- TODO/FIXME comments in production code
- Emoji in code or UI
- var keyword (always let/const)
- any type in TypeScript
- Skipping error handling
- Hardcoded secrets

IMPORTANT: When you need to create a file, use the write_file tool IMMEDIATELY.
Don't just describe what you'll do — actually DO it.
Create ALL necessary files for a complete, working project.

Working directory: ${process.cwd()}

When using a tool, output ONLY:
TOOL: <tool_name>
PARAMS: {"key": "value"}`;

      const tools = [
        { type: 'function', function: { name: 'run_command', description: 'Run any shell command (npm, git, build, etc.)', parameters: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' }, timeout: { type: 'number' } }, required: ['command'] } } },
        { type: 'function', function: { name: 'read_file', description: 'Read file contents', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
        { type: 'function', function: { name: 'write_file', description: 'Create or overwrite a file with exact content', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
        { type: 'function', function: { name: 'edit_file', description: 'Edit a file by replacing exact text', parameters: { type: 'object', properties: { path: { type: 'string' }, search: { type: 'string' }, replace: { type: 'string' } }, required: ['path', 'search', 'replace'] } } },
        { type: 'function', function: { name: 'list_dir', description: 'List directory contents', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
        { type: 'function', function: { name: 'search_files', description: 'Find files by glob pattern', parameters: { type: 'object', properties: { pattern: { type: 'string' }, cwd: { type: 'string' } }, required: ['pattern'] } } },
        { type: 'function', function: { name: 'grep', description: 'Search file contents', parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern', 'path'] } } },
        { type: 'function', function: { name: 'git', description: 'Run git commands', parameters: { type: 'object', properties: { args: { type: 'string' }, cwd: { type: 'string' } }, required: ['args'] } } },
        { type: 'function', function: { name: 'npm', description: 'Run npm/yarn/pnpm/bun commands', parameters: { type: 'object', properties: { args: { type: 'string' }, cwd: { type: 'string' } }, required: ['args'] } } },
        { type: 'function', function: { name: 'deploy', description: 'Deploy to Vercel', parameters: { type: 'object', properties: { target: { type: 'string' }, cwd: { type: 'string' } } } } },
      ];

      let iterations = 0;
      const maxIterations = 50;
      let currentMessages = [...messages];
      let lastAssistantContent = '';

      while (iterations < maxIterations) {
        iterations++;
        process.stdout.write(`  ⏳ Thinking (step ${iterations})...\r`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.openrouterKey}`, 'HTTP-Referer': 'https://luminaai.co.in', 'X-Title': 'Lumina Code' },
          body: JSON.stringify({
            model: 'openrouter/owl-alpha',
            messages: [{ role: 'system', content: systemPrompt }, ...currentMessages],
            tools,
            tool_choice: 'auto',
            stream: false,
            max_tokens: 8000,
            temperature: 0.1,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          const err = await res.text().catch(() => '');
          throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`);
        }

        const data = await res.json();
        const choice = data.choices?.[0];
        if (!choice) throw new Error('No response from model');

        const content = choice.message?.content || '';
        const toolCalls = choice.message?.tool_calls || [];
        lastAssistantContent = content;

        currentMessages.push({ role: 'assistant', content, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) });

        if (toolCalls.length === 0) {
          messages = currentMessages;
          if (content) console.log(`  ${content.slice(0, 300)}`);
          console.log('');
          break;
        }

        for (const tc of toolCalls) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
          const toolName = tc.function.name;
          console.log(`  ⚙ ${toolName}(${JSON.stringify(args).slice(0, 100)})`);

          const output = await executeTool(toolName, args, process.cwd());

          // Track created files
          if (toolName === 'write_file' && args.path) {
            createdFiles.add(args.path);
            console.log(`  ✓ Created: ${args.path}`);
          } else {
            const shortOut = output.slice(0, 150).replace(/\n/g, ' ');
            console.log(`  ✓ ${shortOut}`);
          }

          currentMessages.push({ role: 'tool', content: output.slice(0, 3000), tool_call_id: tc.id });
        }
      }

      if (iterations >= maxIterations) {
        console.log('  ⚠ Reached max iterations. Partial result:');
        console.log(`  ${lastAssistantContent.slice(0, 300)}`);
      }

      if (createdFiles.size > 0) {
        console.log(`  📁 Created ${createdFiles.size} file(s)`);
      }
      console.log('');

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
