import * as cp from "@clack/prompts";
import chalk from "chalk";
import type { KnownProvider, ProviderEntry, ProviderKey, ValidationStatus } from "../config/types.js";
import { KNOWN_PROVIDERS } from "../config/types.js";

// ─── Provider selection cards ───

export async function selectProviders(persona: string): Promise<ProviderEntry[]> {
  const providers: ProviderEntry[] = [];

  console.log(chalk.cyan.bold("\n  Add your API providers\n"));
  console.log(chalk.gray("  Pick at least one provider. Keys are encrypted at rest."));

  let adding = true;
  let firstRun = true;

  while (adding) {
    // Suggest most relevant provider based on persona
    const suggested = getSuggestedProvider(persona);

    const options = KNOWN_PROVIDERS.map((p, i) => ({
      value: p.id,
      label: `${getCostBadge(p.cost)} ${p.name}`,
      hint: p.description,
    }));

    if (!firstRun) {
      options.push({ value: "__done__", label: "Done adding providers", hint: "Continue to next step" });
    }

    const choice = await cp.select({
      message: firstRun ? chalk.bold(`Recommended: ${suggested.name}`) : "Add another provider:",
      options,
    });

    if (cp.isCancel(choice)) process.exit(0);

    if (choice === "__done__" && !firstRun) break;

    const provider = KNOWN_PROVIDERS.find(p => p.id === choice)!;
    const entry = await configureProvider(provider, persona);
    providers.push(entry);

    firstRun = false;

    if (providers.length >= 1) {
      const more = await cp.confirm({ message: "Add another provider?", initialValue: false });
      if (cp.isCancel(more)) process.exit(0);
      if (!more) break;
    }
  }

  return providers;
}

function getCostBadge(cost: string): string {
  if (cost.toLowerCase().includes("free")) return chalk.green("[FREE]");
  if (cost.toLowerCase().includes("cheap")) return chalk.yellow("[LOW]");
  return chalk.red("[PAID]");
}

function getSuggestedProvider(persona: string): KnownProvider {
  switch (persona) {
    case "student_researcher":
      return KNOWN_PROVIDERS.find(p => p.id === "google")!;
    case "solo_builder":
      return KNOWN_PROVIDERS.find(p => p.id === "openai")!;
    default:
      return KNOWN_PROVIDERS.find(p => p.id === "groq")!;
  }
}

// ─── Configure a single provider ───

async function configureProvider(provider: KnownProvider, persona: string): Promise<ProviderEntry> {
  console.log(chalk.cyan(`\n  Configuring ${provider.name}\n`));

  let baseUrl = provider.defaultBaseUrl;
  let customHeaders: Record<string, string> | undefined;

  // Custom endpoint needs extra fields
  if (provider.id === "custom") {
    baseUrl = await cp.text({
      message: "Base URL:",
      placeholder: "https://your-endpoint.com/v1",
      validate: v => v ? undefined : "Required",
    }) as string;
    if (cp.isCancel(baseUrl)) process.exit(0);

    customHeaders = {};
    const addHeaders = await cp.confirm({ message: "Add custom headers?", initialValue: false });
    if (!cp.isCancel(addHeaders) && addHeaders) {
      let addingHeaders = true;
      while (addingHeaders) {
        const key = await cp.text({ message: "Header name:", placeholder: "X-API-Key" }) as string;
        if (cp.isCancel(key)) break;
        const value = await cp.text({ message: "Header value:" }) as string;
        if (cp.isCancel(value)) break;
        if (key) customHeaders[key] = value || "";
        const more = await cp.confirm({ message: "Add another header?", initialValue: false });
        if (cp.isCancel(more) || !more) break;
      }
    }
  }

  // API Key entry
  const keys: ProviderKey[] = [];
  if (provider.needsApiKey) {
    const key = await cp.password({
      message: `API Key for ${provider.name}:`,
      mask: "*",
      validate: v => v ? undefined : "API key is required",
    }) as string;
    if (cp.isCancel(key)) process.exit(0);

    // Live validation
    const validationResult = await validateKey(provider, key, baseUrl);
    keys.push({
      label: `${provider.name} — added ${new Date().toLocaleDateString()}`,
      key_ref: key,
      validated_at: new Date().toISOString(),
      validation_status: validationResult.status,
    });

    if (validationResult.status === "invalid") {
      console.log(chalk.red(`\n  ✗ ${validationResult.message}`));
      const retry = await cp.confirm({ message: "Try again?", initialValue: true });
      if (cp.isCancel(retry)) process.exit(0);
      if (retry) return configureProvider(provider, persona);
    } else if (validationResult.status === "rate_limited") {
      console.log(chalk.yellow(`\n  ⚠ ${validationResult.message}`));
    } else {
      console.log(chalk.green(`\n  ✓ Key validated successfully`));
    }
  } else {
    keys.push({
      label: `${provider.name}`,
      key_ref: "",
      validated_at: new Date().toISOString(),
      validation_status: "valid",
    });
  }

  return {
    provider_id: provider.id,
    keys,
    base_url: baseUrl || undefined,
    custom_headers: customHeaders,
  };
}

// ─── Key validation ───

interface ValidationResult {
  status: ValidationStatus;
  message: string;
}

async function validateKey(provider: KnownProvider, key: string, baseUrl: string): Promise<ValidationResult> {
  const spinner = cp.spinner();
  spinner.start("Validating key...");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let url: string;
    let body: any;
    let headers: Record<string, string> = { "Content-Type": "application/json" };

    if (provider.id === "anthropic") {
      url = `${baseUrl.replace(/\/+$/, "")}/messages`;
      headers["x-api-key"] = key;
      headers["anthropic-version"] = "2023-06-01";
      body = {
        model: "claude-haiku-3-5",
        max_tokens: 10,
        messages: [{ role: "user", content: "hi" }],
      };
    } else if (provider.id === "google") {
      url = `${baseUrl.replace(/\/+$/, "")}/models/gemini-1.5-flash:generateContent?key=${key}`;
      body = { contents: [{ parts: [{ text: "hi" }] }] };
    } else {
      // OpenAI-compatible
      url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
      headers["Authorization"] = `Bearer ${key}`;
      body = {
        model: provider.defaultModel || "gpt-3.5-turbo",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      };
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    spinner.stop("");

    if (resp.ok) {
      return { status: "valid", message: "Key is valid" };
    }

    if (resp.status === 401 || resp.status === 403) {
      const text = await resp.text().catch(() => "");
      return { status: "invalid", message: `${provider.name} returned: ${text.slice(0, 200)}` };
    }

    if (resp.status === 429) {
      return { status: "rate_limited", message: "Key works but is currently rate-limited — you may hit limits early" };
    }

    const text = await resp.text().catch(() => "");
    return { status: "invalid", message: `HTTP ${resp.status}: ${text.slice(0, 200)}` };
  } catch (err: any) {
    spinner.stop("");
    if (err.name === "AbortError") {
      return { status: "invalid", message: "Connection timed out — check the URL and try again" };
    }
    return { status: "invalid", message: `Network error: ${err.message}` };
  }
}
