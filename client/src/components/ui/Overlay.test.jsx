import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Overlay';

/**
 * Mirrors the real callers: a focusable trigger, a modal opened by it, and a
 * controlled input inside. Before the fix, the modal's focus effect re-ran on
 * every render (because the inline onClose changed identity), the cleanup moved
 * focus back to the trigger, and the input stopped accepting keystrokes after
 * the first character.
 */
function Harness() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Add a person
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a person">
        <input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('keeps focus in a controlled input while typing', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Add a person' }));
    const input = screen.getByLabelText('Name');
    await user.click(input);

    await user.type(input, 'Ayesha');

    // Focus must stay in the field, otherwise typing is interrupted.
    expect(document.activeElement).toBe(input);
    expect(input).toHaveValue('Ayesha');
  });

  it('closes on Escape using the latest onClose handler', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Test">
        <input aria-label="Name" />
      </Modal>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
