import { render, screen } from '@testing-library/react';
import { AgentCard } from '../../components/AgentCard';

const progressCard = {
  type: 'progress',
  title: 'Set Logged',
  stats: [
    { label: 'Exercise', value: 'Squat' },
    { label: 'Weight', value: '100kg' },
    { label: 'Reps', value: 5 },
  ],
  insight: 'Saved to your training log.',
};

const formCard = {
  type: 'form',
  title: 'Form: squat',
  insight: 'Bar over mid-foot. Drive knees out.',
};

const recoveryCard = {
  type: 'recovery',
  title: 'Recovery Logged',
  stats: [
    { label: 'Sleep', value: '7h' },
    { label: 'Soreness', value: '3/10' },
    { label: 'Energy', value: '8/10' },
  ],
  insight: 'Recovery markers saved.',
};

const searchCard = {
  type: 'search',
  title: 'Search: RPE training',
  insight: '3 results found.',
};

describe('AgentCard', () => {
  test('renders progress card with title, stats, and insight', () => {
    render(<AgentCard card={progressCard} />);
    expect(screen.getByText('Set Logged')).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('100kg')).toBeInTheDocument();
    expect(screen.getByText('Saved to your training log.')).toBeInTheDocument();
  });

  test('renders form card without stats section', () => {
    render(<AgentCard card={formCard} />);
    expect(screen.getByText('Form: squat')).toBeInTheDocument();
    expect(screen.getByText('Bar over mid-foot. Drive knees out.')).toBeInTheDocument();
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
  });

  test('renders recovery card with all three stats', () => {
    render(<AgentCard card={recoveryCard} />);
    expect(screen.getByText('Sleep')).toBeInTheDocument();
    expect(screen.getByText('7h')).toBeInTheDocument();
    expect(screen.getByText('Soreness')).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  test('renders search card', () => {
    render(<AgentCard card={searchCard} />);
    expect(screen.getByText('Search: RPE training')).toBeInTheDocument();
    expect(screen.getByText('3 results found.')).toBeInTheDocument();
  });

  test('renders without stats when stats is absent', () => {
    render(<AgentCard card={{ type: 'form', title: 'Form Check', insight: 'Squeeze lats.' }} />);
    expect(screen.queryByText('Exercise')).not.toBeInTheDocument();
  });
});
