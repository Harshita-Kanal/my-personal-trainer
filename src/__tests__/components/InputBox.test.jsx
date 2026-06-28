import { render, screen, fireEvent } from '@testing-library/react';
import { InputBox } from '../../components/InputBox';

describe('InputBox', () => {
  test('renders textarea with placeholder', () => {
    render(<InputBox value="" onChange={() => {}} onSend={() => {}} disabled={false} />);
    expect(screen.getByPlaceholderText('Message Strength Coach...')).toBeInTheDocument();
  });

  test('uses centered placeholder when centered prop is true', () => {
    render(<InputBox value="" onChange={() => {}} onSend={() => {}} disabled={false} centered />);
    expect(screen.getByPlaceholderText(/log your set/i)).toBeInTheDocument();
  });

  test('calls onChange when user types', () => {
    const onChange = vi.fn();
    render(<InputBox value="" onChange={onChange} onSend={() => {}} disabled={false} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Bench 80kg x 5' } });
    expect(onChange).toHaveBeenCalledWith('Bench 80kg x 5');
  });

  test('send button is disabled when value is empty', () => {
    render(<InputBox value="" onChange={() => {}} onSend={() => {}} disabled={false} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('send button is enabled when value is non-empty', () => {
    render(<InputBox value="something" onChange={() => {}} onSend={() => {}} disabled={false} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  test('calls onSend when send button is clicked', () => {
    const onSend = vi.fn();
    render(<InputBox value="test" onChange={() => {}} onSend={onSend} disabled={false} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSend).toHaveBeenCalledOnce();
  });

  test('calls onSend on Enter keydown', () => {
    const onSend = vi.fn();
    render(<InputBox value="test" onChange={() => {}} onSend={onSend} disabled={false} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSend).toHaveBeenCalledOnce();
  });

  test('does not call onSend on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<InputBox value="test" onChange={() => {}} onSend={onSend} disabled={false} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  test('textarea is disabled when disabled prop is true', () => {
    render(<InputBox value="" onChange={() => {}} onSend={() => {}} disabled={true} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  test('shows disclaimer when not centered', () => {
    render(<InputBox value="" onChange={() => {}} onSend={() => {}} disabled={false} />);
    expect(screen.getByText(/always verify heavy lifts/i)).toBeInTheDocument();
  });

  test('hides disclaimer when centered', () => {
    render(<InputBox value="" onChange={() => {}} onSend={() => {}} disabled={false} centered />);
    expect(screen.queryByText(/always verify heavy lifts/i)).not.toBeInTheDocument();
  });
});
