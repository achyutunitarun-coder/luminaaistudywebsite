// @ts-nocheck
import { Message, ToolCall, callModel } from '../models/openrouter.js';
import { LuminaConfig } from '../utils/config.js';
import * as tools from '../tools/index.js';
import { EventEmitter } from 'events';

export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'text'; content: string }
  | { type: 'tool_start'; tool: string; args: string }
  | { type: 'tool_end'; tool: string; output: string }
  | { type: 'error'; message: string }
  | { type: 'done'; summary: string }
  | { type: 'ask'; question: string; resolve: (answer: string) => void };

const SYSTEM_PROMPT = `You are LUMINA CODE — an elite AI coding agent running locally on the user's machine. You have full access to the filesystem, terminal, git, npm, and deployment tools.

## YOUR CAPABILITIES
- Read, write, edit any file
- Run any shell command
- Install packages, run builds
- Git operations (commit, push, branch)
- Deploy to Vercel
- Search files and code
- Spawn sub-agents for parallel work

## HOW YOU WORK
1. **PLAN**: Analyze the task. Create a step-by-step plan. Think about file structure, dependencies, edge cases.
2. **ACT**: Execute tools one at a time. Read files before editing. Check if packages exist before installing.
3. **VALIDATE**: After each step, verify it worked. Run builds. Check for errors.
4. **ITERATE**: If something fails, debug and fix. Don't give up after one attempt.
5. **COMPLETE**: When done, summarize what was built and how to use it.

## RULES
- Always read a file before editing it
- Run \`npm install\` before importing packages
- Test builds after making changes
- Use \`git status\` before committing
- Ask before destructive operations (rm -rf, git push --force, deploy)
- Create beautiful, production-quality code
- Use modern best practices (TypeScript, ES modules, etc.)
- Write clean, well-commented code
- Handle errors gracefully

## OUTPUT FORMAT
When you need to use a tool, output ONLY the tool call in this format:
\`\`\`
TOOL: <tool_name>
PARAMS: <json_params>
\`\`\`

Example:
\`\`\`
TOOL: write_file
PARAMS: {"path": "src/App.tsx", "content": "..."}
\`\`\`

After the tool executes, you'll see the result. Then continue with the next step.

## QUALITY STANDARDS
- Every file you create should be production-ready
- Use proper TypeScript types
- Handle edge cases
- Write accessible, responsive UI
- Follow the project's existing code style
- Use the project's existing dependencies when possible

Now let's build something amazing.`;

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Run a shell command. Use for any terminal operation.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to run' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'File content' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edit a file by replacing exact text.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          old_string: { type: 'string', description: 'Exact text to find' },
          new_string: { type: 'string', description: 'Replacement text' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and directories.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for files by name pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.ts")' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search for text within files.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern (regex)' },
          path: { type: 'string', description: 'File or directory to search' },
        },
        required: ['pattern', 'path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git',
      description: 'Run git commands.',
      parameters: {
        type: 'object',
        properties: {
          args: { type: 'string', description: 'Git command arguments (e.g. "status", "add .")' },
        },
        required: ['args'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'npm',
      description: 'Run npm commands.',
      parameters: {
        type: 'object',
        properties: {
          args: { type: 'string', description: 'Npm command arguments (e.g. "install", "run build")' },
        },
        required: ['args'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deploy',
      description: 'Deploy to Vercel.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Deployment target (default: "vercel")' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask',
      description: 'Ask the user for permission or input.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Question to ask' },
        },
        required: ['question'],
      },
    },
  },
];

export class Agent extends EventEmitter {
  private messages: Message[] = [];
  private config: LuminaConfig;
  private model: string;
  private cwd: string;
  private autoApprove: boolean;
  private totalTokens = 0;

  constructor(config: LuminaConfig, model: string, cwd: string, autoApprove: boolean) {
    super();
    this.config = config;
    this.model = model;
    this.cwd = cwd;
    this.autoApprove = autoApprove;
    this.messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  async run(prompt: string): Promise<string> {
    this.messages.push({ role: 'user', content: prompt });
    this.emit('event', { type: 'thinking' });

    let iterations = 0;
    const maxIterations = 50;

    while (iterations < maxIterations) {
      iterations++;

      const { content, toolCalls, tokens } = await callModel(
        this.config.openrouterKey,
        this.model,
        this.messages,
        TOOL_DEFINITIONS,
        (chunk) => this.emit('event', { type: 'text', content: chunk }),
      );
      this.totalTokens += tokens;

      this.messages.push({ role: 'assistant', content });

      if (toolCalls.length === 0) {
        // No more tools to call, we're done
        this.emit('event', { type: 'done', summary: content });
        return content;
      }

      // Execute each tool call
      for (const tc of toolCalls) {
        const args = JSON.parse(tc.function.arguments || '{}');
        this.emit('event', { type: 'tool_start', tool: tc.function.name, args: JSON.stringify(args) });

        try {
          const output = await this.executeTool(tc.function.name, args);
          this.emit('event', { type: 'tool_end', tool: tc.function.name, output });
          this.messages.push({
            role: 'tool',
            content: output,
            tool_call_id: tc.id,
          });
        } catch (e: any) {
          const errMsg = e.message || String(e);
          this.emit('event', { type: 'error', message: errMsg });
          this.messages.push({
            role: 'tool',
            content: `Error: ${errMsg}`,
            tool_call_id: tc.id,
          });
        }
      }
    }

    const summary = `Reached max iterations (${maxIterations}). Total tokens: ${this.totalTokens}`;
    this.emit('event', { type: 'done', summary });
    return summary;
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'bash':
        return tools.runCommand(args.command as string, this.cwd).stdout;
      case 'read_file':
        return tools.readFile(args.path as string);
      case 'write_file':
        tools.writeFile(args.path as string, args.content as string);
        return `Wrote ${args.content?.toString().length || 0} chars to ${args.path}`;
      case 'edit_file':
        tools.editFile(args.path as string, args.old_string as string, args.new_string as string);
        return `Edited ${args.path}`;
      case 'list_dir':
        const entries = tools.listDir(args.path as string);
        return entries.map(e => `${e.isDir ? '📁' : '📄'} ${e.name}${e.isDir ? '' : ` (${e.size}B)`}`).join('\n');
      case 'search_files':
        return tools.searchFiles(args.pattern as string, this.cwd).join('\n') || 'No files found';
      case 'grep':
        return tools.grep(args.pattern as string, args.path as string).join('\n') || 'No matches';
      case 'git':
        return tools.git(args.args as string, this.cwd);
      case 'npm':
        return tools.npm(args.args as string, this.cwd);
      case 'deploy':
        return tools.deployVercel(this.cwd);
      case 'ask':
        if (this.autoApprove) return 'yes';
        return new Promise<string>((resolve) => {
          this.emit('event', { type: 'ask', question: args.question as string, resolve });
        });
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}
