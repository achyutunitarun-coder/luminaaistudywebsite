# Ollama local backend for Lumina

This integration uses Ollama locally with the model qwen2.5-coder:3b.

## Requirements

- Install Ollama from https://ollama.com/
- Pull the model:

```bash
ollama pull qwen2.5-coder:3b
```

- Start the Ollama service locally:

```bash
ollama serve
```

## Environment variables

Create a .env file in the project root with:

```env
VITE_OLLAMA_API_BASE=/api
VITE_OLLAMA_MODEL=qwen2.5-coder:3b
VITE_OLLAMA_TIMEOUT_MS=45000
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b
OLLAMA_TIMEOUT_MS=45000
```

## Run the app

```bash
npm install
npm run dev
```

Then open the local chat page at /chat.

## Backend endpoints

- GET /api/ai -> checks backend status
- POST /api/ai -> sends prompt to Ollama and returns a response
- POST /api/ai with { "stream": true } -> streams SSE tokens from Ollama
