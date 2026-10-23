import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PronounceButton } from './PronounceButton';

describe('PronounceButton', () => {
  afterEach(() => {
    delete window.speechSynthesis;
    delete window.SpeechSynthesisUtterance;
  });

  it('renders nothing (and does not throw) when speech synthesis is unavailable', () => {
    expect(() => render(<PronounceButton text="Panadol" />)).not.toThrow();
    // With no speech support the button simply is not rendered, so the rest of
    // the page keeps working.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('speaks the medicine name and cancels any previous utterance', async () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    class FakeUtterance {
      constructor(text) {
        this.text = text;
      }
    }
    window.SpeechSynthesisUtterance = FakeUtterance;
    window.speechSynthesis = { speak, cancel };

    const user = userEvent.setup();
    render(<PronounceButton text="Panadol" />);

    const button = screen.getByRole('button', { name: /pronounce panadol/i });
    await user.click(button);
    await user.click(button);

    // Each click stops the previous speech before starting again.
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak.mock.calls[0][0].text).toBe('Panadol');
  });
});
