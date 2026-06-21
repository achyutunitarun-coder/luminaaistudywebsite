#!/usr/bin/env node
// @ts-check

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Agent, AgentEvent } from '../agent.js';
import { LuminaConfig } from '../utils/config.js';
import { basename } from 'path';

interface Props {
  prompt?: string;
  config: LuminaConfig;
  model: string;
  autoApprove: boolean;
  cwd: string;
}

interface DisplayMessage {
  id: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool?: string;
  ts: number;
}

const COLORS = {
  brand: '#7C5CFC',
  teal: '#2DD4BF',
  amber: '#F59E0B',
  red: '#F87171',
  green: '#34D399',
  text: '#E4E4E7',
  muted: '#52525B',
  dim: '#3F3F46',
  bg: '#09090B',
};

export function TUIApp({ prompt, config, model, autoApprove, cwd }: Props) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [status, setStatus] = useState('Initializing...');
  const [thinking, setThinking] = useState(false);
  const [toolCount, setToolCount] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [inputMode, setInputMode] = useState(false);
  const [inputBuffer, setInputBuffer] = useState('');
  const [pendingResolve, setPendingResolve] = useState<((v: string) => void) | null>(null);
  const [startTime] = useState(Date.now());
  const msgId = React.useRef(0);
  const scrollRef = useRef(0);

  const addMsg = useCallback((role: DisplayMessage['role'], content: string, tool?: string) => {
    setMessages(prev => [...prev.slice(-200), { id: msgId.current++, role, content, tool, ts: Date.now() }]);
  }, []);

  const elapsed = useCallback(() => {
    const s = Math.floor((Date.now() - startTime) / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  }, [startTime]);

  useEffect(() => {
    const a = new Agent(config, model, cwd, autoApprove);

    a.on('event', (e: AgentEvent) => {
      switch (e.type) {
        case 'thinking':
          setThinking(true);
          setStatus('Thinking...');
          break;
        case 'text':
          setThinking(false);
          setStatus('Streaming...');
          // Append to last assistant message instead of creating new ones
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant' && last.id === msgId.current - 1) {
              return [...prev.slice(0, -1), { ...last, content: last.content + e.content }];
            }
            return [...prev.slice(-200), { id: msgId.current++, role: 'assistant', content: e.content, ts: Date.now() }];
          });
          break;
        case 'tool_start':
          setToolCount(c => c + 1);
          addMsg('tool', e.tool + '(' + e.args.slice(0, 60) + ')', e.tool);
          setStatus('Running: ' + e.tool);
          break;
        case 'tool_end':
          const out = e.output.slice(0, 150);
          addMsg('tool', out || '(ok)');
          setStatus('Tool complete');
          break;
        case 'error':
          addMsg('system', 'ERR: ' + e.message);
          setStatus('Error');
          break;
        case 'ask':
          setInputMode(true);
          setStatus('Waiting for input...');
          addMsg('system', '? ' + e.question);
          setPendingResolve(() => e.resolve);
          break;
        case 'done':
          setThinking(false);
          addMsg('system', 'DONE: ' + e.summary);
          setStatus('Finished');
          break;
      }
    });

    const run = async () => {
      try {
        const initialPrompt = prompt || 'Hello! I am Lumina Code, your AI coding agent. I can build apps, write code, run commands, and deploy. What would you like to create?';
        addMsg('user', initialPrompt);
        await a.run(initialPrompt);
      } catch (err: any) {
        addMsg('system', 'FATAL: ' + err.message);
        setStatus('Failed');
      }
    };

    run();
  }, []);

  useInput((input, key) => {
    if (inputMode) {
      if (key.return) {
        if (pendingResolve) {
          addMsg('user', inputBuffer);
          pendingResolve(inputBuffer);
          setPendingResolve(null);
        }
        setInputBuffer('');
        setInputMode(false);
      } else if (key.backspace || key.delete) {
        setInputBuffer(prev => prev.slice(0, -1));
      } else if (key.escape) {
        setInputMode(false);
        setInputMode(false);
        setInputBuffer('');
      } else {
        setInputBuffer(prev => prev + input);
      }
    } else {
      if (key.ctrl && input === 'c') exit();
      if (key.ctrl && input === 'd') exit();
    }
  });

  const visibleMessages = messages.slice(-30);
  const modelShort = (model.split('/').pop() || model);

  return React.createElement(Box, { flexDirection: 'column', height: '100%', backgroundColor: COLORS.bg },
    // Header
    React.createElement(Box, { borderStyle: 'round', borderColor: COLORS.brand, paddingX: 2, paddingY: 1 },
      React.createElement(Text, { bold: true, color: COLORS.brand }, '\u25C6 LUMINA CODE'),
      React.createElement(Text, { color: COLORS.muted }, ' | '),
      React.createElement(Text, { color: COLORS.text }, basename(cwd)),
      React.createElement(Text, { color: COLORS.muted }, ' | '),
      React.createElement(Text, { color: COLORS.teal }, modelShort),
      thinking ? React.createElement(Text, { color: COLORS.amber }, ' \u25CF') : null,
      React.createElement(Text, { color: COLORS.dim }, ' | '),
      React.createElement(Text, { color: COLORS.dim }, elapsed())
    ),

    // Messages area
    React.createElement(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 2, paddingY: 1 },
      visibleMessages.map(m => {
        let prefix = '  ';
        let color = COLORS.text;
        if (m.role === 'user') { prefix = '> '; color = COLORS.brand; }
        else if (m.role === 'tool') { prefix = '  '; color = COLORS.dim; }
        else if (m.role === 'system') { prefix = '  '; color = COLORS.amber; }
        else { prefix = '  '; color = COLORS.text; }

        return React.createElement(Box, { key: m.id, marginTop: 0 },
          React.createElement(Text, { color: COLORS.muted }, prefix),
          React.createElement(Text, { color }, m.content.slice(0, 600))
        );
      }),
      thinking ? React.createElement(Text, { color: COLORS.amber }, '  \u22EF thinking...') : null
    ),

    // Input mode
    inputMode ? React.createElement(Box, { borderStyle: 'single', borderColor: COLORS.brand, paddingX: 1, paddingY: 1 },
      React.createElement(Text, { color: COLORS.brand }, '> '),
      React.createElement(Text, { color: COLORS.text }, inputBuffer),
      React.createElement(Text, { color: COLORS.muted }, '\u2588')
    ) : null,

    // Status bar
    React.createElement(Box, { paddingX: 2, paddingY: 1, borderStyle: 'single', borderColor: COLORS.dim },
      React.createElement(Text, { color: COLORS.muted }, ' ' + status),
      React.createElement(Text, { color: COLORS.dim }, ' | '),
      React.createElement(Text, { color: COLORS.muted }, 'tools: ' + toolCount),
      React.createElement(Text, { color: COLORS.dim }, ' | '),
      React.createElement(Text, { color: COLORS.muted }, elapsed()),
      React.createElement(Text, { color: COLORS.dim }, ' | '),
      React.createElement(Text, { color: COLORS.dim }, 'Ctrl+C exit')
    )
  );
}
