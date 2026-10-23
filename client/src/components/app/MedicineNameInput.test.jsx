import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MedicineNameInput } from './MedicineNameInput';
import api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn() },
  qs: (params = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      search.set(key, String(value));
    }
    const str = search.toString();
    return str ? `?${str}` : '';
  },
}));

function Harness({ onSelect }) {
  const [value, setValue] = useState('');
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MedicineNameInput value={value} onChange={setValue} onSelect={onSelect} />
    </QueryClientProvider>
  );
}

describe('MedicineNameInput autocomplete', () => {
  it('suggests matches while typing and fills fields only on selection', async () => {
    api.get.mockResolvedValue({
      data: [
        { id: 'panadol-500-tablet', brandName: 'Panadol', genericName: 'Paracetamol', strength: '500', form: 'tablet' },
      ],
      meta: { catalog: { limitations: 'This is a limited sample, not a complete list.' } },
    });

    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSelect={onSelect} />);

    await user.type(screen.getByRole('combobox'), 'Pan');

    const option = await screen.findByRole('option', { name: /Panadol/i });
    // Nothing is chosen automatically just because a match exists.
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(option);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ brandName: 'Panadol', strength: '500' }));
  });

  it('allows free text and says when nothing matches', async () => {
    api.get.mockResolvedValue({ data: [], meta: { catalog: { limitations: 'limited sample' } } });

    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'Zzznotreal');

    expect(await screen.findByText(/no matching medicine/i)).toBeInTheDocument();
    // The typed value is preserved so manual entry still works.
    expect(input).toHaveValue('Zzznotreal');
  });
});
