import { render, fireEvent } from '@testing-library/react';
import { vi, expect, test } from 'vitest';
import ModeSelector from '@/components/ModeSelector';

test('ModeSelector calls onChange with selected mode', () => {
  const onChange = vi.fn();
  const { getByText } = render(<ModeSelector active="normal" onChange={onChange} />);

  const quick = getByText('Quick');
  fireEvent.click(quick);

  expect(onChange).toHaveBeenCalledWith('quick');
});
