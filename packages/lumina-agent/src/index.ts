#!/usr/bin/env node
// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve, basename } from 'path';
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

// ── ANSI Colors ─────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  purple: '\x1b[38;5;168;139;250m',
  purpleBright: '\x1b[38;5;124;92;252m',
  purpleDark: '\x1b[38;5;88;56;180m',
  teal: '\x1b[38;5;45;212;191m',
  tealBright: '\x1b[38;5;94;246;224m',
  green: '\x1b[38;5;74;222;128m',
  greenBright: '\x1b[38;5;134;239;172m',
  red: '\x1b[38;5;248;113;113m',
  amber: '\x1b[38;5;251;191;36m',
  blue: '\x1b[38;5;91;143;254m',
  pink: '\x1b[38;5;244;114;182;251m',
  white: '\x1b[38;5;250;250;250m',
  gray: '\x1b[38;5;161;161;170m',
  darkGray: '\x1b[38;5;92;92;100m',
  bgPurple: '\x1b[48;5;30;15;50m',
  bgDark: '\x1b[48;5;10;10;15m',
};

function print(...args) { process.stdout.write(args.join('')); }
function println(...args) { process.stdout.write(args.join('') + '\n'); }
function clear() { process.stdout.write('\x1b[2J\x1b[H'); }
function moveTo(line, col) { process.stdout.write(`\x1b[${line};${col}H`); }
function clearLine() { process.stdout.write('\x1b[2K\r'); }

// ── Spinner ─────────────────────────────────────────────────────────
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
class Spinner {
  constructor(label) {
    this.label = label;
    this.frame = 0;
    this.running = false;
    this.timer = null;
  }
  start() {
    this.running = true;
    this.render();
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % spinnerFrames.length;
      this.render();
    }, 80);
  }
  stop() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    clearLine();
  }
  render() {
    clearLine();
    print(`${c.purple}${spinnerFrames[this.frame]}${c.reset} ${c.gray}${this.label}${c.reset}`);
  }
}

// ── Header ──────────────────────────────────────────────────────────
function showHeader() {
  println('');
  print(`${c.bgPurple}  `);
  print(`${c.purpleBright}${c.bold}⚡ LUMINA CODE${c.reset}`);
  print(`${c.bgPurple}  ${c.reset}`);
  println(`  ${c.gray}AI Coding Agent — Better than Claude Code${c.reset}`);
  println('');
  print(`${'─'.repeat(55)}`);
  println('');
}

// ── Onboarding ──────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(question) { return new Promise(r => rl.question(question, r)); }

async function onboarding() {
  clear();
  showHeader();
  println(`  ${c.gray}Welcome! Let's set up your AI coding agent.${c.reset}`);
  println('');

  const apiKey = await ask(`  ${c.purple}▸${c.reset} ${c.gray}OpenRouter API key: ${c.reset}`);
  if (!apiKey.trim() || apiKey.trim().length < 10) {
    println(`  ${c.red}Invalid key. Get one at https://openrouter.ai/keys${c.reset}`);
    process.exit(1);
  }

  const name = await ask(`  ${c.purple}▸${c.reset} ${c.gray}Your name (optional): ${c.reset}`);
  saveConfig({ openrouterKey: apiKey.trim(), userName: name.trim() || 'User' });
  println('');
  println(`  ${c.green}✓${c.reset} ${c.gray}Setup complete!${c.reset}`);
  println('');
  await new Promise(r => setTimeout(r, 800));
}

// ── File Parser ─────────────────────────────────────────────────────
function parseFiles(content) {
  const files = [];

  // Format 1: ---FILE: path ... ---END
  const fileRegex = /---FILE:\s*([\w./\-_]+)\n([\s\S]*?)---END/g;
  let match;
  while ((match = fileRegex.exec(content)) !== null) {
    const filePath = match[1].trim();
    const fileContent = match[2].trim();
    if (filePath && fileContent) {
      files.push({ path: filePath, content: fileContent });
    }
  }

  // Format 2: ```language ... ``` code blocks
  if (files.length === 0) {
    const blockRegex = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let blockMatch;
    let idx = 0;
    while ((blockMatch = blockRegex.exec(content)) !== null) {
      const lang = blockMatch[1] || '';
      const code = blockMatch[2].trim();
      if (!code || code.length < 10) continue;

      let filename;
      if (lang === 'html' || lang === 'htm') filename = idx === 0 ? 'index.html' : `page${idx}.html`;
      else if (lang === 'css') filename = idx === 0 ? 'style.css' : `styles${idx}.css`;
      else if (lang === 'javascript' || lang === 'js') filename = idx === 0 ? 'script.js' : `app${idx}.js`;
      else if (lang === 'typescript' || lang === 'ts') filename = idx === 0 ? 'app.ts' : `module${idx}.ts`;
      else if (lang === 'json') filename = 'package.json';
      else if (lang === 'python' || lang === 'py') filename = 'main.py';
      else if (lang === 'bash' || lang === 'sh') filename = 'run.sh';
      else filename = `file${idx}.${lang || 'txt'}`;

      files.push({ path: filename, content: code });
      idx++;
    }
  }

  return files;
}

function extractCommands(content) {
  const commands = [];
  const cmdRegex = /---COMMAND:\s*(.+)/g;
  let match;
  while ((match = cmdRegex.exec(content)) !== null) {
    commands.push(match[1].trim());
  }
  return commands;
}

// ── Chat Loop ───────────────────────────────────────────────────────
async function chat(config) {
  clear();
  showHeader();

  const cwd = process.cwd();
  const createdFiles = new Set();
  let conversationHistory = [];

  println(`  ${c.gray}Working directory: ${c.white}${cwd}${c.reset}`);
  println(`  ${c.gray}Type what you want to build. Commands: ${c.purple}/files${c.reset} ${c.gray}/${c.reset} ${c.purple}/clear${c.reset} ${c.gray}/${c.reset} ${c.purple}/exit${c.reset}`);
  println('');

  while (true) {
    const input = await ask(`  ${c.purpleBright}› ${c.reset}`);
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === '/exit' || trimmed === '/quit') {
      println('');
      println(`  ${c.gray}Goodbye! 👋${c.reset}`);
      break;
    }
    if (trimmed === '/clear') {
      conversationHistory = [];
      println(`  ${c.gray}✓ Conversation cleared${c.reset}`);
      println('');
      continue;
    }
    if (trimmed === '/files') {
      if (createdFiles.size === 0) {
        println(`  ${c.gray}No files created yet${c.reset}`);
      } else {
        println(`  ${c.gray}Created files:${c.reset}`);
        for (const f of createdFiles) println(`    ${c.teal}✓${c.reset} ${f}`);
      }
      println('');
      continue;
    }

    // Show user message
    println(`  ${c.purple}You:${c.reset} ${trimmed}`);
    println('');

    const spinner = new Spinner('Thinking...');
    spinner.start();

    try {
      const systemPrompt = `You are LUMINA CODE — an elite AI coding agent that creates STUNNING, production-grade websites.

Your websites rival Linear, Notion, Vercel, Anthropic, and Apple in design quality.

CRITICAL STANDARDS:
- Cinematic, premium UI with perfect typography and spacing
- Smooth CSS animations and micro-interactions
- Responsive design (mobile to desktop)
- Accessible (semantic HTML, ARIA labels)
- Modern CSS (grid, flexbox, custom properties, gradients)
- Beautiful color palettes — not generic blue/purple
- No placeholders, no lorem ipsum, no TODO comments
- Every file must be COMPLETE and production-ready

OUTPUT FORMAT — For EACH file output exactly:
---FILE: path/to/file.ext
[COMPLETE file content]
---END

For shell commands:
---COMMAND: npm install something
---COMMAND: npm run build

Create ALL necessary files for a complete, working project.
Working directory: ${cwd}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: trimmed },
      ];

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openrouterKey}`,
          'HTTP-Referer': 'https://luminaai.co.in',
          'X-Title': 'Lumina Code',
        },
        body: JSON.stringify({
          model: 'openrouter/owl-alpha',
          messages,
          stream: false,
          max_tokens: 16000,
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        spinner.stop();
        println(`  ${c.red}⚠ Empty response from model${c.reset}`);
        println('');
        continue;
      }

      spinner.stop();

      // Parse and create files with real-time feedback
      const files = parseFiles(content);
      const commands = extractCommands(content);

      if (files.length > 0) {
        println(`  ${c.teal}${c.bold}Creating ${files.length} file(s)...${c.reset}`);
        println('');

        for (const file of files) {
          const fileSpinner = new Spinner(`  ${file.path}`);
          fileSpinner.start();

          try {
            const fullPath = join(cwd, file.path);
            const dir = dirname(resolve(fullPath));
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            writeFileSync(fullPath, file.content, 'utf-8');
            createdFiles.add(file.path);

            fileSpinner.stop();
            const size = `${(file.content.length / 1024).toFixed(1)}kb`;
            println(`    ${c.green}✓${c.reset} ${c.white}${file.path}${c.reset} ${c.darkGray}(${size})${c.reset}`);
          } catch (e) {
            fileSpinner.stop();
            println(`    ${c.red}✗${c.reset} ${file.path}: ${e.message}`);
          }
        }
        println('');
      }

      // Run commands
      if (commands.length > 0) {
        println(`  ${c.amber}${c.bold}Running ${commands.length} command(s)...${c.reset}`);
        println('');

        for (const cmd of commands) {
          const cmdSpinner = new Spinner(`  $ ${cmd}`);
          cmdSpinner.start();

          try {
            const out = execSync(cmd, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
            cmdSpinner.stop();
            println(`    ${c.green}✓${c.reset} ${c.gray}${cmd}${c.reset}`);
            if (out.trim()) {
              const lines = out.trim().split('\n').slice(0, 3);
              for (const line of lines) {
                println(`      ${c.darkGray}${line.slice(0, 60)}${c.reset}`);
              }
              if (out.trim().split('\n').length > 3) {
                println(`      ${c.darkGray}...${c.reset}`);
              }
            }
          } catch (e) {
            cmdSpinner.stop();
            println(`    ${c.red}✗${c.reset} ${cmd}: ${e.message}`);
          }
        }
        println('');
      }

      // Show AI response text (non-file content)
      const textOnly = content
        .replace(/---FILE:[\s\S]*?---END/g, '')
        .replace(/---COMMAND:.+/g, '')
        .trim();

      if (textOnly) {
        println(`  ${c.purpleBright}Lumina:${c.reset}`);
        const lines = textOnly.split('\n').slice(0, 5);
        for (const line of lines) {
          println(`  ${c.gray}${line}${c.reset}`);
        }
        if (textOnly.split('\n').length > 5) {
          println(`  ${c.gray}...${c.reset}`);
        }
        println('');
      }

      // Summary
      println(`  ${c.teal}${c.bold}Done!${c.reset} ${c.gray}Created ${files.length} file(s), ${commands.length} command(s)${c.reset}`);
      println('');

      // Save conversation
      conversationHistory.push({ role: 'user', content: trimmed });
      conversationHistory.push({ role: 'assistant', content });
      if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);

    } catch (e) {
      spinner.stop();
      println(`  ${c.red}⚠ ${e.message}${c.reset}`);
      println('');
    }
  }

  rl.close();
}

// ── Main ────────────────────────────────────────────────────────────
const config = loadConfig();
if (!config?.openrouterKey) {
  onboarding().then(() => chat(loadConfig()).then(() => process.exit(0)));
} else {
  chat(config).then(() => process.exit(0));
}
