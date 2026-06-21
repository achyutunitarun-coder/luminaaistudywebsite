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

const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise(r => rl.question(q, r)); }

async function onboarding() {
  console.log('\n  ⚡ LUMINA CODE — AI Coding Agent\n');
  const apiKey = await ask('  Enter your OpenRouter API key: ');
  if (!apiKey.trim() || apiKey.trim().length < 10) { console.log('  ❌ Invalid key.'); process.exit(1); }
  const name = await ask('  Your name (optional): ');
  saveConfig({ openrouterKey: apiKey.trim(), userName: name.trim() || 'User' });
  console.log('  ✓ Ready!\n');
}

async function chat(config) {
  console.log('  Type what you want to build. I\'ll handle the rest.');
  console.log('  Commands: /help /clear /files /exit\n');

  const createdFiles = new Set();

  while (true) {
    const input = await ask('  > ');
    const trimmed = input.trim();
    if (!trimmed) continue;
    if (trimmed === '/exit' || trimmed === '/quit') break;
    if (trimmed === '/clear') { console.log('  ✓ Cleared.\n'); continue; }
    if (trimmed === '/files') {
      if (createdFiles.size === 0) { console.log('  No files yet.\n'); }
      else { console.log('  Files:'); for (const f of createdFiles) console.log(`    ${f}`); console.log(''); }
      continue;
    }
    if (trimmed === '/help') { console.log('  /help /clear /files /exit\n'); continue; }

    // Ultra-explicit system prompt
    const systemPrompt = `You are LUMINA CODE. You MUST output files using this EXACT format. Do NOT describe what you will do. DO IT.

OUTPUT THIS EXACT FORMAT — NO EXCEPTIONS:

FILENAME: index.html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Page</title>
<style>
/* ALL CSS here */
</style>
</head>
<body>
<!-- ALL HTML here -->
<script>
// ALL JavaScript here
</script>
</body>
</html>
END FILE

FILENAME: style.css
/* ALL CSS */
END FILE

FILENAME: script.js
// ALL JavaScript
END FILE

RULES:
- Start IMMEDIATELY with FILENAME: index.html
- Output COMPLETE file contents — every single line
- Do NOT output any text before FILENAME:
- Do NOT describe what you will do
- Do NOT output markdown code blocks
- ONLY use FILENAME: ... END FILE format
- Create ALL files needed for a complete working project

Working directory: ${process.cwd()}`;

    console.log('  ⏳ Generating...\n');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000);

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
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: trimmed },
          ],
          stream: true,
          max_tokens: 16000,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`);
      }

      // Stream and parse files in real-time
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentFile = null;
      let currentContent = '';
      let inFile = false;
      let fileCount = 0;
      let outputBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          let delta = '';
          try {
            const parsed = JSON.parse(data);
            delta = parsed.choices?.[0]?.delta?.content || '';
          } catch { continue; }

          if (!delta) continue;

          // Process delta for file detection
          for (let i = 0; i < delta.length; i++) {
            const char = delta[i];

            if (!inFile) {
              // Look for FILENAME:
              outputBuffer += char;
              if (outputBuffer.endsWith('FILENAME:')) {
                // Found it! Extract filename on next line
                currentFile = '';
                inFile = true;
                currentContent = '';
                outputBuffer = '';
                process.stdout.write('  📄 ');
              } else if (outputBuffer.length > 20) {
                // Not matching, flush
                process.stdout.write(outputBuffer);
                outputBuffer = '';
              }
            } else {
              // In filename or content
              if (char === '\n' && !currentFile.includes('/')) {
                // Still in filename line (no path separator yet)
                if (currentFile.length > 0 && !currentFile.includes('.')) {
                  // This is a path separator line, keep accumulating
                  currentFile += char;
                } else {
                  // End of filename
                  currentFile = currentFile.trim();
                  console.log(currentFile);
                  fileCount++;
                }
              } else if (currentFile && !currentContent && char === '\n' && currentFile.includes('.')) {
                // First newline after filename, start content
                currentContent = '';
              } else if (currentContent !== null) {
                currentContent += char;
                // Check for END FILE
                if (currentContent.endsWith('END FILE')) {
                  const fileContent = currentContent.slice(0, -8).trim();
                  try {
                    const filePath = join(process.cwd(), currentFile);
                    const dir = dirname(resolve(filePath));
                    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                    writeFileSync(filePath, fileContent, 'utf-8');
                    createdFiles.add(currentFile);
                    console.log(`  ✓ Saved: ${currentFile} (${fileContent.length} chars)`);
                  } catch (e) {
                    console.log(`  ✗ Error: ${currentFile}: ${e.message}`);
                  }
                  currentFile = null;
                  currentContent = null;
                  inFile = false;
                }
              } else {
                currentFile += char;
              }
            }
          }
        }
      }

      // Handle any remaining content
      if (inFile && currentFile && currentContent) {
        const fileContent = currentContent.replace(/END FILE$/, '').trim();
        if (fileContent) {
          try {
            const filePath = join(process.cwd(), currentFile);
            const dir = dirname(resolve(filePath));
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            writeFileSync(filePath, fileContent, 'utf-8');
            createdFiles.add(currentFile);
            console.log(`  ✓ Saved: ${currentFile} (${fileContent.length} chars)`);
          } catch (e) {
            console.log(`  ✗ Error: ${currentFile}: ${e.message}`);
          }
        }
      }

      console.log(`\n  📊 Created ${fileCount} file(s) | Total: ${createdFiles.size}`);
      console.log('');

    } catch (e) {
      console.log(`  ⚠ Error: ${e.message}\n`);
    }
  }

  rl.close();
}

const config = loadConfig();
if (!config?.openrouterKey) {
  onboarding().then(() => chat(loadConfig()).then(() => process.exit(0)));
} else {
  chat(config).then(() => process.exit(0));
}
