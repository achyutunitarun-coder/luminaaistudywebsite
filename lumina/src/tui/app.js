import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import MessageBlock from './chat.js';
import StatusBar from './statusbar.js';
import CommandInput from './input.js';
import { loadConfig, saveConfig } from '../config.js';
import { countTokens } from '../utils/tokens.js';
import { estimateCost } from '../utils/cost.js';
import { saveConversation, loadConversation, listConversations, exportAsMarkdown, writeCodeFile, writeAllCodeBlocks, extractCodeBlocks } from '../utils/files.js';
import { shouldSummarize, compressHistory, generateSummaryPrompt } from '../memory.js';
import personas from '../personas/index.js';

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

  const currentPersona = personas[config.persona] || personas.general;

  useEffect(() => {
    if (currentPersona) {
      setMessages([{
        role: 'system',
        content: currentPersona.systemPrompt
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
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    try {
      let full = '';
      const ac = new AbortController();
      setAbortController(ac);

      await provider.chat(newMessages, {
        model: config.defaultModel,
        maxTokens: config.tokenBudget === 'unlimited' ? 4096 : config.tokenBudget,
        onToken: (token) => {
          if (ac.signal.aborted) return;
          full += token;
          setStreamingContent(full);
          const tokCount = countTokens(full, config.defaultModel);
          setTokensUsed(prev => prev + 1);
          const c = estimateCost(
            countTokens(trimmed, config.defaultModel),
            tokCount,
            config.defaultModel
          );
          setCost(c);
        },
        signal: ac.signal
      });

      const assistantMsg = { role: 'assistant', content: full };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      setStreamingContent('');
      setIsStreaming(false);

      const tokCount = countTokens(full, config.defaultModel);
      setTokensUsed(prev => prev + tokCount);
      const c = estimateCost(
        countTokens(trimmed, config.defaultModel),
        tokCount,
        config.defaultModel
      );
      setCost(c);

      if (shouldSummarize(finalMessages)) {
        const summaryPrompt = generateSummaryPrompt(finalMessages);
        try {
          const summary = await provider.chat(
            [...finalMessages.filter(m => m.role === 'system'), summaryPrompt],
            { model: config.defaultModel, maxTokens: 300 }
          );
          const compressed = compressHistory(finalMessages, summary.slice(0, 500));
          setMessages(compressed);
        } catch {}
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages([...newMessages, {
        role: 'system',
        content: 'Error: ' + err.message
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
          const newPersonaMsg = {
            role: 'system',
            content: personas[arg].systemPrompt
          };
          setMessages([newPersonaMsg]);
          setTokensUsed(0);
          setCost(0);
        }
        break;
      case 'b':
      case 'budget':
        const budget = arg === 'unlimited' ? 'unlimited' : parseInt(arg, 10);
        if (budget === 'unlimited' || [512, 1024, 2048].includes(budget)) {
          setConfig(prev => ({ ...prev, tokenBudget: budget }));
          setMessages(prev => [...prev, {
            role: 'system',
            content: 'Token budget set to ' + budget
          }]);
        }
        break;
      case 'clear':
        setMessages([{
          role: 'system',
          content: currentPersona.systemPrompt
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
      default:
        setMessages(prev => [...prev, {
          role: 'system',
          content: 'Unknown command: :' + command + '. Available: :q, :m <model>, :p <persona>, :b <budget>, :clear, :save <filename>, :load <path>, :export <filename>, :write <filename>, :writeall, :ls'
        }]);
    }
  }

  const displayMessages = messages.filter(m => !(m.role === 'system' && !m.isMemory));
  const emptyState = displayMessages.length === 0 || (displayMessages.length === 1 && displayMessages[0].role === 'system');

  const children = [
    h(Box, {
      key: 'chat-area',
      flexDirection: 'column',
      flexGrow: 1,
      overflowY: 'auto',
      paddingX: 1,
      paddingY: 1
    },
      emptyState
        ? h(Box, { justifyContent: 'center', marginTop: 2 },
            h(Text, { color: 'gray' }, 'Lumina AI - type a message or :q to quit. Ask for code, then :write <file> to save it.')
          )
        : displayMessages.map((msg, i) =>
            h(MessageBlock, { key: i, message: msg })
          ).concat(
            isStreaming && streamingContent
              ? h(MessageBlock, { key: 'streaming', message: { role: 'assistant', content: streamingContent } })
              : null,
            isStreaming && !streamingContent
              ? h(Box, { key: 'spinner', marginY: 1 },
                  h(Text, { color: 'green' },
                    h(Spinner, { type: 'dots' }), ' Thinking...'
                  )
                )
              : null
          ).filter(Boolean)
    ),
    h(StatusBar, {
      key: 'statusbar',
      model: config.defaultModel,
      persona: config.persona,
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
