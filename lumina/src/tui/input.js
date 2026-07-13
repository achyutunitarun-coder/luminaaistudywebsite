import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

const { createElement: h } = React;

function CommandInput({ value, onChange, onSubmit, isStreaming }) {
  return h(Box, null,
    h(Box, { marginRight: 1 },
      h(Text, { color: 'cyan' }, '>')
    ),
    h(Box, { flexGrow: 1 },
      h(TextInput, {
        value,
        onChange,
        onSubmit,
        placeholder: isStreaming ? 'Waiting for response...' : 'Type a message or :q to quit',
        focus: !isStreaming
      })
    )
  );
}

export default CommandInput;
