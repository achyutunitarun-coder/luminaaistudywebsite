import express from 'express';
import cors from 'cors';

const PORT = process.env.OLLAMA_SERVER_PORT || 3001;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b';
const REQUEST_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);

const app = express();
app.use(cors());
app.use(express.json());

async function fetchOllama(path, options = {}) {
  const url = `${OLLAMA_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/api/ai/status', async (_req, res) => {
  try {
    const resp = await fetchOllama('/api/tags');
    if (!resp.ok) {
      return res.status(503).json({ status: 'error', message: 'Ollama is not running' });
    }
    const data = await resp.json();
    const models = (data.models || []).map(m => m.name);
    const available = models.includes(OLLAMA_MODEL);
    return res.json({
      status: 'ok',
      ollamaRunning: true,
      modelAvailable: available,
      currentModel: OLLAMA_MODEL,
      availableModels: models,
    });
  } catch (err) {
    const message = err.name === 'AbortError' ? 'Request timed out' : 'Ollama is not running';
    return res.status(503).json({ status: 'error', message, detail: err.message });
  }
});

app.post('/api/ai/generate', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  try {
    const resp = await fetchOllama('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      if (resp.status === 404) {
        return res.status(404).json({ error: `Model "${OLLAMA_MODEL}" not found. Please run: ollama pull ${OLLAMA_MODEL}` });
      }
      return res.status(resp.status).json({ error: `Ollama error: ${text.slice(0, 200)}` });
    }
    const data = await resp.json();
    return res.json({ response: data.response });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    return res.status(503).json({ error: 'Ollama is not running', detail: err.message });
  }
});

app.post('/api/ai/stream', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  try {
    const resp = await fetchOllama('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: true }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      if (resp.status === 404) {
        return res.status(404).json({ error: `Model "${OLLAMA_MODEL}" not found. Please run: ollama pull ${OLLAMA_MODEL}` });
      }
      return res.status(resp.status).json({ error: `Ollama error: ${text.slice(0, 200)}` });
    }
    if (!resp.body) {
      return res.status(502).json({ error: 'Ollama returned no response body' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;

    const abortHandler = () => {
      done = true;
      reader.cancel().catch(() => {});
      res.end();
    };
    req.on('close', abortHandler);

    while (!done) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.done) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          } else if (parsed.response) {
            res.write(`data: ${JSON.stringify({ token: parsed.response })}\n\n`);
          }
        } catch {
          // skip malformed lines
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        if (parsed.response) {
          res.write(`data: ${JSON.stringify({ token: parsed.response })}\n\n`);
        }
        if (parsed.done) {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        }
      } catch {
        // skip
      }
    }

    if (!done) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }
    res.end();
  } catch (err) {
    if (res.headersSent) {
      try {
        res.write(`data: ${JSON.stringify({ error: err.name === 'AbortError' ? 'Request timed out' : 'Ollama is not running', done: true })}\n\n`);
        res.end();
      } catch { /* ignore */ }
      return;
    }
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    return res.status(503).json({ error: 'Ollama is not running', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ollama proxy server running on http://localhost:${PORT}`);
  console.log(`  Ollama URL: ${OLLAMA_BASE_URL}`);
  console.log(`  Model: ${OLLAMA_MODEL}`);
  console.log(`  Timeout: ${REQUEST_TIMEOUT_MS}ms`);
});
