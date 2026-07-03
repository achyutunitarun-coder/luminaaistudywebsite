import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ModeRouter } from "../_shared/mode-router.ts";
const modeRouter = new ModeRouter();
serve(async (req) => {
  return new Response("OK", { status: 200 });
});
