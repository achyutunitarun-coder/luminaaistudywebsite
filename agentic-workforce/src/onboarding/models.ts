import * as cp from "@clack/prompts";
import chalk from "chalk";
import type { ProviderEntry, ModelEntry } from "../config/types.js";
import { KNOWN_PROVIDERS } from "../config/types.js";

// ─── Model picker ───

export async function pickModels(providers: ProviderEntry[], existingModels: ModelEntry[] = []): Promise<ModelEntry[]> {
  const models: ModelEntry[] = [...existingModels];

  console.log(chalk.cyan.bold("\n  Select your models\n"));

  for (const provider of providers) {
    const known = KNOWN_PROVIDERS.find(p => p.id === provider.provider_id);
    const knownModels = known?.knownModels ?? [];

    // Fetch live model list for applicable providers
    let availableModels = knownModels;

    console.log(chalk.cyan(`  Models from ${known?.name ?? provider.provider_id}\n`));

    let adding = true;
    while (adding) {
      // Show already-added models for this provider
      const addedHere = models.filter(m => m.provider_id === provider.provider_id);

      const options = [
        ...availableModels
          .filter(m => !addedHere.some(a => a.model_id === m))
          .map(m => ({
            value: m,
            label: m,
            hint: getModelHint(m, provider.provider_id),
          })),
        { value: "__custom__", label: "Add custom model ID", hint: "Enter a model not in the list" },
      ];

      if (addedHere.length > 0) {
        options.push({ value: "__done__", label: "Done adding models", hint: `${addedHere.length} model(s) selected` });
      }

      const choice = (await cp.select({
        message: addedHere.length > 0 ? "Add another model or finish:" : "Choose a model to add:",
        options,
      })) as string;

      if (cp.isCancel(choice)) process.exit(0);

      if (choice === "__done__") break;

      if (choice === "__custom__") {
        const customId = await cp.text({
          message: "Enter model ID:",
          placeholder: "e.g., my-fine-tune-v2",
          validate: v => v ? undefined : "Required",
        }) as string;
        if (cp.isCancel(customId)) process.exit(0);

        const valid = await validateCustomModel(customId, provider);
        if (valid) {
          const pin = await cp.confirm({ message: "Pin this model for quick access?", initialValue: false });
          models.push({
            model_id: customId,
            provider_id: provider.provider_id,
            is_custom_entry: true,
            pinned: !cp.isCancel(pin) && pin,
            context_window: null,
            max_output: null,
          });
          console.log(chalk.green(`  ✓ ${customId} added${!cp.isCancel(pin) && pin ? " (pinned)" : ""}\n`));
        } else {
          console.log(chalk.yellow("  Model not added — try a different ID\n"));
        }
      } else {
        const pin = await cp.confirm({ message: `Pin "${choice}" for quick access?`, initialValue: false });
        models.push({
          model_id: choice,
          provider_id: provider.provider_id,
          is_custom_entry: false,
          pinned: !cp.isCancel(pin) && pin,
          context_window: getContextWindow(choice),
          max_output: getMaxOutput(choice),
        });
        console.log(chalk.green(`  ✓ ${choice} added${!cp.isCancel(pin) && pin ? " (pinned)" : ""}\n`));
      }
    }
  }

  return models;
}

function getModelHint(_modelId: string, providerId: string): string {
  if (providerId === "groq") return chalk.green("Fast");
  return "";
}

function getContextWindow(_modelId: string): number | null {
  return null;
}

function getMaxOutput(_modelId: string): number | null {
  return null;
}

// ─── Fallback Chain Builder ───

export async function buildFallbackChain(
  role: string,
  models: ModelEntry[],
  currentPrimary: string,
): Promise<{ primary: string; fallback: string[] }> {
  console.log(chalk.cyan(`\n  Configure fallback chain for ${role}\n`));

  const modelOptions = models.map(m => ({
    value: m.model_id,
    label: `${m.pinned ? "★ " : "  "}${m.model_id}${m.is_custom_entry ? chalk.gray(" (custom)") : ""}`,
  }));

  const primary = await cp.select({
    message: "Primary model:",
    options: modelOptions,
    initialValue: currentPrimary || undefined,
  }) as string;
  if (cp.isCancel(primary)) process.exit(0);

  const remaining = modelOptions.filter(m => m.value !== primary);
  const fallback = await cp.multiselect({
    message: "Fallback models (in priority order):",
    options: remaining,
    required: false,
  }) as string[];
  if (cp.isCancel(fallback)) process.exit(0);

  return { primary, fallback };
}

// ─── Custom model validation ───

async function validateCustomModel(modelId: string, provider: ProviderEntry): Promise<boolean> {
  const spinner = cp.spinner();
  spinner.start(`Validating ${modelId}...`);

  try {
    const known = KNOWN_PROVIDERS.find(p => p.id === provider.provider_id);
    const baseUrl = provider.base_url || known?.defaultBaseUrl || "";
    const key = provider.keys[0]?.key_ref || "";

    let url: string;
    let body: any;
    let headers: Record<string, string> = { "Content-Type": "application/json" };

    if (provider.provider_id === "anthropic") {
      url = `${baseUrl.replace(/\/+$/, "")}/messages`;
      headers["x-api-key"] = key;
      headers["anthropic-version"] = "2023-06-01";
      body = { model: modelId, max_tokens: 5, messages: [{ role: "user", content: "hi" }] };
    } else if (provider.provider_id === "google") {
      url = `${baseUrl.replace(/\/+$/, "")}/models/${modelId}:generateContent?key=${key}`;
      body = { contents: [{ parts: [{ text: "hi" }] }] };
    } else {
      url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
      if (key) headers["Authorization"] = `Bearer ${key}`;
      body = { model: modelId, messages: [{ role: "user", content: "hi" }], max_tokens: 5 };
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    spinner.stop("");

    if (resp.ok) {
      console.log(chalk.green(`  ✓ ${modelId} responds correctly`));
      return true;
    }

    const text = await resp.text().catch(() => "");
    console.log(chalk.red(`  ✗ ${text.slice(0, 200)}`));
    return false;
  } catch (err: any) {
    spinner.stop("");
    console.log(chalk.red(`  ✗ ${err.message}`));
    return false;
  }
}
