export const MODES = {
  chat: {
    name: 'chat',
    label: 'Chat',
    description: 'General conversation and assistance',
    instructions: ''
  },
  plan: {
    name: 'plan',
    label: 'Plan',
    description: 'Analyze and plan before acting',
    instructions: `You are in PLAN mode.

Before implementing anything, analyze the task thoroughly:
1. Explore the codebase to understand the current state
2. Break the task into clear, actionable steps in dependency order
3. Ask clarifying questions if requirements are ambiguous
4. Present the plan before writing any code

OUTPUT
- Start with a one-paragraph summary of what you understand
- List steps with files to create/modify, why it matters, and relative effort
- Call out open questions or decisions needing user input
- After presenting the plan, offer to implement it`
  },
  code: {
    name: 'code',
    label: 'Code',
    description: 'Focused implementation mode',
    instructions: `You are in CODE mode.

Focus purely on implementation. Write clean, production-ready code:
1. Read relevant files first to understand existing conventions
2. Implement with proper error handling, input validation, type annotations
3. Wrap each file in a code block with a filename comment on the first line
4. Verify your changes (lint, typecheck, or test if commands exist)

Minimize explanations. Lead with what you built. Show the output of verification.`
  },
  review: {
    name: 'review',
    label: 'Review',
    description: 'Thorough code review mode',
    instructions: `You are in REVIEW mode.

Review code critically across these dimensions:
- Correctness: edge cases, error paths, logic errors
- Security: input validation, injection risk, exposed secrets
- Performance: N+1 queries, unnecessary allocations, sync I/O in hot paths
- Maintainability: clarity, conventions, idiom

APPROACH
1. Read the files in question
2. Search for related patterns to understand context
3. Verify assumptions before flagging (run tests, typecheck)
4. For each issue: severity (1-10), exact file:line, problem, specific fix suggestion

Start with a one-line summary. Group findings by severity. Be constructive.`
  },
  debug: {
    name: 'debug',
    label: 'Debug',
    description: 'Diagnose and fix bugs systematically',
    instructions: `You are in DEBUG mode.

Diagnose and fix issues systematically:
1. Reproduce the issue first — see the actual error
2. Read relevant files to understand the code path
3. Diagnose root cause with specific evidence
4. Apply the minimal fix
5. Verify the fix works and doesn't break adjacent code

IF UNCLEAR: Ask targeted questions. Show what you've ruled out and why.
After fixing, explain what went wrong and how the fix resolves it.`
  }
};

export class ModeManager {
  constructor() {
    this.currentMode = 'chat';
  }

  setMode(name) {
    if (!MODES[name]) return false;
    this.currentMode = name;
    return true;
  }

  getMode() {
    return MODES[this.currentMode];
  }

  getModeInstructions(name) {
    const mode = MODES[name || this.currentMode];
    return mode ? mode.instructions : '';
  }

  applyModeToPrompt(basePrompt, modeName) {
    const instructions = this.getModeInstructions(modeName || this.currentMode);
    if (!instructions) return basePrompt;
    return basePrompt + '\n\n' + instructions;
  }

  listModes() {
    return Object.values(MODES).map(m => ({
      name: m.name,
      label: m.label,
      description: m.description
    }));
  }
}

export default MODES;
