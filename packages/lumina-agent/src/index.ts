#!/usr/bin/env node
// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp, Spacer } from 'ink';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join, basename, dirname, resolve, relative } from 'path';

const CONFIG_DIR = join(homedir(), '.lumina');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try { if (!existsSync(CONFIG_FILE)) return null; return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch { return null; }
}
function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ── Simple Text Input Component ─────────────────────────────────────
function PromptInput({ value, onChange, onSubmit, placeholder }) {
  useInput((input, key) => {
    if (key.return && onSubmit) {
      onSubmit(value);
    } else if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input) {
      onChange(value + input);
    }
  });
  return React.createElement(Box, null,
    React.createElement(Text, { color: '#7C5CFC' }, ' > '),
    React.createElement(Text, { color: '#FAFAFA' }, value || placeholder || 'Type something...'),
    React.createElement(Text, { color: '#52525B' }, '▌'),
  );
}

// ── Onboarding Screen ───────────────────────────────────────────────
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [name, setName] = useState('');

  const handleKey = useCallback((input, key) => {
    if (key.return) {
      if (step === 0) {
        setStep(1);
      } else if (step === 1 && apiKey.trim().length > 10) {
        setStep(2);
      } else if (step === 2) {
        saveConfig({ openrouterKey: apiKey.trim(), userName: name.trim() || 'User' });
        onComplete();
      }
    } else if (key.backspace || key.delete) {
      if (step === 1) setApiKey(v => v.slice(0, -1));
      if (step === 2) setName(v => v.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input) {
      if (step === 1) setApiKey(v => v + input);
      if (step === 2) setName(v => v + input);
    }
  }, [step, apiKey, name, onComplete]);

  useInput(handleKey);

  return React.createElement(Box, { flexDirection: 'column', padding: 2 },
    React.createElement(Box, { flexDirection: 'column', marginBottom: 2 },
      React.createElement(Text, { bold: true, color: '#7C5CFC' }, '  ⚡ LUMINA CODE'),
      React.createElement(Text, { color: '#52525B' }, '  AI Coding Agent'),
    ),
    step === 0 && React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { color: '#A1A1AA' }, '  Welcome! Let\'s get you set up.'),
      React.createElement(Text, { color: '#52525B' }, '  Press Enter to continue...'),
    ),
    step === 1 && React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { color: '#A1A1AA' }, '  Enter your OpenRouter API key:'),
      React.createElement(Text, { color: '#52525B' }, '  (Get one at https://openrouter.ai/keys)'),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { color: '#7C5CFC' }, '  > '),
        React.createElement(Text, { color: '#FAFAFA' }, apiKey || 'sk-or-...'),
        React.createElement(Text, { color: '#52525B' }, '▌'),
      ),
      React.createElement(Text, { color: '#3F3F46', marginTop: 1 }, '  Press Enter to continue'),
    ),
    step === 2 && React.createElement(Box, { flexDirection: 'column' },
      React.createElement(Text, { color: '#A1A1AA' }, '  What should I call you? (optional)'),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { color: '#7C5CFC' }, '  > '),
        React.createElement(Text, { color: '#FAFAFA' }, name || 'Your name'),
        React.createElement(Text, { color: '#52525B' }, '▌'),
      ),
      React.createElement(Text, { color: '#3F3F46', marginTop: 1 }, '  Press Enter to start coding!'),
    ),
  );
}

// ── Chat Screen ─────────────────────────────────────────────────────
function ChatScreen({ config }) {
  const { exit } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Ready');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(0);

  const visibleMessages = messages.slice(-50);

  const handleSubmit = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setInput('');
    setThinking(true);
    setStatus('Thinking...');
    scrollRef.current++;

    const userMsg = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
      const tools = [
        { type: 'function', function: { name: 'run_command', description: 'Run any shell command', parameters: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' }, timeout: { type: 'number' } }, required: ['command'] } } },
        { type: 'function', function: { name: 'read_file', description: 'Read file contents. ALWAYS read before editing.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
        { type: 'function', function: { name: 'write_file', description: 'Create or overwrite a file. Creates directories automatically.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
        { type: 'function', function: { name: 'edit_file', description: 'Make precise edits to a file. search/replace.', parameters: { type: 'object', properties: { path: { type: 'string' }, search: { type: 'string' }, replace: { type: 'string' } }, required: ['path', 'search', 'replace'] } } },
        { type: 'function', function: { name: 'list_dir', description: 'List directory contents', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
        { type: 'function', function: { name: 'search_files', description: 'Find files by glob pattern', parameters: { type: 'object', properties: { pattern: { type: 'string' }, cwd: { type: 'string' } }, required: ['pattern'] } } },
        { type: 'function', function: { name: 'grep', description: 'Search file contents', parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern', 'path'] } } },
        { type: 'function', function: { name: 'git', description: 'Run git commands', parameters: { type: 'object', properties: { args: { type: 'string' }, cwd: { type: 'string' } }, required: ['args'] } } },
        { type: 'function', function: { name: 'npm', description: 'Run npm/yarn/pnpm/bun commands', parameters: { type: 'object', properties: { args: { type: 'string' }, cwd: { type: 'string' } }, required: ['args'] } } },
        { type: 'function', function: { name: 'deploy', description: 'Deploy to Vercel', parameters: { type: 'object', properties: { target: { type: 'string' }, cwd: { type: 'string' } } } } },
      ];

      let iterations = 0;
      const maxIterations = 30;
      let currentMessages = [...newMessages];

      while (iterations < maxIterations) {
        iterations++;
        setStatus(`Working (step ${iterations})...`);

        const res = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.openrouterKey}`, 'HTTP-Referer': 'https://luminaai.co.in', 'X-Title': 'Lumina Code' },
          body: JSON.stringify({
            model: 'openrouter/owl-alpha',
            messages: [{ role: 'system', content: `You are LUMINA CODE — an elite AI coding agent.

MODEL: openrouter/owl-alpha (1M+ context, best reasoning)

WORKFLOW:
1. PLAN: Analyze the task. Create a brief plan.
2. ACT: Execute tools step by step. Read before writing.
3. VERIFY: Run builds, check for errors.
4. FIX: If something fails, debug and fix immediately.
5. DEPLOY: If requested, deploy automatically.

QUALITY STANDARDS:
- Production-grade code, always
- TypeScript with proper types (never use 'any')
- Error handling everywhere
- Responsive design (320px to 2560px)
- Accessible (semantic HTML, ARIA, keyboard navigation)
- Clean architecture, modern patterns
- Beautiful UI (consistent spacing, typography, color)

FORBIDDEN:
- Lorem ipsum or placeholder content
- TODO/FIXME comments in production code
- Emoji in code or UI
- var keyword (always let/const)
- any type in TypeScript
- Skipping error handling
- Hardcoded secrets

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
        setMessages([...currentMessages]);
        scrollRef.current++;

        if (toolCalls.length === 0) {
          setStatus('Done');
          break;
        }

        // Execute tools
        for (const tc of toolCalls) {
          const args = JSON.parse(tc.function.arguments || '{}');
          const toolName = tc.function.name;
          setStatus(`Running: ${toolName}...`);
          scrollRef.current++;

          let output = '';
          try {
            const { execSync } = await import('child_process');
            switch (toolName) {
              case 'run_command': {
                const cwd = args.cwd || process.cwd();
                output = execSync(args.command, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: args.timeout || 120000, shell: true }) || '(no output)';
                break;
              }
              case 'read_file': {
                output = readFileSync(args.path, 'utf-8');
                break;
              }
              case 'write_file': {
                const dir = dirname(resolve(args.path));
                if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                writeFileSync(args.path, args.content, 'utf-8');
                output = `Wrote ${args.content.length} chars to ${args.path}`;
                break;
              }
              case 'edit_file': {
                let fileContent = readFileSync(args.path, 'utf-8');
                if (!fileContent.includes(args.search)) throw new Error(`String not found: "${args.search.slice(0, 50)}"`);
                fileContent = fileContent.replace(args.search, args.replace);
                writeFileSync(args.path, fileContent, 'utf-8');
                output = `Edited ${args.path}`;
                break;
              }
              case 'list_dir': {
                const entries = readdirSync(args.path, { withFileTypes: true });
                output = entries.map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`).join('\n');
                break;
              }
              case 'search_files': {
                const results = [];
                const search = (dir, depth) => {
                  if (depth > 5) return;
                  try {
                    for (const e of readdirSync(dir, { withFileTypes: true })) {
                      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
                      const fp = join(dir, e.name);
                      if (e.isDirectory()) search(fp, depth + 1);
                      else if (new RegExp(args.pattern.replace(/\*/g, '.*'), 'i').test(e.name)) results.push(relative(args.cwd || process.cwd(), fp));
                    }
                  } catch {}
                };
                search(args.cwd || process.cwd(), 0);
                output = results.join('\n') || 'No files found';
                break;
              }
              case 'grep': {
                const content = readFileSync(args.path, 'utf-8');
                const lines = content.split('\n');
                const regex = new RegExp(args.pattern, 'gi');
                output = lines.map((l, i) => regex.test(l) ? `${i + 1}: ${l}` : null).filter(Boolean).join('\n') || 'No matches';
                break;
              }
              case 'git': {
                output = execSync(`git ${args.args}`, { cwd: args.cwd || process.cwd(), encoding: 'utf-8', maxBuffer: 1024 * 1024 }) || '(ok)';
                break;
              }
              case 'npm': {
                const pm = existsSync(join(args.cwd || process.cwd(), 'bun.lockb')) ? 'bun' : existsSync(join(args.cwd || process.cwd(), 'yarn.lock')) ? 'yarn' : 'npm';
                output = execSync(`${pm} ${args.args}`, { cwd: args.cwd || process.cwd(), encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120000 }) || '(ok)';
                break;
              }
              case 'deploy': {
                output = execSync('npx vercel deploy --prod --yes', { cwd: args.cwd || process.cwd(), encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 300000 }) || '(deployed)';
                break;
              }
              default:
                output = `Unknown tool: ${toolName}`;
            }
          } catch (e) {
            output = `Error: ${e.message}`;
          }

          currentMessages.push({ role: 'tool', content: output.slice(0, 2000), tool_call_id: tc.id });
          setMessages([...currentMessages]);
          scrollRef.current++;
        }
      }

      if (iterations >= maxIterations) setStatus('Reached max iterations');
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠ Error: ${e.message}` }]);
      setStatus('Error');
    }

    setThinking(false);
  }, [input, thinking, messages, config]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit();
    if (key.ctrl && input === 'd') exit();
    if (key.return) {
      handleSubmit(input);
    } else if (key.backspace || key.delete) {
      setInput(v => v.slice(0, -1));
    } else if (!key.ctrl && !key.meta) {
      setInput(v => v + input);
    }
  });

  return React.createElement(Box, { flexDirection: 'column', height: '100%' },
    // Header
    React.createElement(Box, { borderStyle: 'round', borderColor: '#7C5CFC', paddingX: 2, paddingY: 1 },
      React.createElement(Text, { bold: true, color: '#7C5CFC' }, ' ⚡ LUMINA CODE'),
      React.createElement(Spacer, null),
      React.createElement(Text, { color: '#52525B' }, thinking ? ' ⏳ ' + status : ' ● ' + status),
    ),

    // Messages
    React.createElement(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 2, paddingY: 1, overflowY: 'hidden' },
      visibleMessages.map((m, i) => {
        if (m.role === 'user') {
          return React.createElement(Box, { key: i, marginTop: 1 },
            React.createElement(Text, { color: '#7C5CFC', bold: true }, '> '),
            React.createElement(Text, { color: '#FAFAFA' }, m.content),
          );
        }
        if (m.role === 'tool') {
          return React.createElement(Box, { key: i, marginTop: 0, paddingLeft: 2 },
            React.createElement(Text, { color: '#52525B' }, '  ' + m.content.slice(0, 200)),
          );
        }
        return React.createElement(Box, { key: i, marginTop: 1, paddingLeft: 2 },
          React.createElement(Text, { color: '#A1A1AA' }, m.content.slice(0, 500)),
        );
      }),
      thinking && React.createElement(Text, { color: '#F59E0B' }, '  ⏳ thinking...'),
    ),

    // Input
    React.createElement(Box, { borderStyle: 'single', borderColor: '#3F3F46', paddingX: 1 },
      React.createElement(Text, { color: '#7C5CFC' }, ' > '),
      React.createElement(Text, { color: '#FAFAFA' }, input || 'What do you want to build?'),
      React.createElement(Text, { color: '#52525B' }, '▌'),
    ),

    // Footer
    React.createElement(Box, { paddingX: 2 },
      React.createElement(Text, { color: '#3F3F46' }, ' Ctrl+C to exit | OWL-Alpha '),
    ),
  );
}

// ── Main App ────────────────────────────────────────────────────────
export default function App() {
  const config = loadConfig();
  if (!config?.openrouterKey) {
    return React.createElement(Onboarding, { onComplete: () => {} });
  }
  return React.createElement(ChatScreen, { config });
}
