import React from 'react';
import { Box, Text } from 'ink';

const { createElement: h } = React;

function CodeBlock({ code, lang }) {
  return h(Box, { flexDirection: 'column', marginY: 1 },
    h(Box, { paddingX: 1 },
      h(Text, { color: 'green', bold: true }, lang ? '\u25B6 ' + lang : '\u25B6 code')
    ),
    h(Box, {
      paddingX: 1,
      paddingY: 1,
      borderStyle: 'round',
      borderColor: 'green',
      marginLeft: 1
    },
      h(Text, { wrap: 'truncate-end' }, code)
    )
  );
}

function UserMessage({ content }) {
  return h(Box, {
    flexDirection: 'column',
    marginY: 1,
    alignItems: 'flex-end'
  },
    h(Text, { bold: true, color: 'cyan' }, 'You'),
    h(Box, {
      flexDirection: 'column',
      paddingX: 2,
      paddingY: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
      marginLeft: 4
    },
      h(Text, null, content)
    )
  );
}

function AssistantMessage({ content }) {
  const segments = content.split(/(```[\s\S]*?```)/g);

  return h(Box, {
    flexDirection: 'column',
    marginY: 1,
    alignItems: 'flex-start'
  },
    h(Text, { bold: true, color: 'white' }, 'Lumina'),
    h(Box, {
      flexDirection: 'column',
      paddingX: 2,
      paddingY: 1,
      borderStyle: 'round',
      borderColor: 'gray',
      marginRight: 4
    },
      ...segments.map((segment, i) => {
        if (segment.startsWith('```')) {
          const lines = segment.split('\n');
          const lang = lines[0].replace('```', '').trim();
          const code = lines.slice(1, -1).join('\n');
          return h(CodeBlock, { key: 'cb-' + i, code, lang });
        }
        if (segment.trim()) {
          return h(Text, { key: 't-' + i }, segment);
        }
        return null;
      }).filter(Boolean)
    )
  );
}

function SystemMessage({ content, isMemory }) {
  const prefix = isMemory ? '\u21B3' : '\u2500\u2500';
  return h(Box, { justifyContent: 'center', marginY: 1 },
    h(Text, { color: 'gray', dim: true, italic: true }, prefix + ' ' + content + ' ' + prefix)
  );
}

function ToolResultMessage({ content }) {
  return h(Box, { marginY: 1, marginLeft: 2 },
    h(Text, { color: 'yellow', dim: true }, '\u25B8 ' + content)
  );
}

function MessageBlock({ message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system' && !message.isToolResult;
  const isMemory = message.isMemory;
  const isTool = message.isToolResult;

  if (isMemory) return h(SystemMessage, { content: message.content, isMemory: true });
  if (isSystem) return h(SystemMessage, { content: message.content });
  if (isTool) return h(ToolResultMessage, { content: message.content });
  if (isUser) return h(UserMessage, { content: message.content || '' });
  return h(AssistantMessage, { content: message.content || '' });
}

export default React.memo(MessageBlock, (prev, next) => {
  return prev.message?.content === next.message?.content
    && prev.message?.role === next.message?.role
    && prev.message?.isToolResult === next.message?.isToolResult
    && prev.message?.isMemory === next.message?.isMemory;
});
