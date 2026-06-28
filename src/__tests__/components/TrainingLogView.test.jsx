import { render, screen } from '@testing-library/react';
import { TrainingLogView } from '../../components/TrainingLogView';

const exerciseLogs = [
  { id: 1, type: 'exercise', date: '2025-01-10', exercise: 'Squat', weight: 100, unit: 'kg', reps: 5, recommendation: 'Add 2.5kg next session.' },
  { id: 2, type: 'exercise', date: '2025-01-08', exercise: 'Bench Press', weight: 80, unit: 'kg', reps: 8, recommendation: 'Hold weight, add reps.' },
];

const recoveryLog = [
  { id: 3, type: 'recovery', date: '2025-01-09', sleep_hours: 7, soreness_level: 3, energy_level: 7, recommendation: '' },
];

describe('TrainingLogView', () => {
  test('shows empty state message when no logs', () => {
    render(<TrainingLogView trainingLog={[]} />);
    expect(screen.getByText(/no logs yet/i)).toBeInTheDocument();
  });

  test('renders exercise rows with exercise name, weight, and reps', () => {
    render(<TrainingLogView trainingLog={exerciseLogs} />);
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('100kg')).toBeInTheDocument();
    expect(screen.getByText('Add 2.5kg next session.')).toBeInTheDocument();
  });

  test('renders recovery rows with sleep hours', () => {
    render(<TrainingLogView trainingLog={recoveryLog} />);
    expect(screen.getByText('7h sleep')).toBeInTheDocument();
    expect(screen.getByText(/soreness 3/i)).toBeInTheDocument();
  });

  test('renders table headers', () => {
    render(<TrainingLogView trainingLog={[]} />);
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Exercise')).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('Reps')).toBeInTheDocument();
    expect(screen.getByText('Recommendation')).toBeInTheDocument();
  });

  test('renders multiple rows correctly', () => {
    render(<TrainingLogView trainingLog={exerciseLogs} />);
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
  });
});
