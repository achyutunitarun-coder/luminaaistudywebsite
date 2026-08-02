import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;

  if (!backendUrl || !publishableKey) {
    throw new Error("Missing authoritative backend configuration");
  }

  return ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "framer-motion"],
          supabase: ["@supabase/supabase-js", "@supabase/ssr"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tooltip", "@radix-ui/react-select", "@radix-ui/react-tabs"],
          pdf: ["pdfjs-dist"],
          xlsx: ["xlsx", "jszip"],
          katex: ["katex", "rehype-katex", "react-markdown", "remark-gfm", "remark-math", "rehype-raw"],
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  define: {
    // The generated auth client and all Edge Function callers must use the
    // same backend. These values are public browser configuration, not secrets.
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(backendUrl),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publishableKey),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  });
});
