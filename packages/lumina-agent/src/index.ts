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
  const r1 = /---FILE:\s*([\w./\-]+)\n([\s\S]*?)---END/g;
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

// ── Validation ──────────────────────────────────────────────────────
function validateFiles(files) {
  const warnings = [];
  for (const file of files) {
    if (file.path.endsWith('.html')) {
      const issues = [];
      if (!/<!doctype\s+html/i.test(file.content)) issues.push('<!DOCTYPE html>');
      if (!/<html[\s>]/i.test(file.content)) issues.push('<html>');
      if (!/<head[\s>]/i.test(file.content)) issues.push('<head>');
      if (!/<body[\s>]/i.test(file.content)) issues.push('<body>');
      if (!/<\/html>\s*$/i.test(file.content.trim())) issues.push('</html>');
      if (!/<meta[^>]*charset/i.test(file.content)) issues.push('meta charset');
      if (!/<meta[^>]*viewport/i.test(file.content)) issues.push('meta viewport');
      if (!/<title>[^<]+<\/title>/i.test(file.content)) issues.push('<title>');
      if (issues.length > 0) {
        warnings.push({ path: file.path, issues });
      }
    } else if (file.path.endsWith('.css')) {
      // Check balanced braces
      let depth = 0, inString = false, stringChar = '';
      for (let i = 0; i < file.content.length; i++) {
        const ch = file.content[i];
        if (inString) {
          if (ch === stringChar && file.content[i - 1] !== '\\') inString = false;
        } else {
          if (ch === '"' || ch === "'") { inString = true; stringChar = ch; }
          else if (ch === '{') depth++;
          else if (ch === '}') depth--;
          if (depth < 0) break;
        }
      }
      if (depth !== 0) {
        warnings.push({ path: file.path, issues: ['unbalanced { } braces'] });
      }
      // Check for empty rulesets
      if (/\{\s*\}/.test(file.content)) {
        warnings.push({ path: file.path, issues: ['empty CSS rulesets found'] });
      }
    } else if (file.path.endsWith('.js') || file.path.endsWith('.ts')) {
      // Check balanced braces (similar to CSS but also check parentheses)
      let braceDepth = 0, parenDepth = 0, inString = false, stringChar = '';
      for (let i = 0; i < file.content.length; i++) {
        const ch = file.content[i];
        if (inString) {
          if (ch === stringChar && file.content[i - 1] !== '\\') inString = false;
        } else {
          if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; }
          else if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
          else if (ch === '(') parenDepth++;
          else if (ch === ')') parenDepth--;
          if (braceDepth < 0 || parenDepth < 0) break;
        }
      }
      if (braceDepth !== 0) {
        warnings.push({ path: file.path, issues: ['unbalanced { } braces'] });
      }
      if (parenDepth !== 0) {
        warnings.push({ path: file.path, issues: ['unbalanced ( ) parentheses'] });
      }
      // Check for placeholder patterns
      if (/TODO|FIXME|lorem ipsum|placeholder|coming soon/i.test(file.content)) {
        warnings.push({ path: file.path, issues: ['contains placeholders/TODOs'] });
      }
    }
  }
  return warnings;
}

// ── System Prompt ───────────────────────────────────────────────────
function buildSystemPrompt(cwd) {
  return `You are LUMINA CODE — a world-class senior software engineer creating PRODUCTION-GRADE, pixel-perfect, deployable applications.
Every website you create must be visually stunning, fully functional, and production-ready. NO EXCEPTIONS.

═══════════════════════════════════════════════════════════════
  ABSOLUTE RULE — ZERO PLACEHOLDERS, ZERO TODOS, ZERO LOREM IPSUM
═══════════════════════════════════════════════════════════════
- NEVER write "// TODO", "// FIXME", "// Add your code here", "...", or "// rest unchanged"
- NEVER write "lorem ipsum" text — write REAL, meaningful content
- NEVER write "// placeholder" or "// coming soon"
- EVERY file must be 100% COMPLETE with every line of code written
- If you cannot complete a file, write the ENTIRE file from scratch instead of abbreviating
- Every CSS rule must be fully written. Every function must be fully implemented.

═══════════════════════════════════════════════════════════════
  HTML5 STRUCTURE — EVERY HTML FILE MUST HAVE ALL OF THESE
═══════════════════════════════════════════════════════════════
1. <!DOCTYPE html> as the VERY FIRST line
2. <html lang="en"> opening tag
3. <head> section containing:
   - <meta charset="UTF-8">
   - <meta name="viewport" content="width=device-width, initial-scale=1.0">
   - <title>Descriptive Page Title</title>
   - <link rel="stylesheet" href="styles.css"> (or appropriate CSS file)
   - Any meta description, Open Graph tags for polish
4. <body> with semantic HTML5 elements:
   - <header>, <nav>, <main>, <section>, <article>, <footer>
   - Proper heading hierarchy (h1 → h2 → h3, never skip levels)
5. Closing </body> and </html> tags
6. Scripts before </body>: <script src="app.js"></script>

═══════════════════════════════════════════════════════════════
  CSS — MODERN, PRODUCTION-QUALITY STYLES
═══════════════════════════════════════════════════════════════
- Use CSS custom properties (variables) for colors, spacing, fonts:
  :root { --color-primary: #6366f1; --space-md: 1rem; ... }
- Use CSS Grid and Flexbox for layouts (no floats, no tables for layout)
- Mobile-first responsive design with @media (min-width: ...) queries
- Smooth transitions and animations (transition, @keyframes)
- Consistent spacing system (4px base unit)
- Beautiful typography: proper font-size, line-height, letter-spacing
- Use modern CSS: clamp(), min(), max(), aspect-ratio, object-fit
- Dark mode support via @media (prefers-color-scheme: dark) when appropriate
- Every selector must have complete declarations — no empty rules

═══════════════════════════════════════════════════════════════
  JAVASCRIPT — ES6+, CLEAN, ROBUST
═══════════════════════════════════════════════════════════════
- Use const/let only — NEVER use var
- Arrow functions for callbacks, async/await for async operations
- Proper try/catch error handling with user-friendly messages
- DOMContentLoaded event listener for DOM manipulation
- Event delegation for dynamic elements
- Template literals for string interpolation
- Destructuring, spread operator, optional chaining where appropriate
- Every function must be complete — no stubs, no "// implement later"

═══════════════════════════════════════════════════════════════
  RESPONSIVE DESIGN — MOBILE-FIRST
═══════════════════════════════════════════════════════════════
- Start with mobile styles (320px+), then add breakpoints:
  @media (min-width: 640px) { ... }   /* sm */
  @media (min-width: 768px) { ... }   /* md */
  @media (min-width: 1024px) { ... }  /* lg */
  @media (min-width: 1280px) { ... }  /* xl */
- Fluid typography: clamp(1rem, 2.5vw, 2rem)
- Flexible images: max-width: 100%; height: auto;
- Touch-friendly tap targets (min 44px)

═══════════════════════════════════════════════════════════════
  ACCESSIBILITY — NON-NEGOTIABLE
═══════════════════════════════════════════════════════════════
- Semantic HTML elements (nav, main, section, article, aside, footer)
- ARIA labels on interactive elements without visible text
- alt attributes on ALL images
- Keyboard navigable (focus states, tabindex)
- Color contrast ratio minimum 4.5:1 for text
- lang attribute on <html> tag

═══════════════════════════════════════════════════════════════
  OUTPUT FORMAT — USE THIS EXACT FORMAT FOR EVERY FILE
═══════════════════════════════════════════════════════════════
---FILE: path/to/file.ext
[COMPLETE file content — every single line]
---END

For commands to run after file creation:
---COMMAND: npm install something
---COMMAND: npm run build

═══════════════════════════════════════════════════════════════
  EXAMPLE — Complete Multi-File Project
═══════════════════════════════════════════════════════════════

Here is an example of what a COMPLETE, PRODUCTION-QUALITY multi-file project looks like:

---FILE: index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="TaskFlow — Beautiful task management">
  <title>TaskFlow — Manage Your Work</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="header">
    <nav class="nav">
      <div class="logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">TaskFlow</span>
      </div>
      <ul class="nav-links">
        <li><a href="#features">Features</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><a href="#about">About</a></li>
      </ul>
      <button class="btn btn-primary" aria-label="Get started with TaskFlow">Get Started</button>
    </nav>
  </header>
  <main>
    <section class="hero">
      <div class="hero-content">
        <h1>Manage tasks without the chaos</h1>
        <p>TaskFlow brings clarity to your work with beautiful, intuitive project management.</p>
        <div class="hero-actions">
          <button class="btn btn-primary btn-lg">Start Free</button>
          <button class="btn btn-ghost btn-lg">Watch Demo</button>
        </div>
      </div>
      <div class="hero-visual">
        <div class="card-mockup">
          <div class="card-header">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <div class="card-body">
            <div class="task-item completed">
              <span class="check">✓</span>
              <span>Design system update</span>
            </div>
            <div class="task-item">
              <span class="check">○</span>
              <span>API integration</span>
            </div>
            <div class="task-item">
              <span class="check">○</span>
              <span>User testing</span>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section id="features" class="features">
      <h2>Everything you need</h2>
      <div class="features-grid">
        <article class="feature-card">
          <div class="feature-icon">🎯</div>
          <h3>Smart Priorities</h3>
          <p>AI-powered task ranking so you always know what matters most.</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">📊</div>
          <h3>Real-time Analytics</h3>
          <p>Beautiful dashboards that show your team's progress at a glance.</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">🔗</div>
          <h3>Seamless Integrations</h3>
          <p>Connect with GitHub, Slack, Figma, and 50+ other tools.</p>
        </article>
      </div>
    </section>
  </main>
  <footer class="footer">
    <p>© 2026 TaskFlow. Built with care.</p>
  </footer>
  <script src="app.js"></script>
</body>
</html>
---END

---FILE: styles.css
:root {
  --color-primary: #6366f1;
  --color-primary-dark: #4f46e5;
  --color-bg: #0f0f14;
  --color-surface: #1a1a24;
  --color-surface-raised: #24243a;
  --color-text: #e4e4ef;
  --color-text-muted: #9494a8;
  --color-border: #2a2a3e;
  --color-success: #34d399;
  --color-warning: #fbbf24;
  --color-danger: #f87171;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.5);
  --transition: 0.2s ease;
}

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
  min-height: 100vh;
}

/* Header */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(15, 15, 20, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
}

.nav {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.logo-icon { font-size: 1.5rem; }

.nav-links {
  display: flex;
  list-style: none;
  gap: 2rem;
}

.nav-links a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color var(--transition);
}

.nav-links a:hover { color: var(--color-text); }

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.2rem;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all var(--transition);
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-ghost {
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-ghost:hover { background: var(--color-surface); }
.btn-lg { padding: 0.8rem 1.8rem; font-size: 1rem; }

/* Hero */
.hero {
  max-width: 1200px;
  margin: 0 auto;
  padding: 8rem 2rem 4rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

.hero-content h1 {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, #e4e4ef 0%, #9494a8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-content p {
  font-size: 1.15rem;
  color: var(--color-text-muted);
  margin-bottom: 2rem;
  max-width: 480px;
}

.hero-actions {
  display: flex;
  gap: 1rem;
}

/* Card Mockup */
.card-mockup {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.card-header {
  padding: 1rem;
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.red { background: var(--color-danger); }
.dot.yellow { background: var(--color-warning); }
.dot.green { background: var(--color-success); }

.card-body { padding: 1.5rem; }

.task-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.task-item:last-child { border-bottom: none; }
.task-item.completed { color: var(--color-text); }
.check { font-weight: 700; }

/* Features */
.features {
  max-width: 1200px;
  margin: 0 auto;
  padding: 4rem 2rem;
}

.features h2 {
  text-align: center;
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  margin-bottom: 3rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 2rem;
  transition: all var(--transition);
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary);
}

.feature-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.15rem;
  margin-bottom: 0.5rem;
}

.feature-card p {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

/* Footer */
.footer {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
  margin-top: 4rem;
}

/* Responsive */
@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 6rem 1.5rem 3rem;
    text-align: center;
  }
  .hero-content p { margin: 0 auto 2rem; }
  .hero-actions { justify-content: center; }
  .hero-visual { display: none; }
  .nav-links { display: none; }
}
---END

---FILE: app.js
document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for nav links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Animate feature cards on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, index * 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.feature-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(card);
  });

  // Button interactions
  document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('click', () => {
      const original = btn.textContent;
      btn.textContent = 'Loading...';
      btn.style.opacity = '0.7';
      setTimeout(() => {
        btn.textContent = original;
        btn.style.opacity = '1';
      }, 1500);
    });
  });

  // Header scroll effect
  let lastScroll = 0;
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 50) {
      header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
    } else {
      header.style.boxShadow = 'none';
    }
    lastScroll = currentScroll;
  });
});
---END

═══════════════════════════════════════════════════════════════
  YOUR TASK
═══════════════════════════════════════════════════════════════
Create a COMPLETE, PRODUCTION-QUALITY project with ALL files.
Every file must be fully written, fully styled, and fully functional.
The website must be visually stunning, responsive, accessible, and ready to deploy.
Working directory: ${cwd}`;
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
      const sys = buildSystemPrompt(cwd);

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
          stream: true,
          max_tokens: 16000,
          temperature: 0.15,
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      // Process streaming response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let finishReason = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep the last partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
            }
            if (parsed.choices?.[0]?.finish_reason) {
              finishReason = parsed.choices[0].finish_reason;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim().startsWith('data: ')) {
        const data = buffer.trim().slice(6);
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) fullContent += delta;
            if (parsed.choices?.[0]?.finish_reason) {
              finishReason = parsed.choices[0].finish_reason;
            }
          } catch {
            // Skip
          }
        }
      }

      const content = fullContent;
      if (!content) { stop(); println(`  ${c.red}⚠ Empty response${c.reset}`); println(''); continue; }
      stop();

      // Check for truncation and auto-retry once
      if (finishReason === 'length') {
        println(`  ${c.amber}⚠ Output was truncated. Retrying...${c.reset}`);
        println('');

        // Retry with a continuation prompt
        const retryRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.openrouterKey}`,
            'HTTP-Referer': 'https://luminaai.co.in',
            'X-Title': 'Lumina Code',
          },
          body: JSON.stringify({
            model: 'openrouter/owl-alpha',
            messages: [
              { role: 'system', content: sys },
              ...history,
              { role: 'user', content: t },
              { role: 'assistant', content: fullContent },
              { role: 'user', content: 'You stopped mid-generation. Please continue from where you left off. Output ONLY the remaining files using the same ---FILE: ... ---END format. Do NOT repeat files already created.' },
            ],
            stream: true,
            max_tokens: 16000,
            temperature: 0.15,
          }),
        });

        if (retryRes.ok) {
          const retryReader = retryRes.body.getReader();
          const retryDecoder = new TextDecoder();
          let retryContent = '';
          let retryBuffer = '';

          while (true) {
            const { done, value } = await retryReader.read();
            if (done) break;
            retryBuffer += retryDecoder.decode(value, { stream: true });
            const lines = retryBuffer.split('\n');
            retryBuffer = lines.pop();

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) retryContent += delta;
              } catch { /* skip */ }
            }
          }

          if (retryContent) {
            fullContent += retryContent;
            content = fullContent;
            println(`  ${c.green}✓ Continuation successful${c.reset}`);
          }
        }
      }

      // Warn if truncated
      if (finishReason === 'length') {
        println(`  ${c.amber}⚠ Output was truncated (hit token limit). Try a more specific prompt or break the task into smaller pieces.${c.reset}`);
        println('');
      }

      const files = parseFiles(content);
      const commands = extractCommands(content);

      // Validate files
      const warnings = validateFiles(files);
      if (warnings.length > 0) {
        for (const w of warnings) {
          println(`  ${c.amber}⚠ ${w.path}: ${w.issues.join(', ')}${c.reset}`);
        }
        println('');
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

      // Summary
      const totalChars = files.reduce((sum, f) => sum + f.content.length, 0);
      const totalKB = (totalChars / 1024).toFixed(1);
      println(`  ${c.green}${c.bold}Done!${c.reset} ${c.gray}${files.length} file(s) · ${totalKB}kb${c.reset}`);
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
