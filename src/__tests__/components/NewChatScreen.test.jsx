import { render, screen, fireEvent } from '@testing-library/react';
import { NewChatScreen, DEFAULT_SUGGESTIONS } from '../../components/NewChatScreen';

describe('NewChatScreen', () => {
  test('renders hero heading', () => {
    render(<NewChatScreen inputValue="" onInputChange={() => {}} onSend={() => {}} isStreaming={false} />);
    expect(screen.getByText(/what are we lifting today/i)).toBeInTheDocument();
  });

  test('renders all default suggestion cards', () => {
    render(<NewChatScreen inputValue="" onInputChange={() => {}} onSend={() => {}} isStreaming={false} />);
    for (const s of DEFAULT_SUGGESTIONS) {
      expect(screen.getByText(s.title)).toBeInTheDocument();
    }
  });

  test('clicking a suggestion card calls onSend with the suggestion prompt', () => {
    const onSend = vi.fn();
    render(<NewChatScreen inputValue="" onInputChange={() => {}} onSend={onSend} isStreaming={false} />);
    fireEvent.click(screen.getByText('Log a Set'));
    expect(onSend).toHaveBeenCalledWith(DEFAULT_SUGGESTIONS[0].prompt);
  });

  test('renders custom suggestions when provided', () => {
    const custom = [{ title: 'Custom', description: 'A custom prompt.', prompt: 'Do it.' }];
    render(<NewChatScreen suggestions={custom} inputValue="" onInputChange={() => {}} onSend={() => {}} isStreaming={false} />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.queryByText('Log a Set')).not.toBeInTheDocument();
  });

  test('renders input in centered mode', () => {
    render(<NewChatScreen inputValue="" onInputChange={() => {}} onSend={() => {}} isStreaming={false} />);
    expect(screen.getByPlaceholderText(/log your set/i)).toBeInTheDocument();
  });
});
