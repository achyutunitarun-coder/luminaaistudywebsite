import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function saveConversation(messages, filename) {
  const dir = path.join(os.homedir(), '.lumina', 'conversations');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, filename.endsWith('.json') ? filename : `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf-8');
  return filePath;
}

export function loadConversation(filepath) {
  try {
    const raw = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function listConversations() {
  const dir = path.join(os.homedir(), '.lumina', 'conversations');
  try {
    if (fs.existsSync(dir)) {
      return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    }
  } catch {}
  return [];
}

export function exportAsMarkdown(messages, filename) {
  const dir = path.join(os.homedir(), '.lumina', 'exports');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, filename.endsWith('.md') ? filename : `${filename}.md`);
  const lines = [];
  lines.push('# Lumina AI Conversation Export');
  lines.push('_Exported ' + new Date().toISOString() + '_');
  lines.push('');
  for (const msg of messages) {
    if (msg.role === 'system' && !msg.isMemory) continue;
    const role = msg.role === 'user' ? '**You**' : msg.isMemory ? '*Memory*' : '**Lumina**';
    lines.push('### ' + role);
    lines.push('');
    lines.push(msg.content || '');
    lines.push('');
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}

export function detectFileExtension(language) {
  const extMap = {
    javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts',
    tsx: 'tsx', python: 'py', py: 'py', ruby: 'rb', rb: 'rb',
    go: 'go', rust: 'rs', rs: 'rs', c: 'c', cpp: 'cpp',
    java: 'java', kotlin: 'kt', scala: 'scala', swift: 'swift',
    php: 'php', html: 'html', css: 'css', scss: 'scss', less: 'less',
    sql: 'sql', sh: 'sh', bash: 'sh', yaml: 'yml', yml: 'yml',
    json: 'json', xml: 'xml', markdown: 'md', md: 'md',
  };
  return extMap[language?.toLowerCase()] || 'txt';
}

export function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const lang = match[1] || 'txt';
    let code = match[2];
    let filename = '';

    const firstLine = code.split('\n')[0].trim();
    const fileMatch = firstLine.match(/^\/\/\s*(\S+\.[a-z]+(?:\.[a-z]+)?)/i) || firstLine.match(/^#\s*(\S+\.[a-z]+(?:\.[a-z]+)?)/i) || firstLine.match(/^--\s*(\S+\.[a-z]+(?:\.[a-z]+)?)/i);
    if (fileMatch) {
      filename = fileMatch[1];
      code = code.split('\n').slice(1).join('\n').trim();
    }

    blocks.push({ lang, code, filename: filename || detectFileName(lang, code) });
  }
  return blocks;
}

export function detectFileName(lang, code) {
  const firstWords = code.trim().split(/\s+/).slice(0, 4).join('_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  const key = firstWords.slice(0, 20) || 'output';
  const ext = detectFileExtension(lang);
  return key + '.' + ext;
}

export function writeAllCodeBlocks(text, onWrite) {
  const blocks = extractCodeBlocks(text);
  const results = [];
  for (const block of blocks) {
    try {
      const filePath = writeCodeFile(block.code, block.filename);
      results.push({ filename: block.filename, path: filePath, lang: block.lang });
      if (onWrite) onWrite(block.filename, filePath);
    } catch (err) {
      results.push({ filename: block.filename, error: err.message });
    }
  }
  return results;
}

export function writeCodeFile(content, filename) {
  const cwd = process.cwd();
  const filePath = path.join(cwd, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}
