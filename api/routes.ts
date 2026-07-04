/**
 * Backend API routes — Express-style routes for Ollama integration.
 * These can be used with a standalone Express server or as reference
 * for the Vite dev server proxy middleware.
 *
 * For production (Vercel), each route is handled by separate files:
 *   api/ai.ts -> /api/ai/* (GET status, POST generate/stream)
 */

import { Router, Request, Response } from "express";
import { checkOllamaStatus, generateResponse, streamResponse } from "./ollama";

const router = Router();

router.post("/ai/status", async (req: Request, res: Response) => {
  try {
    const status = await checkOllamaStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      healthy: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/ai/chat", async (req: Request, res: Response) => {
  try {
    const { prompt, temperature } = req.body;

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "Missing or invalid prompt" });
      return;
    }

    const status = await checkOllamaStatus();
    if (!status.healthy || !status.modelLoaded) {
      res.status(503).json({ error: status.message });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    try {
      for await (const token of streamResponse(prompt, { temperature })) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (streamError) {
      res.write(
        `data: ${JSON.stringify({
          error: streamError instanceof Error ? streamError.message : "Stream error",
        })}\n\n`
      );
      res.end();
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/ai/generate", async (req: Request, res: Response) => {
  try {
    const { prompt, temperature } = req.body;

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "Missing or invalid prompt" });
      return;
    }

    const status = await checkOllamaStatus();
    if (!status.healthy || !status.modelLoaded) {
      res.status(503).json({ error: status.message });
      return;
    }

    const response = await generateResponse(prompt, { temperature });
    res.json({ response });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
