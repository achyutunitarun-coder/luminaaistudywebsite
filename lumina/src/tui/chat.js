import React from 'react';
import { Box, Text } from 'ink';

const { createElement: h } = React;

function MessageBlock({ message }) {
  const isUser = message.role === 'user';
  const isSystem = message.isMemory || message.role === 'system';
  const content = message.content || '';

  if (isSystem) {
    return h(Box, { justifyContent: 'center', marginY: 1 },
      h(Text, { color: 'gray', dim: true }, '\u2500\u2500 ' + content + ' \u2500\u2500')
    );
  }

  const segments = content.split(/(```[\s\S]*?```)/g);

  return h(Box, {
    flexDirection: 'column',
    marginY: 1,
    alignItems: isUser ? 'flex-end' : 'flex-start'
  },
    h(Text, { bold: true, color: isUser ? 'cyan' : 'white' },
      isUser ? 'You' : 'Lumina'
    ),
    h(Box, {
      flexDirection: 'column',
      paddingX: 1,
      borderStyle: 'single',
      borderColor: isUser ? 'cyan' : 'gray'
    },
      ...segments.map((segment, i) => {
        if (segment.startsWith('```')) {
          const lines = segment.split('\n');
          const lang = lines[0].replace('```', '').trim();
          const code = lines.slice(1, -1).join('\n');
          return h(Box, { key: i, flexDirection: 'column', marginY: 1, paddingX: 1 },
            lang ? h(Text, { color: 'gray', dim: true }, lang) : null,
            h(Text, null, code)
          );
        }
        if (segment.trim()) {
          return h(Text, { key: i }, segment);
        }
        return null;
      }).filter(Boolean)
    )
  );
}

export default MessageBlock;
