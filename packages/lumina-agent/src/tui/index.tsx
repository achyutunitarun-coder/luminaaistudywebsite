import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Agent } from '../agent.js';
import { LuminaConfig } from '../utils/config.js';
import { basename } from 'path';

type AgentEvent = { type: string; content?: string; tool?: string; args?: string; output?: string; message?: string; summary?: string; question?: string; resolve?: (v: string) => void };

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

const C = {
  brand: '#7C5CFC',
  teal: '#2DD4BF',
  amber: '#F59E0B',
  red: '#F87171',
  green: '#34D399',
  text: '#E4E4E7',
  muted: '#52525B',
  dim: '#3F3F46',
};

export function TUIApp({ prompt, config, model, autoApprove, cwd }: Props) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [status, setStatus] = useState('Initializing...');
  const [thinking, setThinking] = useState(false);
  const [toolCount, setToolCount] = useState(0);
  const [inputMode, setInputMode] = useState(false);
  const [inputBuffer, setInputBuffer] = useState('');
  const [pendingResolve, setPendingResolve] = useState<((v: string) => void) | null>(null);
  const [startTime] = useState(Date.now());
  const msgId = React.useRef(0);

  const addMsg = useCallback((role: DisplayMessage['role'], content: string, tool?: string) => {
    setMessages(prev => [...prev.slice(-200), { id: msgId.current++, role, content, tool, ts: Date.now() }]);
  }, []);

  useEffect(() => {
    const a = new Agent(config, model, cwd, autoApprove);
    a.on('event', (e: AgentEvent) => {
      switch (e.type) {
        case 'thinking': setThinking(true); setStatus('Thinking...'); break;
        case 'text': setThinking(false); setStatus('Streaming...');
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant' && last.id === msgId.current - 1) {
              return [...prev.slice(0, -1), { ...last, content: last.content + e.content }];
            }
            return [...prev.slice(-200), { id: msgId.current++, role: 'assistant', content: e.content, ts: Date.now() }];
          });
          break;
        case 'tool_start': setToolCount(c => c + 1); addMsg('tool', e.tool + '(' + e.args.slice(0, 60) + ')', e.tool); setStatus('Running: ' + e.tool); break;
        case 'tool_end': addMsg('tool', e.output.slice(0, 150) || '(ok)'); setStatus('Tool complete'); break;
        case 'error': addMsg('system', 'ERR: ' + e.message); setStatus('Error'); break;
        case 'ask': setInputMode(true); setStatus('Waiting...'); addMsg('system', '? ' + e.question); setPendingResolve(() => e.resolve); break;
        case 'done': setThinking(false); addMsg('system', 'DONE: ' + e.summary); setStatus('Finished'); break;
      }
    });
    const run = async () => {
      try {
        const p = prompt || 'Hello! I am Lumina Code. What would you like to build?';
        addMsg('user', p);
        await a.run(p);
      } catch (err: any) { addMsg('system', 'FATAL: ' + err.message); setStatus('Failed'); }
    };
    run();
  }, []);

  useInput((input, key) => {
    if (inputMode) {
      if (key.return) { if (pendingResolve) { addMsg('user', inputBuffer); pendingResolve(inputBuffer); setPendingResolve(null); } setInputBuffer(''); setInputMode(false); }
      else if (key.backspace || key.delete) { setInputBuffer(prev => prev.slice(0, -1)); }
      else { setInputBuffer(prev => prev + input); }
    } else { if (key.ctrl && input === 'c') exit(); }
  });

  const visible = messages.slice(-30);
  const modelShort = (model.split('/').pop() || model);
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const timeStr = Math.floor(elapsed / 60) + ':' + (elapsed % 60).toString().padStart(2, '0');

  return React.createElement(Box, { flexDirection: 'column', height: '100%' },
    React.createElement(Box, { borderStyle: 'round', borderColor: C.brand, paddingX: 2, paddingY: 1 },
      React.createElement(Text, { bold: true, color: C.brand }, ' LUMINA CODE '),
      React.createElement(Text, { color: C.muted }, ' | '),
      React.createElement(Text, { color: C.text }, basename(cwd)),
      React.createElement(Text, { color: C.muted }, ' | '),
      React.createElement(Text, { color: C.teal }, modelShort),
      thinking ? React.createElement(Text, { color: C.amber }, ' *') : null,
      React.createElement(Text, { color: C.dim }, ' | '),
      React.createElement(Text, { color: C.dim }, timeStr)
    ),
    React.createElement(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 2, paddingY: 1 },
      visible.map(m =>
        React.createElement(Box, { key: m.id },
          React.createElement(Text, { color: C.muted }, m.role === 'user' ? '> ' : '  '),
          React.createElement(Text, { color: m.role === 'user' ? C.brand : m.role === 'tool' ? C.dim : m.role === 'system' ? C.amber : C.text }, m.content.slice(0, 600))
        )
      ),
      thinking ? React.createElement(Text, { color: C.amber }, '  ...') : null
    ),
    inputMode ? React.createElement(Box, { borderStyle: 'single', borderColor: C.brand, paddingX: 1 },
      React.createElement(Text, { color: C.brand }, '> '),
      React.createElement(Text, null, inputBuffer),
      React.createElement(Text, { color: C.muted }, '_')
    ) : null,
    React.createElement(Box, { paddingX: 2, paddingY: 1, borderStyle: 'single', borderColor: C.dim },
      React.createElement(Text, { color: C.muted }, ' ' + status),
      React.createElement(Text, { color: C.dim }, ' | tools: ' + toolCount),
      React.createElement(Text, { color: C.dim }, ' | ' + timeStr),
      React.createElement(Text, { color: C.dim }, ' | Ctrl+C exit')
    )
  );
}
