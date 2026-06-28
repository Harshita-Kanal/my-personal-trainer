import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../../components/MessageBubble';

describe('MessageBubble', () => {
  test('renders user message with text content', () => {
    render(<MessageBubble message={{ id: 1, role: 'user', content: 'Hello coach', card: null }} />);
    expect(screen.getByText('Hello coach')).toBeInTheDocument();
  });

  test('renders model message with text content', () => {
    render(<MessageBubble message={{ id: 2, role: 'model', content: 'Nice progress today.', card: null }} />);
    expect(screen.getByText('Nice progress today.')).toBeInTheDocument();
  });

  test('renders a card when present', () => {
    const card = { type: 'progress', title: 'Set Logged', stats: [], insight: 'Saved.' };
    render(<MessageBubble message={{ id: 3, role: 'model', content: '', card }} />);
    expect(screen.getByText('Set Logged')).toBeInTheDocument();
    expect(screen.getByText('Saved.')).toBeInTheDocument();
  });

  test('can render both text and card', () => {
    const card = { type: 'form', title: 'Form: Deadlift', insight: 'Keep lats tight.' };
    render(<MessageBubble message={{ id: 4, role: 'model', content: 'Here are your form cues.', card }} />);
    expect(screen.getByText('Here are your form cues.')).toBeInTheDocument();
    expect(screen.getByText('Form: Deadlift')).toBeInTheDocument();
  });

  test('renders nothing extra when content is empty and card is null', () => {
    const { container } = render(<MessageBubble message={{ id: 5, role: 'user', content: '', card: null }} />);
    expect(container.querySelector('.message-bubble')).not.toBeInTheDocument();
    expect(container.querySelector('.agent-card')).not.toBeInTheDocument();
  });
});
