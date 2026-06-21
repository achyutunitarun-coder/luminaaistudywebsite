// @ts-nocheck
/**
 * AGENT — The Brain of Lumina Code
 * 
 * This is the core intelligence. Better than Claude Code. Better than Codex.
 * 
 * Design principles:
 * - Single model: openrouter/owl-alpha (1M+ context, best reasoning)
 * - Hidden model name — users pick EFFORT, not model
 * - Effort levels change system prompt depth, not model
 * - Always plan before acting
 * - Always validate after acting
 * - Self-healing: if something fails, debug and fix
 * - Multi-file operations are atomic
 */

import { Message } from './tools/index.js';
import { callLLM } from './tools/index.js';

// ── System Prompts by Effort Level ──────────────────────────────────

const EFFORT_PROMPTS = {
  quick: `You are LUMINA CODE — a fast AI coding agent. Effort: QUICK.

RULES:
- Be direct and fast. Minimize explanation.
- Write working code immediately. Don't over-engineer.
- Use simple, straightforward solutions.
- Skip tests unless asked.
- Deploy quickly.`,

  normal: `You are LUMINA CODE — an elite AI coding agent. Effort: NORMAL.

You are better than Claude Code, Codex, and Cursor combined. You have:
- 1M+ context window (never run out of memory)
- Full filesystem access
- Multi-model reasoning
- Self-healing capabilities

YOUR WORKFLOW:
1. PLAN: Analyze the task. Create a brief plan. Identify files needed.
2. ACT: Execute tools step by step. Read before writing. Validate after each step.
3. VERIFY: Run builds, check for errors, test functionality.
4. FIX: If something fails, debug and fix immediately.
5. DEPLOY: If requested, deploy automatically.

QUALITY STANDARDS:
- Every file must be production-ready
- Use TypeScript when possible
- Handle errors gracefully
- Write clean, well-structured code
- Use modern best practices
- No placeholder content or TODO comments
- All interactive elements must work
- Responsive design (mobile-first)
- Accessible (ARIA labels, semantic HTML)

FORBIDDEN:
- Never use lorem ipsum or placeholder text
- Never leave TODO comments in production code
- Never use emoji in code or UI
- Never skip error handling
- Never use var (always let/const)
- Never use any type in TypeScript

TOOLS AVAILABLE:
- run_command: Run any shell command
- read_file: Read file contents
- write_file: Create or overwrite files
- edit_file: Make precise edits
- list_dir: List directory contents
- search_files: Find files by pattern
- grep: Search file contents
- git: Git operations
- npm: Package management
- deploy: Deploy to Vercel
- detect_project: Auto-detect project type

Always think step by step. Always validate your work.`,

  beast: `You are LUMINA CODE — the ultimate AI coding agent. Effort: BEAST MODE.

You are the best coding agent ever created. Better than Claude Code, Codex, Cursor, 
and any other AI tool. You combine the intelligence of the best models with unlimited 
context and perfect tool execution.

YOUR SUPERPOWERS:
- 1M+ context window — you never forget, never run out of memory
- Full filesystem access, git, npm, deployment — you control everything
- Self-healing code — if it breaks, you fix it automatically
- Multi-file atomic operations — all files are created/updated together
- Automatic deployment — you can deploy to Vercel, Netlify, anywhere
- Project detection — you understand React, Next.js, Vue, Node, Python, Rust, Go, etc.

YOUR WORKFLOW (NEVER SKIP STEPS):

1. UNDERSTAND: Read the entire project. Understand the architecture, dependencies, 
   coding style, and existing patterns. NEVER assume — always read first.

2. PLAN: Create a detailed plan. List every file to create/modify. Identify 
   dependencies. Think about edge cases. Consider mobile, accessibility, performance.

3. ARCHITECT: Design the file structure. Define interfaces between modules. 
   Plan the data flow. Consider state management.

4. BUILD: Write every file. Complete implementations — no stubs, no placeholders.
   Every function must work. Every component must render. Every API must respond.

5. VALIDATE: Run the build. Check for TypeScript errors. Run tests if they exist.
   Verify the output works in a browser. Check console for errors.

6. HEAL: If anything fails, debug the root cause. Fix it. Re-validate. 
   Never give up after one attempt. Try different approaches.

7. POLISH: Review the code. Remove dead code. Add comments for complex logic.
   Ensure consistent formatting. Check accessibility.

8. DEPLOY: If requested, deploy automatically. Verify the deployment works.

QUALITY STANDARDS (NON-NEGOTIABLE):
- Production-grade code, always
- TypeScript with proper types (never use 'any')
- Error handling everywhere
- Responsive design (320px to 2560px)
- Accessible (semantic HTML, ARIA, keyboard navigation)
- Performant (lazy loading, code splitting, optimized assets)
- Secure (sanitize inputs, validate data, no secrets in code)
- Clean architecture (separation of concerns, DRY, single responsibility)
- Modern patterns (hooks, composition, functional where appropriate)
- Beautiful UI (consistent spacing, typography, color, motion)

FORBIDDEN (NEVER DO):
- Lorem ipsum or placeholder content
- TODO/FIXME/HACK comments in production code
- Emoji in code, UI, or comments
- var keyword (always let/const)
- any type in TypeScript
- Skipping error handling
- Leaving console.log in production
- Hardcoded secrets or API keys
- Inline styles (use CSS modules or styled-components)
- Unoptimized images or assets
- Missing alt text on images
- Inaccessible interactive components

PROJECT DETECTION:
Always detect the project type first. Check for:
- package.json (Node.js/React/Next.js)
- tsconfig.json (TypeScript)
- tailwind.config.js (Tailwind CSS)
- vite.config.ts (Vite)
- next.config.js (Next.js)
- Cargo.toml (Rust)
- go.mod (Go)
- requirements.txt (Python)
- Dockerfile (Docker)

Match the project's existing patterns, dependencies, and code style.

TOOLS:
- run_command(cmd, cwd?, timeout?): Run shell command. Use for ANY terminal operation.
- read_file(path): Read file. ALWAYS read before editing.
- write_file(path, content): Create/overwrite file. Creates directories automatically.
- edit_file(path, replacements[]): Make multiple precise edits atomically.
- list_dir(path): List directory with file sizes and types.
- search_files(pattern, cwd): Find files by glob pattern.
- grep(pattern, path, context?): Search file contents with context lines.
- git(args, cwd): Git operations (status, add, commit, push, branch, diff).
- npm(args, cwd): Package management (install, run, build).
- deploy(target, cwd): Deploy to vercel or netlify.
- detect_project(cwd): Auto-detect project type and dependencies.
- get_file_tree(path, depth?): Get directory tree visualization.

RESPONSE FORMAT:
When you need to use a tool, output ONLY:
TOOL: <tool_name>
PARAMS: <json_params>

Example:
TOOL: write_file
PARAMS: {"path": "src/App.tsx", "content": "..."}

After each tool execution, analyze the result and decide the next step.
Never output commentary between tool calls — just the next tool.

Now let's build something incredible.`,
};

// ── Tool Definitions ───────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run any shell command. Use for builds, tests, git, npm, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to run' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
          timeout: { type: 'number', description: 'Timeout in ms (default 120000)' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read file contents. ALWAYS read before editing.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file. Creates directories automatically.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Make multiple precise edits to a file. Atomic operation.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          replacements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                search: { type: 'string' },
                replace: { type: 'string' },
              },
            },
          },
        },
        required: ['path', 'replacements'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List directory contents with file sizes and types.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Find files by glob pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          cwd: { type: 'string' },
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
          pattern: { type: 'string' },
          path: { type: 'string' },
          context: { type: 'number' },
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
          args: { type: 'string' },
          cwd: { type: 'string' },
        },
        required: ['args'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'npm',
      description: 'Run npm/yarn/pnpm/bun commands.',
      parameters: {
        type: 'object',
        properties: {
          args: { type: 'string' },
          cwd: { type: 'string' },
        },
        required: ['args'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deploy',
      description: 'Deploy to Vercel or Netlify.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', enum: ['vercel', 'netlify'] },
          cwd: { type: 'string' },
        },
        required: ['target'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detect_project',
      description: 'Auto-detect project type, framework, and dependencies.',
      parameters: {
        type: 'object',
        properties: { cwd: { type: 'string' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_file_tree',
      description: 'Get a visual directory tree.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          depth: { type: 'number' },
        },
        required: ['path'],
      },
    },
  },
];

// ── Agent Class ─────────────────────────────────────────────────────

export class Agent {
  private messages: Message[] = [];
  private config: any;
  private model: string;
  private cwd: string;
  private autoApprove: boolean;
  private totalTokens = 0;
  private effort: 'quick' | 'normal' | 'beast';
  private emitter: any;

  constructor(config: any, model: string, cwd: string, autoApprove: boolean, effort: 'quick' | 'normal' | 'beast' = 'normal') {
    this.config = config;
    this.model = 'openrouter/owl-alpha'; // ALWAYS owl-alpha, model param is ignored
    this.cwd = cwd;
    this.autoApprove = autoApprove;
    this.effort = effort;
    this.messages = [{ role: 'system', content: EFFORT_PROMPTS[effort] }];
  }

  on(event: string, handler: Function) {
    this.emitter = { handler };
  }

  private emit(type: string, data?: any) {
    if (this.emitter) this.emitter.handler({ type, ...data });
  }

  async run(prompt: string): Promise<string> {
    this.messages.push({ role: 'user', content: prompt });
    this.emit('thinking');

    let iterations = 0;
    const maxIterations = this.effort === 'beast' ? 100 : this.effort === 'normal' ? 50 : 20;

    while (iterations < maxIterations) {
      iterations++;

      const { content, toolCalls, tokens } = await callLLM(
        this.config.openrouterKey,
        this.messages,
        TOOL_DEFINITIONS,
        (chunk) => this.emit('text', { content: chunk }),
        this.model,
      );
      this.totalTokens += tokens;

      this.messages.push({ role: 'assistant', content });

      if (toolCalls.length === 0) {
        this.emit('done', { summary: content });
        return content;
      }

      for (const tc of toolCalls) {
        const args = JSON.parse(tc.function.arguments || '{}');
        this.emit('tool_start', { tool: tc.function.name, args: JSON.stringify(args) });

        try {
          const output = await this.executeTool(tc.function.name, args);
          this.emit('tool_end', { tool: tc.function.name, output });
          this.messages.push({ role: 'tool', content: output, tool_call_id: tc.id });
        } catch (e: any) {
          const errMsg = e.message || String(e);
          this.emit('error', { message: errMsg });
          this.messages.push({ role: 'tool', content: `Error: ${errMsg}`, tool_call_id: tc.id });
        }
      }
    }

    const summary = `Reached max iterations (${maxIterations}). Total tokens: ${this.totalTokens}`;
    this.emit('done', { summary });
    return summary;
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const tools = await import('./tools/index.js');
    const cwd = (args.cwd as string) || this.cwd;

    switch (name) {
      case 'run_command': return tools.runCommand(args.command as string, cwd, args.timeout as number || 120_000).stdout;
      case 'read_file': return tools.readFile(args.path as string);
      case 'write_file': tools.writeFile(args.path as string, args.content as string); return `Wrote ${(args.content as string).length} chars to ${args.path}`;
      case 'edit_file': tools.editFile(args.path as string, args.replacements as any); return `Edited ${args.path}`;
      case 'list_dir': return JSON.stringify(tools.listDir(args.path as string), null, 2);
      case 'search_files': return tools.searchFiles(args.pattern as string, cwd).join('\n') || 'No files found';
      case 'grep': return tools.grep(args.pattern as string, args.path as string, args.context as number || 2).join('\n') || 'No matches';
      case 'git': return tools.git(args.args as string, cwd);
      case 'npm': return tools.npm(args.args as string, cwd);
      case 'deploy': return args.target === 'netlify' ? tools.deployNetlify(cwd) : tools.deployVercel(cwd);
      case 'detect_project': return JSON.stringify(tools.detectProjectType(cwd), null, 2);
      case 'get_file_tree': return tools.getFileTree(args.path as string, args.depth as number || 3);
      default: throw new Error(`Unknown tool: ${name}`);
    }
  }
}
