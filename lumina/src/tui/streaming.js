import React from 'react';
import { Box, Text } from 'ink';

const { createElement: h } = React;

function StreamingBlock({ content }) {
  if (!content) return null;

  const segments = content.split(/(```[\s\S]*?```)/g);

  return h(Box, {
    flexDirection: 'column',
    marginY: 1,
    alignItems: 'flex-start'
  },
    h(Text, { bold: true, color: 'white' }, 'Lumina'),
    h(Box, {
      flexDirection: 'column',
      paddingX: 1,
      borderStyle: 'round',
      borderColor: 'green'
    },
      ...segments.map((segment, i) => {
        if (segment.startsWith('```')) {
          const lines = segment.split('\n');
          const lang = lines[0].replace('```', '').trim();
          const code = lines.slice(1, -1).join('\n');
          return h(Box, { key: i, flexDirection: 'column', marginY: 1 },
            lang ? h(Text, { color: 'green', bold: true }, '\u25B6 ' + lang) : null,
            h(Box, {
              paddingX: 1,
              borderStyle: 'single',
              borderColor: 'green'
            },
              h(Text, { wrap: 'truncate-end' }, code)
            )
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

export default React.memo(StreamingBlock, (prev, next) => prev.content === next.content);
