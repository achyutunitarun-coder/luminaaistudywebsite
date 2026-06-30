#!/usr/bin/env node
// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp, Spacer, Newline } from 'ink';
import TextInput from 'ink-text-input';
import chalk from 'chalk';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
// ── Inline AI Provider (self-contained) ──────────────────────────────
interface AIRequest {
  system: string;
  messages: { role: string; content: string }[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
}

interface AIChunk {
  content: string;
  finishReason?: string;
}

class OpenRouterProvider {
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }

  async *stream(request: AIRequest): AsyncIterableIterator<AIChunk> {
    const body: any = {
      model: request.model || 'meta-llama/llama-3.3-70b-instruct:free',
      messages: [{ role: 'system', content: request.system }, ...request.messages],
      max_tokens: request.maxTokens || 16000,
      temperature: request.temperature ?? 0.1,
      top_p: request.topP ?? 0.95,
      frequency_penalty: request.frequencyPenalty ?? 0.1,
      presence_penalty: request.presencePenalty ?? 0.2,
      stream: true,
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://luminaai.co.in',
        'X-Title': 'Lumina Code',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No body');

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t || !t.startsWith('data: ')) continue;
        const d = t.slice(6);
        if (d === '[DONE]') return;
        try {
          const p = JSON.parse(d);
          const delta = p.choices?.[0]?.delta?.content;
          if (delta) yield { content: delta, finishReason: p.choices?.[0]?.finish_reason };
        } catch { /* skip */ }
      }
    }
  }
}

// ── Config ────────────────────────────────────────────────────────────
const CONFIG_DIR = join(homedir(), '.lumina');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try { if (!existsSync(CONFIG_FILE)) return null; return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')); } catch { return null; }
}
function saveConfig(config: any) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ── Types ─────────────────────────────────────────────────────────────
interface FileItem { path: string; content: string; }
interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string; files?: FileItem[]; }

// ── File Parser ───────────────────────────────────────────────────────
function parseFiles(content: string): FileItem[] {
  const files: FileItem[] = [];
  // Format: ---FILE: path ... ---END
  const r1 = /---FILE:\s*([\w./\-_]+)\n([\s\S]*?)---END/g;
  let m: RegExpExecArray | null;
  while ((m = r1.exec(content)) !== null) {
    if (m[1] && m[2]?.trim()) files.push({ path: m[1].trim(), content: m[2].trim() });
  }
  // Fallback: code blocks
  if (files.length === 0) {
    const r2 = /```(\w+)?\s*\n([\s\S]*?)```/g;
    let i = 0;
    while ((m = r2.exec(content)) !== null) {
      const lang = m[1] || '', code = m[2].trim();
      if (!code || code.length < 10) continue;
      let fn: string;
      if (lang === 'html') fn = i === 0 ? 'index.html' : `page${i}.html`;
      else if (lang === 'css') fn = i === 0 ? 'style.css' : `styles${i}.css`;
      else if (lang === 'javascript' || lang === 'js') fn = i === 0 ? 'script.js' : `app${i}.js`;
      else if (lang === 'typescript' || lang === 'ts') fn = i === 0 ? 'app.ts' : `module${i}.ts`;
      else if (lang === 'json') fn = 'package.json';
      else fn = `file${i}.${lang || 'txt'}`;
      files.push({ path: fn, content: code });
      i++;
    }
  }
  // Fallback: raw HTML content
  if (files.length === 0 && /<!DOCTYPE|<html/i.test(content)) {
    files.push({ path: 'index.html', content: content.trim() });
  }
  return files;
}

function extractCommands(content: string): string[] {
  const cmds: string[] = [];
  const r = /---COMMAND:\s*(.+)/g;
  let m: RegExpExecArray | null;
  while ((m = r.exec(content)) !== null) cmds.push(m[1].trim());
  return cmds;
}

// ── Validation ────────────────────────────────────────────────────────
function validateFiles(files: FileItem[]): string[] {
  const warnings: string[] = [];
  for (const file of files) {
    if (file.path.endsWith('.html')) {
      const issues: string[] = [];
      if (!/<!doctype\s+html/i.test(file.content)) issues.push('missing <!DOCTYPE>');
      if (!/<html[\s>]/i.test(file.content)) issues.push('missing <html>');
      if (!/<head[\s>]/i.test(file.content)) issues.push('missing <head>');
      if (!/<body[\s>]/i.test(file.content)) issues.push('missing <body>');
      if (!/<\/html>\s*$/i.test(file.content.trim())) issues.push('missing </html>');
      if (!/<meta[^>]*charset/i.test(file.content)) issues.push('missing meta charset');
      if (!/<meta[^>]*viewport/i.test(file.content)) issues.push('missing meta viewport');
      if (issues.length > 0) warnings.push(`${file.path}: ${issues.join(', ')}`);
    }
  }
  return warnings;
}

// ── System Prompt ─────────────────────────────────────────────────────
function buildSystemPrompt(cwd: string): string {
  return `You are LUMINA CODE — a world-class senior software engineer creating PRODUCTION-GRADE, pixel-perfect, deployable applications.

═══════════════════════════════════════════════════════════════
  ABSOLUTE RULE — ZERO PLACEHOLDERS, ZERO TODOS, ZERO LOREM IPSUM
═══════════════════════════════════════════════════════════════
- NEVER write "// TODO", "// FIXME", "// Add your code here", "...", or "// rest unchanged"
- NEVER write "lorem ipsum" text — write REAL, meaningful content
- NEVER write "// placeholder" or "// coming soon"
- EVERY file must be 100% COMPLETE with every line of code written

═══════════════════════════════════════════════════════════════
  HTML5 STRUCTURE — EVERY HTML FILE MUST HAVE ALL OF THESE
═══════════════════════════════════════════════════════════════
1. <!DOCTYPE html> as the VERY FIRST line
2. <html lang="en"> opening tag
3. <head> with: <meta charset="UTF-8">, <meta name="viewport" content="width=device-width, initial-scale=1.0">, <title>, <link rel="stylesheet">
4. <body> with semantic HTML5: <header>, <nav>, <main>, <section>, <article>, <footer>
5. Closing </body> and </html> tags
6. Scripts before </body>

═══════════════════════════════════════════════════════════════
  CSS — MODERN, PRODUCTION-QUALITY
═══════════════════════════════════════════════════════════════
- Use CSS custom properties: :root { --color-primary: #6366f1; ... }
- Use CSS Grid and Flexbox for layouts
- Mobile-first responsive: @media (min-width: 640px) { ... }
- Smooth transitions and animations
- Beautiful typography with proper line-height, letter-spacing
- Use modern CSS: clamp(), min(), max(), aspect-ratio, object-fit

═══════════════════════════════════════════════════════════════
  JAVASCRIPT — ES6+, CLEAN, ROBUST
═══════════════════════════════════════════════════════════════
- const/let only — NEVER use var
- Arrow functions, async/await, try/catch
- DOMContentLoaded for DOM manipulation
- Every function must be complete — no stubs

═══════════════════════════════════════════════════════════════
  OUTPUT FORMAT — USE THIS EXACT FORMAT FOR EVERY FILE
═══════════════════════════════════════════════════════════════
---FILE: path/to/file.ext
[COMPLETE file content — every single line]
---END

---COMMAND: npm install something

═══════════════════════════════════════════════════════════════
  EXAMPLE — Complete Multi-File Project
═══════════════════════════════════════════════════════════════
---FILE: index.html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Site</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header><nav><h1>My Site</h1></nav></header>
  <main>
    <section class="hero">
      <h2>Welcome to My Site</h2>
      <p>This is a complete, production-quality website.</p>
    </section>
  </main>
  <footer><p>© 2026 My Site</p></footer>
  <script src="app.js"></script>
</body>
</html>
---END
---FILE: styles.css
:root {
  --color-primary: #6366f1;
  --color-bg: #0f0f14;
  --color-text: #e4e4ef;
  --font-sans: 'Inter', system-ui, sans-serif;
}
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: var(--font-sans); background: var(--color-bg); color: var(--color-text); }
.hero { padding: 6rem 2rem; text-align: center; }
.hero h2 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; }
.hero p { font-size: 1.15rem; color: #9494a8; margin-top: 1rem; }
footer { text-align: center; padding: 2rem; color: #9494a8; }
---END
---FILE: app.js
document.addEventListener('DOMContentLoaded', () => {
  console.log('Site loaded');
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

// ── Ink Components ────────────────────────────────────────────────────
const PURPLE = '#7C5CFC';
const PURPLE_BRIGHT = '#A78BFA';
const TEAL = '#2DD4BF';
const GREEN = '#34D399';
const RED = '#F87171';
const AMBER = '#FBBF24';

function GradientHeader() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={PURPLE_BRIGHT}>
        {'  ⚡ ██████ ██    ██ ███    ███ ██ ███    ██  █████  '}
      </Text>
      <Text bold color={PURPLE}>
        {'     ██   ██ ██    ██ ████   ██ ██ ████   ██ ██   ██ '}
      </Text>
      <Text bold color={PURPLE}>
        {'     ██████  ██    ██ ██ ██  ██ ██ ██ ██  ██ ██████  '}
      </Text>
      <Text bold color={PURPLE}>
        {'     ██   ██ ██    ██ ██  ██ ██ ██ ██  ██ ██ ██   ██ '}
      </Text>
      <Text bold color={PURPLE_BRIGHT}>
        {'     ██   ██  ██████  ██   ████ ██ ██   ████  ██████  '}
      </Text>
      <Newline />
      <Text color={TEAL}>  AI-Powered Website Generation</Text>
      <Text dimColor>  Create stunning, production-grade websites in seconds</Text>
    </Box>
  );
}

function ChatMessage({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <Box marginBottom={0}>
        <Text color={TEAL} bold>  › </Text>
        <Text color="white">{message.content}</Text>
      </Box>
    );
  }
  if (message.role === 'system') {
    return (
      <Box marginBottom={0}>
        <Text color={AMBER}>  ⚠ </Text>
        <Text color={AMBER}>{message.content}</Text>
      </Box>
    );
  }
  // Assistant
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={PURPLE_BRIGHT} bold>  ✦ Lumina</Text>
      {message.content.split('\n').map((line, i) => (
        <Text key={i} color="gray">{line}</Text>
      ))}
      {message.files && message.files.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {message.files.map((f, i) => (
            <Text key={i} color={GREEN}>  ✓ {f.path} ({(f.content.length / 1024).toFixed(1)}kb)</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function ProgressIndicator({ status, fileName, done }: { status: string; fileName?: string; done?: boolean }) {
  if (done) {
    return <Text color={GREEN}>  ✓ {fileName} done</Text>;
  }
  return (
    <Box>
      <Text color={PURPLE}>  ⏳ </Text>
      <Text color="gray">{status}{fileName ? ` — ${fileName}` : ''}</Text>
    </Box>
  );
}

// ── Main App ──────────────────────────────────────────────────────────
function App() {
  const { exit } = useApp();
  const [config, setConfig] = useState(loadConfig());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [progress, setProgress] = useState<{ status: string; fileName?: string; done?: boolean }[]>([]);
  const [createdFiles, setCreatedFiles] = useState<FileItem[]>([]);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(!config?.openrouterKey);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit();
  });

  const handleOnboardingSubmit = useCallback(() => {
    if (apiKeyInput.trim().length > 10) {
      const newConfig = { openrouterKey: apiKeyInput.trim() };
      saveConfig(newConfig);
      setConfig(newConfig);
      setShowOnboarding(false);
      setMessages([{ role: 'system', content: 'Welcome! I\'m Lumina, your AI coding assistant. Tell me what you want to build and I\'ll create something amazing.' }]);
    }
  }, [apiKeyInput]);

  const handleSubmit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
    setBusy(true);
    setProgress([]);

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);

    // Add engaging status messages
    const engagingMessages = [
      'Let me build something amazing for you...',
      'Crafting your perfect website...',
      'Generating production-grade code...',
      'Almost there, making it beautiful...',
      'Polishing the final details...',
    ];
    let msgIndex = 0;
    setStatus(engagingMessages[0]);

    try {
      const provider = new OpenRouterProvider(config.openrouterKey);
      const router = new AIRouter(provider);

      const sys = buildSystemPrompt(process.cwd());
      const aiMessages = [
        ...conversationHistory,
        { role: 'user', content: trimmed },
      ];

      // Update engaging message periodically
      const msgInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % engagingMessages.length;
        setStatus(engagingMessages[msgIndex]);
      }, 3000);

      const aiRequest = {
        system: sys,
        messages: aiMessages,
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        maxTokens: 16000,
        temperature: 0.1,
        topP: 0.95,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
        stream: true,
      };

      const stream = await router.stream(aiRequest);
      let fullContent = '';
      let finishReason: string | null = null;
      const fileProgress: { status: string; fileName?: string; done?: boolean }[] = [];

      for await (const chunk of stream) {
        fullContent += chunk.content;
        if (chunk.finishReason) finishReason = chunk.finishReason;

        // Detect file progress from content
        const fileMatches = fullContent.match(/---FILE:\s*([\w./\-_]+)/g);
        if (fileMatches) {
          const newProgress = fileMatches.map((match, i) => {
            const fileName = match.replace('---FILE:', '').trim();
            const isDone = fullContent.includes(`---END`) && fullContent.lastIndexOf('---END') > match.length;
            return { status: 'Creating', fileName, done: isDone };
          });
          setProgress(newProgress);
        }
      }

      clearInterval(msgInterval);

      // Auto-retry on truncation
      if (finishReason === 'length') {
        setProgress(prev => [...prev, { status: 'Output truncated, retrying...', done: false }]);
        const retryStream = await router.stream({
          ...aiRequest,
          messages: [
            ...aiMessages,
            { role: 'assistant', content: fullContent },
            { role: 'user', content: 'You stopped mid-generation. Continue from where you left off. Output ONLY remaining files using ---FILE: ... ---END format.' },
          ],
        });
        for await (const chunk of retryStream) {
          fullContent += chunk.content;
        }
      }

      // Parse files
      const files = parseFiles(fullContent);
      const commands = extractCommands(fullContent);

      // Create files
      const newProgress: { status: string; fileName?: string; done?: boolean }[] = [];
      for (const file of files) {
        newProgress.push({ status: 'Writing', fileName: file.path, done: false });
        setProgress([...newProgress]);

        try {
          const fp = join(process.cwd(), file.path);
          const dir = dirname(resolve(fp));
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(fp, file.content, 'utf-8');
          newProgress[newProgress.length - 1].done = true;
          setProgress([...newProgress]);
        } catch (e: any) {
          newProgress[newProgress.length - 1].status = `Error: ${e.message}`;
          setProgress([...newProgress]);
        }
      }

      // Run commands
      for (const cmd of commands) {
        newProgress.push({ status: 'Running', fileName: `$${cmd}`, done: false });
        setProgress([...newProgress]);
        try {
          execSync(cmd, { cwd: process.cwd(), encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 120000 });
          newProgress[newProgress.length - 1].done = true;
        } catch (e: any) {
          newProgress[newProgress.length - 1].status = `Failed: ${e.message}`;
        }
        setProgress([...newProgress]);
      }

      // Validate
      const warnings = validateFiles(files);
      if (warnings.length > 0) {
        warnings.forEach(w => {
          newProgress.push({ status: w, done: false });
        });
        setProgress([...newProgress]);
      }

      // Success message
      const totalKB = (files.reduce((s, f) => s + f.content.length, 0) / 1024).toFixed(1);
      newProgress.push({ status: `Done! ${files.length} file(s) · ${totalKB}kb`, done: true });
      setProgress([...newProgress]);

      // Add assistant message
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: `Your website is ready! I've created ${files.length} file(s) totaling ${totalKB}kb. The code is production-grade, responsive, and accessible. Open the HTML file in your browser to see it!`,
        files,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setCreatedFiles(prev => [...prev, ...files]);

      // Save to history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: fullContent },
      ].slice(-20));

      setStatus('Ready');
    } catch (e: any) {
      setStatus('Error');
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${e.message}` }]);
    }

    setBusy(false);
  }, [busy, config, conversationHistory]);

  // ── Onboarding ───────────────────────────────────────────────────────
  if (showOnboarding) {
    return (
      <Box flexDirection="column" padding={2}>
        <GradientHeader />
        <Newline />
        <Text color="white">  Welcome! Let's set up your AI coding agent.</Text>
        <Newline />
        <Text color="gray">  Enter your OpenRouter API key:</Text>
        <Box borderStyle="round" borderColor={PURPLE} paddingX={1}>
          <TextInput value={apiKeyInput} onChange={setApiKeyInput} onSubmit={handleOnboardingSubmit} placeholder="sk-or-..." />
        </Box>
        <Newline />
        <Text dimColor>  Get a free key at https://openrouter.ai/keys</Text>
      </Box>
    );
  }

  // ── Main Chat UI ─────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <GradientHeader />
      <Text dimColor>───────────────────────────────────────────────────────</Text>

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} paddingX={2}>
        {messages.length === 0 && (
          <Box flexDirection="column" marginBottom={2}>
            <Text color={PURPLE_BRIGHT}>  ✦ Lumina</Text>
            <Text color="white">  Hi! I'm Lumina, your AI coding assistant.</Text>
            <Text color="gray">  Tell me what website you want to build and I'll create it.</Text>
            <Text dimColor>  Type anything below to get started.</Text>
          </Box>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {/* Progress */}
        {progress.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {progress.map((p, i) => (
              <ProgressIndicator key={i} {...p} />
            ))}
          </Box>
        )}

        {/* Status */}
        {busy && (
          <Text color={PURPLE}>  ⏳ {status}</Text>
        )}
      </Box>

      {/* Input */}
      <Box borderStyle="round" borderColor={busy ? PURPLE : '#3F3F46'} paddingX={1}>
        <Text color={TEAL}>  › </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={busy ? 'Working...' : 'What do you want to build?'}
        />
      </Box>

      {/* Footer */}
      <Box paddingX={2}>
        <Text dimColor>  Ctrl+C to exit · {createdFiles.length} file(s) created</Text>
      </Box>
    </Box>
  );
}

// ── Run ───────────────────────────────────────────────────────────────
import { render } from 'ink';
render(<App />);
