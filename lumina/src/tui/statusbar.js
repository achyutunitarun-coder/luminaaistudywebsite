import React from 'react';
import { Box, Text } from 'ink';

const { createElement: h } = React;

function StatusBar({ model, persona, tokensUsed, tokenBudget, cost, isStreaming }) {
  const budgetStr = tokenBudget === 'unlimited' ? '\u221E' : String(tokenBudget);
  const usedPct = tokenBudget === 'unlimited'
    ? '--'
    : Math.min(100, Math.round((tokensUsed / tokenBudget) * 100)) + '%';
  const costStr = cost ? '$' + cost.toFixed(4) : '$0.0000';

  const children = [
    h(Box, { key: 'left', flexGrow: 1 },
      h(Text, null,
        h(Text, { color: 'cyan' }, 'Model:'), ' ' + model + ' ',
        h(Text, { color: 'cyan' }, 'Persona:'), ' ' + persona
      )
    ),
    h(Box, { key: 'center' },
      h(Text, null,
        h(Text, { color: 'yellow' }, 'Tokens:'), ' ' + tokensUsed + '/' + budgetStr + ' ',
        h(Text, { color: 'yellow' }, 'Used:'), ' ' + usedPct
      )
    ),
    h(Box, { key: 'cost', marginLeft: 2 },
      h(Text, { color: 'green' }, costStr)
    ),
    isStreaming ? h(Box, { key: 'streaming', marginLeft: 2 },
      h(Text, { color: 'green' }, '\u25CF Streaming...')
    ) : null
  ].filter(Boolean);

  return h(Box, {
    borderStyle: 'single',
    borderColor: 'gray',
    paddingX: 1,
    paddingY: 0
  }, ...children);
}

export default StatusBar;
