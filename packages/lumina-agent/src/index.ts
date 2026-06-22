#!/usr/bin/env node
// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve } from 'path';
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

// ── ANSI ────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  purple: '\x1b[38;5;168;139;250m', purpleBright: '\x1b[38;5;124;92;252m',
  teal: '\x1b[38;5;45;212;191m', green: '\x1b[38;5;74;222;128m',
  red: '\x1b[38;5;248;113;113m', amber: '\x1b[38;5;251;191;36m',
  white: '\x1b[38;5;250;250;250m', gray: '\x1b[38;5;161;161;170m',
  darkGray: '\x1b[38;5;92;92;100m',
};
const println = (...a) => process.stdout.write(a.join('') + '\n');
const print = (...a) => process.stdout.write(a.join(''));
const clearLine = () => process.stdout.write('\x1b[2K\r');

// ── Spinner ─────────────────────────────────────────────────────────
const spin = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
function spinner(label) {
  let f = 0, t;
  const r = setInterval(() => { clearLine(); print(`${c.purple}${spin[f]}${c.reset} ${c.gray}${label}${c.reset}`); f = (f+1)%spin.length; }, 80);
  return () => { clearInterval(r); clearLine(); };
}

// ── Header ──────────────────────────────────────────────────────────
function header() {
  println('');
  print(`  ${c.purpleBright}${c.bold}⚡ LUMINA CODE${c.reset}`);
  println(`  ${c.gray}Production-Grade AI Coding Agent${c.reset}`);
  println('');
  print(`${'─'.repeat(55)}`);
  println('');
}

// ── Onboarding ──────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise(r => rl.question(q, r)); }

async function onboarding() {
  println('');
  header();
  println(`  ${c.gray}Welcome! Let's set up your AI coding agent.${c.reset}`);
  println('');
  const key = await ask(`  ${c.purple}▸${c.reset} ${c.gray}OpenRouter API key: ${c.reset}`);
  if (!key.trim() || key.trim().length < 10) { println(`  ${c.red}Invalid key.${c.reset}`); process.exit(1); }
  saveConfig({ openrouterKey: key.trim() });
  println(`  ${c.green}✓${c.reset} ${c.gray}Ready!${c.reset}`);
  await new Promise(r => setTimeout(r, 600));
}

// ── Parser ──────────────────────────────────────────────────────────
function parseFiles(content) {
  const files = [];
  // Format 1: ---FILE: path ... ---END
  const r1 = /---FILE:\s*([\w./\-_]+)\n([\s\S]*?)---END/g;
  let m;
  while ((m = r1.exec(content)) !== null) {
    if (m[1] && m[2]?.trim()) files.push({ path: m[1].trim(), content: m[2].trim() });
  }
  // Format 2: ```lang ... ```
  if (files.length === 0) {
    const r2 = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let i = 0;
    while ((m = r2.exec(content)) !== null) {
      const lang = m[1] || '', code = m[2].trim();
      if (!code || code.length < 10) continue;
      let fn;
      if (lang === 'html') fn = i === 0 ? 'index.html' : `page${i}.html`;
      else if (lang === 'css') fn = i === 0 ? 'style.css' : `styles${i}.css`;
      else if (lang === 'javascript' || lang === 'js') fn = i === 0 ? 'script.js' : `app${i}.js`;
      else if (lang === 'typescript' || lang === 'ts') fn = i === 0 ? 'app.ts' : `module${i}.ts`;
      else if (lang === 'json') fn = 'package.json';
      else if (lang === 'python' || lang === 'py') fn = 'main.py';
      else fn = `file${i}.${lang || 'txt'}`;
      files.push({ path: fn, content: code }); i++;
    }
  }
  return files;
}

function extractCommands(content) {
  const cmds = [], r = /---COMMAND:\s*(.+)/g;
  let m; while ((m = r.exec(content)) !== null) cmds.push(m[1].trim());
  return cmds;
}

// ── Chat ────────────────────────────────────────────────────────────
async function chat(config) {
  println('');
  header();
  const cwd = process.cwd();
  const created = new Set();
  let history = [];

  println(`  ${c.gray}Working dir: ${c.white}${cwd}${c.reset}`);
  println(`  ${c.gray}Type what to build. ${c.purple}/files${c.reset} ${c.gray}/${c.reset} ${c.purple}/clear${c.reset} ${c.gray}/${c.reset} ${c.purple}/exit${c.reset}`);
  println('');

  while (true) {
    const input = await ask(`  ${c.purpleBright}› ${c.reset}`);
    const t = input.trim();
    if (!t) continue;
    if (t === '/exit' || t === '/quit') { println(`  ${c.gray}Done.${c.reset}`); break; }
    if (t === '/clear') { history = []; println(`  ${c.gray}Cleared.${c.reset}`); println(''); continue; }
    if (t === '/files') {
      if (created.size === 0) println(`  ${c.gray}No files yet.${c.reset}`);
      else { println(`  ${c.gray}Files:${c.reset}`); for (const f of created) println(`    ${c.teal}✓${c.reset} ${f}`); }
      println(''); continue;
    }

    println(`  ${c.purple}You:${c.reset} ${t}`);
    println('');
    const stop = spinner('Generating production-grade code...');

    try {
      const sys = `You are LUMINA CODE — a senior software engineer and AI coding agent.
You create PRODUCTION-GRADE, deployable applications that rival Linear, Notion, Vercel, and Anthropic in quality.

ENGINEERING STANDARDS:
- Think like a staff engineer: architecture, scalability, security matter
- Complete TypeScript with strict types (never use 'any')
- Comprehensive error handling with user-friendly messages
- Responsive design (mobile-first, 320px to 2560px)
- Accessibility: semantic HTML, ARIA labels, keyboard navigation
- Performance: lazy loading, efficient bundling, minimal reflows
- Security: input sanitization, no hardcoded secrets, CSP headers
- Clean architecture: separation of concerns, DRY, single responsibility
- Meaningful variable/function names, JSDoc for public APIs

UI/UX STANDARDS:
- Cinematic, premium interface with intentional color palette
- Smooth CSS animations and micro-interactions (not excessive)
- Perfect typography hierarchy and whitespace
- Consistent design system (spacing, radii, shadows)
- Beautiful on every screen size

OUTPUT FORMAT — For EACH file:
---FILE: path/to/file.ext
[COMPLETE file — every line, production-ready]
---END

COMMANDS:
---COMMAND: npm install something
---COMMAND: npm run build

CRITICAL: Every file must be COMPLETE and production-ready.
A complete HTML file MUST have: <!DOCTYPE html>, <html>, <head> with meta charset and viewport, <title>, <body>, and </html> at the end.
A complete CSS file MUST have all styles and end properly.
A complete JS file MUST have all code and end properly.
No placeholders. No TODOs. No "// rest unchanged". No abbreviated code.
Create ALL files for a complete, working project.
Working directory: ${cwd}`;

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
          messages: [{ role: 'system', content: sys }, ...history, { role: 'user', content: t }],
          stream: false,
          max_tokens: 16000,
          temperature: 0.15,
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const finishReason = data.choices?.[0]?.finish_reason;
      if (!content) { stop(); println(`  ${c.red}⚠ Empty response${c.reset}`); println(''); continue; }
      stop();

      // Warn if truncated
      if (finishReason === 'length') {
        println(`  ${c.amber}⚠ Output was truncated (hit token limit). Try a more specific prompt.${c.reset}`);
        println('');
      }

      const files = parseFiles(content);
      const commands = extractCommands(content);

      // Validate HTML files
      for (const file of files) {
        if (file.path.endsWith('.html')) {
          const hasDoctype = /<!doctype html/i.test(file.content);
          const hasHtml = /<html[\s>]/.test(file.content);
          const hasBody = /<body[\s>]/.test(file.content);
          const hasClosingHtml = /<\/html>\s*$/.test(file.content.trim());
          if (!hasDoctype || !hasHtml || !hasBody || !hasClosingHtml) {
            println(`  ${c.amber}⚠ ${file.path} appears incomplete (missing ${!hasDoctype ? 'doctype ' : ''}${!hasHtml ? '<html> ' : ''}${!hasBody ? '<body> ' : ''}${!hasClosingHtml ? '</html>' : ''})${c.reset}`);
          }
        }
      }

      if (files.length > 0) {
        println(`  ${c.teal}${c.bold}Creating ${files.length} file(s)...${c.reset}`);
        for (const file of files) {
          const s = spinner(`  ${file.path}`);
          try {
            const fp = join(cwd, file.path);
            const d = dirname(resolve(fp));
            if (!existsSync(d)) mkdirSync(d, { recursive: true });
            writeFileSync(fp, file.content, 'utf-8');
            created.add(file.path);
            s();
            println(`    ${c.green}✓${c.reset} ${c.white}${file.path}${c.reset} ${c.darkGray}(${(file.content.length/1024).toFixed(1)}kb)${c.reset}`);
          } catch (e) { s(); println(`    ${c.red}✗${c.reset} ${file.path}: ${e.message}`); }
        }
        println('');
      }

      if (commands.length > 0) {
        println(`  ${c.amber}${c.bold}Running ${commands.length} command(s)...${c.reset}`);
        for (const cmd of commands) {
          const s = spinner(`  $ ${cmd}`);
          try {
            execSync(cmd, { cwd, encoding: 'utf-8', maxBuffer: 10*1024*1024, timeout: 120000 });
            s(); println(`    ${c.green}✓${c.reset} ${c.gray}${cmd}${c.reset}`);
          } catch (e) { s(); println(`    ${c.red}✗${c.reset} ${cmd}: ${e.message}`); }
        }
        println('');
      }

      const text = content.replace(/---FILE:[\s\S]*?---END/g, '').replace(/---COMMAND:.+/g, '').trim();
      if (text) {
        println(`  ${c.purpleBright}Lumina:${c.reset}`);
        const ls = text.split('\n').slice(0, 5);
        for (const l of ls) println(`  ${c.gray}${l}${c.reset}`);
        println('');
      }

      println(`  ${c.teal}${c.bold}Done!${c.reset} ${c.gray}${files.length} file(s), ${commands.length} command(s)${c.reset}`);
      println('');

      history.push({ role: 'user', content: t });
      history.push({ role: 'assistant', content });
      if (history.length > 20) history = history.slice(-20);

    } catch (e) {
      stop();
      println(`  ${c.red}⚠ ${e.message}${c.reset}`);
      println('');
    }
  }
  rl.close();
}

const config = loadConfig();
if (!config?.openrouterKey) onboarding().then(() => chat(loadConfig()).then(() => process.exit(0)));
else chat(config).then(() => process.exit(0));
