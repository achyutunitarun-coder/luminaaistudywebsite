import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import MessageBlock from './chat.js';
import StreamingBlock from './streaming.js';
import StatusBar from './statusbar.js';
import CommandInput from './input.js';
import { loadConfig, saveConfig } from '../config.js';
import { countTokens } from '../utils/tokens.js';
import { estimateCost } from '../utils/cost.js';
import { saveConversation, loadConversation, listConversations, exportAsMarkdown, writeCodeFile, writeAllCodeBlocks, extractCodeBlocks } from '../utils/files.js';
import { parseToolBlocks, executeToolBlocks, TOOL_DEFINITIONS } from '../tools.js';
import { shouldSummarize, compressHistory, generateSummaryPrompt, saveCheckpoint } from '../memory.js';
import personas from '../personas/index.js';
import { ModeManager } from '../modes/index.js';
import { AgentManager } from '../agents/index.js';
import { TeamOrchestrator } from '../team/index.js';

function estimateTokens(text) {
  return Math.ceil((text?.length || 0) / 3.5);
}

function compactToolMessages(messages) {
  const firstUserIdx = messages.findIndex(m => m.role === 'user');
  const firstUser = firstUserIdx >= 0 ? messages[firstUserIdx] : null;
  const systemMsg = messages[0];

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  if (!lastAssistant || !firstUser) return messages;

  const toolCalls = messages.filter(m => m.isToolResult && m.content?.startsWith('[Tool result:'));
  const toolNames = [...new Set(toolCalls.map(m => {
    const match = m.content.match(/\[Tool result: (\w+)\(/);
    return match ? match[1] : '?';
  }))];

  const result = [systemMsg, firstUser, lastAssistant];
  if (toolNames.length > 0) {
    result.push({
      role: 'system', isToolResult: true,
      content: '[Tools used: ' + toolNames.join(', ') + ']'
    });
  }

  return result;
}

function trimContext(messages, maxTokens = 7000) {
  const systemMsg = messages[0];
  const systemTokens = estimateTokens(systemMsg?.content);
  let available = maxTokens - systemTokens - 1024;

  const keep = [systemMsg];
  for (let i = messages.length - 1; i >= 1; i--) {
    const t = estimateTokens(messages[i].content);
    if (t <= available) {
      available -= t;
      keep.splice(1, 0, messages[i]);
    }
  }

  if (keep.length < messages.length && keep.length > 1) {
    keep.splice(1, 0, {
      role: 'system', isToolResult: true,
      content: '[Earlier context trimmed to ' + (keep.length - 1) + ' messages]'
    });
  }

  return keep;
}

const { createElement: h, Fragment } = React;

function App({ provider, initialConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [cost, setCost] = useState(0);
  const [streamingContent, setStreamingContent] = useState('');
  const [abortController, setAbortController] = useState(null);
  const [autoWrite, setAutoWrite] = useState(true);
  const streamRef = useRef('');
  const streamTimerRef = useRef(null);
  const streamLenRef = useRef(0);
  const lastResponseRef = useRef('');

  const currentPersona = personas[config.persona] || personas.general;
  const modeManagerRef = useRef(new ModeManager());
  const agentManagerRef = useRef(new AgentManager());
  const teamRef = useRef(new TeamOrchestrator());

  function buildSystemPrompt(persona, modeName) {
    return modeManagerRef.current.applyModeToPrompt(persona.systemPrompt, modeName);
  }

  useEffect(() => {
    if (currentPersona) {
      setMessages([{
        role: 'system',
        content: buildSystemPrompt(currentPersona, modeManagerRef.current.currentMode)
      }]);
    }
  }, []);

  const handleSubmit = useCallback(async (value) => {
    if (isStreaming || !value.trim()) return;

    const trimmed = value.trim();

    if (trimmed.startsWith(':')) {
      handleCommand(trimmed);
      setInput('');
      return;
    }

    const userMsg = { role: 'user', content: trimmed };
    const newMessages = trimContext([...messages, userMsg]);
    setMessages(newMessages);
    setInput('');
    setStreamingContent('');
    setIsStreaming(true);
    setStreamingContent('');

    const budget = config.tokenBudget === 'unlimited' ? 8192 : config.tokenBudget;

    const withRetry = async (fn, retries = 2) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try { return await fn(); } catch (err) {
          if (attempt === retries) throw err;
          const msg = err.message || '';
          if (msg.includes('429') || msg.includes('500') || msg.includes('503') || msg.includes('fetch') || msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET')) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }
    };

    try {
      let full = '';
      const ac = new AbortController();
      setAbortController(ac);

      streamRef.current = '';
      streamLenRef.current = 0;
      await withRetry(() => provider.chat(newMessages, {
        model: config.defaultModel,
        maxTokens: budget,
        onToken: (token) => {
          if (ac.signal.aborted) return;
          full += token;
          streamRef.current = full;
          if (!streamTimerRef.current) {
            streamTimerRef.current = setTimeout(() => {
              const len = streamRef.current.length;
              if (len - streamLenRef.current > 80 || streamTimerRef.current === null) {
                streamLenRef.current = len;
                setStreamingContent(streamRef.current);
              }
              streamTimerRef.current = null;
            }, 250);
          }
        },
        signal: ac.signal
      }));
      if (streamTimerRef.current) {
        clearTimeout(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      lastResponseRef.current = full;
      setStreamingContent(full);

      let currentMessages = [...newMessages, { role: 'assistant', content: full }];
      let finalContent = full;
      let toolIteration = true;

      for (let iter = 0; iter < 8 && toolIteration; iter++) {
        const toolBlocks = parseToolBlocks(full);
        toolIteration = false;

        if (toolBlocks.length > 0) {
          toolIteration = true;
          const results = await executeToolBlocks(toolBlocks, (label) => {
            currentMessages = [...currentMessages, {
              role: 'system', isToolResult: true,
              content: '\u25B6 ' + label
            }];
            setMessages(currentMessages);
          });
          for (const r of results) {
            const label = r.operation + '(' + (r.mainArg || '') + ')';
            const lines = r.result.split('\n');
            const truncated = lines.length > 80 ? lines.slice(0, 80).join('\n') + '\n... (truncated, ' + lines.length + ' lines total)' : r.result;
            currentMessages = [...currentMessages, {
              role: 'system', isToolResult: true,
              content: '[' + label + ']\n\n' + truncated
            }];
          }
          setMessages(currentMessages);

            full = await withRetry(() => provider.chat(currentMessages, {
            model: config.defaultModel,
            maxTokens: budget,
          }));
          lastResponseRef.current = full;
          currentMessages = [...currentMessages, { role: 'assistant', content: full }];
          finalContent = full;
        }
      }

      const compacted = compactToolMessages(currentMessages);
      setMessages(compacted);
      setIsStreaming(false);
      saveCheckpoint(compacted);

      if (autoWrite) {
        const results = writeAllCodeBlocks(finalContent);
        if (results.length > 0) {
          setMessages(prev => [...prev, {
            role: 'system', isToolResult: true,
            content: 'Wrote ' + results.length + ' file(s): ' + results.map(r => r.error ? '\u2716 ' + r.filename : '\u2713 ' + r.filename).join(', ')
          }]);
        }
      }

      const tokCount = countTokens(finalContent, config.defaultModel);
      setTokensUsed(prev => prev + tokCount);
      const c = estimateCost(
        countTokens(trimmed, config.defaultModel),
        tokCount,
        config.defaultModel
      );
      setCost(c);

      if (shouldSummarize(compacted)) {
        const summaryPrompt = generateSummaryPrompt(compacted);
        try {
          const summary = await provider.chat(
            [...compacted.filter(m => m.role === 'system'), summaryPrompt],
            { model: config.defaultModel, maxTokens: 300 }
          );
          const compressed = compressHistory(compacted, summary.slice(0, 500));
          setMessages(compressed);
        } catch {}
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages(prev => [...prev, {
        role: 'system',
        content: '\u2716 Error: ' + err.message
      }]);
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [messages, isStreaming, config, provider]);

  function handleCommand(cmd) {
    const parts = cmd.slice(1).split(/\s+/);
    const command = parts[0];
    const arg = parts.slice(1).join(' ');

    switch (command) {
      case 'q':
      case 'quit':
        process.exit(0);
        break;
      case 'm':
      case 'model':
        if (arg) {
          setConfig(prev => ({ ...prev, defaultModel: arg }));
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Switched model to ' + arg
          }]);
        }
        break;
      case 'p':
      case 'persona':
        if (arg && personas[arg]) {
          setConfig(prev => ({ ...prev, persona: arg }));
          const newPersona = personas[arg];
          const newSystemPrompt = buildSystemPrompt(newPersona, modeManagerRef.current.currentMode);
          const newPersonaMsg = {
            role: 'system',
            content: newSystemPrompt
          };
          setMessages([newPersonaMsg]);
          setTokensUsed(0);
          setCost(0);
        }
        break;
      case 'b':
      case 'budget':
        const budget = arg === 'unlimited' ? 'unlimited' : parseInt(arg, 10);
        if (budget === 'unlimited' || [2048, 4096, 8192].includes(budget)) {
          setConfig(prev => ({ ...prev, tokenBudget: budget }));
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Token budget set to ' + budget
          }]);
        }
        break;
      case 'mode':
        if (arg && modeManagerRef.current.setMode(arg)) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Switched to ' + arg + ' mode'
          }]);
          const prompt = buildSystemPrompt(currentPersona, arg);
          setMessages(prev => [{
            role: 'system',
            content: prompt
          }, ...prev.slice(1)]);
        } else if (arg) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Unknown mode: ' + arg + '. Available: ' + modeManagerRef.current.listModes().map(m => m.name).join(', ')
          }]);
        } else {
          const mode = modeManagerRef.current.getMode();
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Current mode: ' + mode.label + ' (' + mode.description + '). Available: ' + modeManagerRef.current.listModes().map(m => m.name).join(', ')
          }]);
        }
        break;
      case 'agent':
        if (!arg) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Usage: :agent <name> <task>. Agents: ' + agentManagerRef.current.listAgents().map(a => a.name).join(', ')
          }]);
          break;
        }
        {
          const spaceIdx = arg.indexOf(' ');
          const agentName = spaceIdx > 0 ? arg.slice(0, spaceIdx) : arg;
          const task = spaceIdx > 0 ? arg.slice(spaceIdx + 1) : '';
          if (!agentManagerRef.current.getAgent(agentName)) {
            setMessages(prev => [...prev, {
              role: 'system',
              content: 'Unknown agent: ' + agentName + '. Available: ' + agentManagerRef.current.listAgents().map(a => a.name).join(', ')
            }]);
            break;
          }
          if (!task) {
            const lastUser = [...messages].reverse().find(m => m.role === 'user');
            if (lastUser) {
              runAgentInline(agentName, lastUser.content);
            } else {
              setMessages(prev => [...prev, {
                role: 'system',
                content: 'Usage: :agent ' + agentName + ' <task>'
              }]);
            }
            break;
          }
          runAgentInline(agentName, task);
        }
        async function runAgentInline(name, taskMsg) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: '\u25B6 Spawning ' + name + ' agent...'
          }]);
          try {
            agentManagerRef.current.provider = provider;
            agentManagerRef.current.config = config;
            const result = await agentManagerRef.current.runAgent(name, taskMsg);
            if (result.error) {
              setMessages(prev => [...prev, {
                role: 'system',
                content: '\u2716 Agent ' + name + ' error: ' + result.error
              }]);
            } else {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: '[' + result.agent + ']\n' + (result.result || '')
              }]);
            }
          } catch (err) {
            setMessages(prev => [...prev, {
              role: 'system',
              content: '\u2716 Agent error: ' + err.message
            }]);
          }
        }
        break;
      case 'team':
      case 't':
        if (!arg) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Usage: :team <name> <task>. Teams: ' + teamRef.current.listTeams().map(t => t.name + ' (' + t.description + ')').join(', ')
          }]);
          break;
        }
        {
          const spaceIdx = arg.indexOf(' ');
          const teamName = spaceIdx > 0 ? arg.slice(0, spaceIdx) : arg;
          const task = spaceIdx > 0 ? arg.slice(spaceIdx + 1) : '';
          if (!teamRef.current.getTeam(teamName)) {
            setMessages(prev => [...prev, {
              role: 'system',
              content: 'Unknown team: ' + teamName + '. Available: ' + teamRef.current.listTeams().map(t => t.name).join(', ')
            }]);
            break;
          }
          if (!task) {
            const lastUser = [...messages].reverse().find(m => m.role === 'user');
            if (lastUser) {
              runTeamInline(teamName, lastUser.content);
            } else {
              setMessages(prev => [...prev, {
                role: 'system',
                content: 'Usage: :team ' + teamName + ' <task>'
              }]);
            }
            break;
          }
          runTeamInline(teamName, task);
        }
        async function runTeamInline(name, taskMsg) {
          const team = teamRef.current.getTeam(name);
          setMessages(prev => [...prev, {
            role: 'system',
            content: '\u25B6 Starting ' + name + ' pipeline: ' + team.pipeline.map(p => p.agent).join(' \u2192 ')
          }]);
          try {
            const result = await teamRef.current.runTeam(name, taskMsg, (phase, agent) => {
              setMessages(prev => [...prev, {
                role: 'system',
                content: '\u25B6 ' + phase + ' (' + agent + ')...'
              }]);
            });
            if (result.error) {
              setMessages(prev => [...prev, {
                role: 'system',
                content: '\u2716 Team pipeline failed: ' + result.error
              }]);
            } else {
              let output = '[' + name + ' pipeline results]\n';
              for (const r of result.results) {
                output += '\n### ' + r.phase + ' (' + r.agent + ')\n' + (r.output || '(no output)');
              }
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: output
              }]);
            }
          } catch (err) {
            setMessages(prev => [...prev, {
              role: 'system',
              content: '\u2716 Team error: ' + err.message
            }]);
          }
        }
        break;
      case 'clear':
        setMessages([{
          role: 'system',
          content: buildSystemPrompt(currentPersona, modeManagerRef.current.currentMode)
        }]);
        setTokensUsed(0);
        setCost(0);
        break;
      case 'save':
        if (arg) {
          try {
            const path = saveConversation(messages, arg);
            setMessages(prev => [...prev, {
              role: 'system',
              content: 'Saved to ' + path
            }]);
          } catch (err) {
            setMessages(prev => [...prev, {
              role: 'system',
              content: 'Save failed: ' + err.message
            }]);
          }
        }
        break;
      case 'load':
        if (arg) {
          try {
            const loaded = loadConversation(arg);
            if (loaded) {
              setMessages(loaded);
              setTokensUsed(0);
              setCost(0);
              setMessages(prev => [...prev, {
                role: 'system',
                content: 'Loaded ' + loaded.length + ' messages from ' + arg
              }]);
            } else {
              setMessages(prev => [...prev, {
                role: 'system',
                content: 'File not found: ' + arg
              }]);
            }
          } catch (err) {
            setMessages(prev => [...prev, {
              role: 'system',
              content: 'Load failed: ' + err.message
            }]);
          }
        }
        break;
      case 'export':
        if (arg) {
          try {
            const md = exportAsMarkdown(messages, arg);
            setMessages(prev => [...prev, {
              role: 'system',
              content: 'Exported to ' + md
            }]);
          } catch (err) {
            setMessages(prev => [...prev, {
              role: 'system',
              content: 'Export failed: ' + err.message
            }]);
          }
        }
        break;
      case 'writeall':
      case 'write':
        {
          const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
          if (!lastAssistant) {
            setMessages(prev => [...prev, { role: 'system', content: 'No assistant response to write' }]);
            break;
          }
          if (arg) {
            try {
              const filePath = writeCodeFile(lastAssistant.content, arg);
              setMessages(prev => [...prev, { role: 'system', content: 'Written to ' + filePath }]);
            } catch (err) {
              setMessages(prev => [...prev, { role: 'system', content: 'Write failed: ' + err.message }]);
            }
          } else {
            const blocks = extractCodeBlocks(lastAssistant.content);
            if (blocks.length === 0) {
              setMessages(prev => [...prev, { role: 'system', content: 'No code blocks found. Use :write <filename> to save entire response.' }]);
            } else {
              const results = writeAllCodeBlocks(lastAssistant.content);
              const summary = 'Extracted ' + results.length + ' file(s):\n' + results.map(r => '  - ' + r.filename + (r.error ? ' (error: ' + r.error + ')' : '')).join('\n');
              setMessages(prev => [...prev, { role: 'system', content: summary }]);
            }
          }
        }
        break;
      case 'ls':
        try {
          const files = listConversations();
          if (files.length === 0) {
            setMessages(prev => [...prev, {
              role: 'system',
              content: 'No saved conversations found'
            }]);
          } else {
            setMessages(prev => [...prev, {
              role: 'system',
              content: 'Saved conversations:\n' + files.map(f => '  - ' + f).join('\n')
            }]);
          }
        } catch (err) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Error: ' + err.message
          }]);
        }
        break;
      case 'autowrite':
      case 'aw':
        setAutoWrite(prev => {
          const next = !prev;
          setMessages(msgs => [...msgs, { role: 'system', content: 'Auto-write ' + (next ? 'on' : 'off') }]);
          return next;
        });
        break;
      default:
        setMessages(prev => [...prev, {
          role: 'system',
          content:           'Unknown command: :' + command + '. Available: :q, :m <model>, :p <persona>, :mode <name>, :agent <name> <task>, :team <name> <task>, :b <budget>, :clear, :save <path>, :load <path>, :export <name>, :write <file>, :writeall, :ls, :autowrite'
        }]);
    }
  }

  const displayMessages = useMemo(() =>
    messages.filter(m => m.isToolResult || m.role !== 'system'),
    [messages]
  );
  const emptyState = displayMessages.length === 0 || (displayMessages.length === 1 && displayMessages[0]?.role === 'system');
  const showResponse = streamingContent && !isStreaming;
  const showStreaming = streamingContent && isStreaming;

  const children = [
    h(Box, {
      key: 'chat-area',
      flexDirection: 'column',
      flexGrow: 1,
      paddingX: 1,
      paddingY: 1
    },
      emptyState && !streamingContent
        ? h(Box, { justifyContent: 'center', marginTop: 2 },
            h(Text, { color: 'gray' }, 'Lumina AI \u2014 type a message or :q to quit. Code blocks auto-write to disk.')
          )
        : [
            ...displayMessages.map((msg, i) =>
              h(MessageBlock, { key: msg.role + '-' + i, message: msg })
            ),
            showStreaming
              ? h(StreamingBlock, { key: 'streaming-block', content: streamingContent })
              : null,
            showResponse && displayMessages.filter(m => m.role === 'assistant').length === 0
              ? h(StreamingBlock, { key: 'final-response', content: streamingContent })
              : null,
            isStreaming && !streamingContent
              ? h(Box, { key: 'spinner', marginY: 1 },
                  h(Text, { color: 'green' },
                    h(Spinner, { type: 'dots' }), ' Thinking...'
                  )
                )
              : null
          ].filter(Boolean)
    ),
    h(StatusBar, {
      key: 'statusbar',
      model: config.defaultModel,
      persona: config.persona,
      mode: modeManagerRef.current.currentMode,
      tokensUsed,
      tokenBudget: config.tokenBudget,
      cost,
      isStreaming
    }),
    h(CommandInput, {
      key: 'input',
      value: input,
      onChange: setInput,
      onSubmit: handleSubmit,
      isStreaming
    })
  ];

  return h(Box, { flexDirection: 'column', height: '100%' }, ...children);
}

export default App;
