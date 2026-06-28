import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../../components/Sidebar';

const sessions = [
  { id: 1, title: 'Monday Push' },
  { id: 2, title: 'Wednesday Pull' },
];

const defaultProps = {
  sessions,
  currentSessionId: null,
  currentView: 'chat',
  onNewChat: vi.fn(),
  onLoadSession: vi.fn(),
  onDeleteSession: vi.fn(),
  onViewChange: vi.fn(),
  isOpen: false,
  onClose: vi.fn(),
};

describe('Sidebar', () => {
  test('renders session titles', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('Monday Push')).toBeInTheDocument();
    expect(screen.getByText('Wednesday Pull')).toBeInTheDocument();
  });

  test('clicking a session calls onLoadSession with its id', () => {
    const onLoadSession = vi.fn();
    render(<Sidebar {...defaultProps} onLoadSession={onLoadSession} />);
    fireEvent.click(screen.getByText('Monday Push'));
    expect(onLoadSession).toHaveBeenCalledWith(1);
  });

  test('clicking delete calls onDeleteSession with the session id', () => {
    const onDeleteSession = vi.fn();
    render(<Sidebar {...defaultProps} onDeleteSession={onDeleteSession} />);
    const deleteButtons = screen.getAllByTitle('Delete session');
    fireEvent.click(deleteButtons[0]);
    expect(onDeleteSession).toHaveBeenCalledWith(1);
  });

  test('shows empty state when no sessions exist', () => {
    render(<Sidebar {...defaultProps} sessions={[]} />);
    expect(screen.getByText(/no previous sessions/i)).toBeInTheDocument();
  });

  test('clicking New Workout calls onNewChat', () => {
    const onNewChat = vi.fn();
    render(<Sidebar {...defaultProps} onNewChat={onNewChat} />);
    fireEvent.click(screen.getByText(/new workout/i));
    expect(onNewChat).toHaveBeenCalledOnce();
  });

  test('clicking Training Log calls onViewChange with "history"', () => {
    const onViewChange = vi.fn();
    render(<Sidebar {...defaultProps} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Training Log'));
    expect(onViewChange).toHaveBeenCalledWith('history');
  });

  test('overlay is present when isOpen is true', () => {
    const { container } = render(<Sidebar {...defaultProps} isOpen={true} />);
    expect(container.querySelector('.sidebar-overlay')).toBeInTheDocument();
  });

  test('overlay is absent when isOpen is false', () => {
    const { container } = render(<Sidebar {...defaultProps} isOpen={false} />);
    expect(container.querySelector('.sidebar-overlay')).not.toBeInTheDocument();
  });

  test('active session gets active class', () => {
    const { container } = render(<Sidebar {...defaultProps} currentSessionId={1} currentView="chat" />);
    const items = container.querySelectorAll('.history-item');
    expect(items[0].classList.contains('active')).toBe(true);
    expect(items[1].classList.contains('active')).toBe(false);
  });
});
