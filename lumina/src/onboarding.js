import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadConfig, saveConfig } from './config.js';
import { OpenAIProvider } from './api/openai.js';
import { AnthropicProvider } from './api/anthropic.js';
import { GoogleProvider } from './api/google.js';
import { GroqProvider } from './api/groq.js';
import { TogetherProvider } from './api/together.js';
import { CustomProvider } from './api/custom.js';

function getProvider(providerName, config) {
  const providers = {
    openai: OpenAIProvider,
    anthropic: AnthropicProvider,
    google: GoogleProvider,
    groq: GroqProvider,
    together: TogetherProvider,
    custom: CustomProvider,
  };
  const Klass = providers[providerName];
  if (!Klass) throw new Error(`Unknown provider: ${providerName}`);
  return new Klass(config);
}

async function validateKeyWithRetry(provider, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await provider.validateKey();
      return true;
    } catch (err) {
      if (i < retries - 1) {
        console.log(chalk.red(`Validation failed: ${err.message}. Retrying... (${retries - i - 1} attempts left)`));
        const { retry } = await inquirer.prompt([{
          type: 'confirm',
          name: 'retry',
          message: 'Try again?',
          default: true
        }]);
        if (!retry) return false;
      } else {
        console.log(chalk.red(`Validation failed after ${retries} attempts: ${err.message}`));
        return false;
      }
    }
  }
  return false;
}

export async function runOnboarding(existingConfig = null) {
  console.log(chalk.cyan.bold('\n✦ Welcome to Lumina AI. Let\'s set you up. ✦\n'));

  const defaults = existingConfig || {};

  const { provider } = await inquirer.prompt([{
    type: 'list',
    name: 'provider',
    message: 'Which API provider?',
    choices: [
      { name: 'OpenAI', value: 'openai' },
      { name: 'Anthropic', value: 'anthropic' },
      { name: 'Google (Gemini)', value: 'google' },
      { name: 'Groq', value: 'groq' },
      { name: 'Together AI', value: 'together' },
      { name: 'Custom (bring your own base URL)', value: 'custom' },
    ],
    default: defaults.provider || 'openai'
  }]);

  let apiKey = defaults.apiKey || '';
  const { key } = await inquirer.prompt([{
    type: 'password',
    name: 'key',
    message: 'Enter your API key:',
    mask: '*',
    default: apiKey,
    validate: v => v.length > 0 || 'API key is required'
  }]);
  apiKey = key;

  let baseUrl = defaults.baseUrl || null;
  if (provider === 'custom') {
    const defaultUrl = 'https://api.example.com/v1';
    const { url } = await inquirer.prompt([{
      type: 'input',
      name: 'url',
      message: 'Enter your custom base URL (e.g. https://api.example.com/v1):',
      default: baseUrl || defaultUrl,
      validate: v => v.length > 0 || 'Base URL is required'
    }]);
    baseUrl = url;
  }

  const config = { ...defaults, provider, apiKey, baseUrl };
  const instance = getProvider(provider, config);

  console.log(chalk.yellow('\nValidating API key...'));
  const valid = await validateKeyWithRetry(instance);
  if (!valid) {
    console.log(chalk.red('Setup failed. Please try again with a valid API key.'));
    process.exit(1);
  }
  console.log(chalk.green('✓ API key validated\n'));

  console.log(chalk.yellow('Fetching available models...'));
  let models = [];
  try {
    models = await instance.listModels();
    console.log(chalk.green(`✓ Found ${models.length} models\n`));
  } catch (err) {
    console.log(chalk.yellow(`Could not fetch models: ${err.message}`));
    if (provider === 'custom') {
      const { manual } = await inquirer.prompt([{
        type: 'input',
        name: 'manual',
        message: 'Enter model names (comma-separated):',
        default: 'custom-model',
        validate: v => v.length > 0 || 'At least one model is required'
      }]);
      models = manual.split(',').map(m => m.trim());
    } else {
      models = defaults.availableModels || ['gpt-4o-mini'];
    }
  }

  const { defaultModel } = await inquirer.prompt([{
    type: 'list',
    name: 'defaultModel',
    message: 'Select your default model:',
    choices: models.map(m => ({ name: m, value: m })),
    default: defaults.defaultModel || models[0],
    pageSize: 20
  }]);

  const { persona } = await inquirer.prompt([{
    type: 'list',
    name: 'persona',
    message: 'Preferred persona?',
    choices: [
      { name: 'Planner', value: 'planner' },
      { name: 'Coder', value: 'coder' },
      { name: 'Reviewer', value: 'reviewer' },
      { name: 'Fixer', value: 'fixer' },
      { name: 'General', value: 'general' },
    ],
    default: defaults.persona || 'general'
  }]);

  const { tokenBudget } = await inquirer.prompt([{
    type: 'list',
    name: 'tokenBudget',
    message: 'Token budget preference?',
    choices: [
      { name: 'Efficient (512 tokens)', value: 512 },
      { name: 'Balanced (1024 tokens)', value: 1024 },
      { name: 'Expansive (2048 tokens)', value: 2048 },
      { name: 'Unlimited', value: 'unlimited' },
    ],
    default: defaults.tokenBudget || 1024
  }]);

  const finalConfig = {
    provider,
    apiKey,
    baseUrl,
    defaultModel,
    availableModels: models,
    persona,
    tokenBudget,
    firstRun: false,
    version: '1.0.0'
  };

  saveConfig(finalConfig);
  console.log(chalk.green.bold('\n✓ Setup complete. Run ' + chalk.cyan('lumina') + ' or ' + chalk.cyan('lumina-ai-cli') + ' to start.\n'));
}
