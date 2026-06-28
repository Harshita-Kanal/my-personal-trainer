import { render, screen } from '@testing-library/react';
import { ChatArea } from '../../components/ChatArea';

const makeMsg = (id, role, content) => ({ id, role, content, card: null });

describe('ChatArea', () => {
  test('renders all messages', () => {
    const messages = [
      makeMsg(1, 'user', 'Bench press 80kg x 8'),
      makeMsg(2, 'model', 'Good session. Volume is up 10%.'),
    ];
    render(<ChatArea messages={messages} isStreaming={false} />);
    expect(screen.getByText('Bench press 80kg x 8')).toBeInTheDocument();
    expect(screen.getByText('Good session. Volume is up 10%.')).toBeInTheDocument();
  });

  test('shows spinner when isStreaming and last message is from user', () => {
    const messages = [makeMsg(1, 'user', 'Log squat 100kg x 5')];
    const { container } = render(<ChatArea messages={messages} isStreaming={true} />);
    expect(container.querySelector('.lucide-loader-2, svg')).toBeInTheDocument();
  });

  test('does not show spinner when not streaming', () => {
    const messages = [makeMsg(1, 'user', 'Hello')];
    render(<ChatArea messages={messages} isStreaming={false} />);
    // The spinner wrapper only appears when isStreaming && lastIsUser
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('renders empty without crashing', () => {
    const { container } = render(<ChatArea messages={[]} isStreaming={false} />);
    expect(container.querySelector('.chat-area')).toBeInTheDocument();
  });
});
