import { describe, test, expect } from 'vitest';
import { buildCardData } from '../lib/cards';

describe('buildCardData: log_workout_set', () => {
  test('pulls values from result.log', () => {
    const card = buildCardData('log_workout_set', {}, {
      log: { exercise: 'Squat', weight: 100, unit: 'kg', reps: 5 }
    });
    expect(card.type).toBe('progress');
    expect(card.stats).toContainEqual({ label: 'Exercise', value: 'Squat' });
    expect(card.stats).toContainEqual({ label: 'Weight', value: '100 kg' });
    expect(card.stats).toContainEqual({ label: 'Reps', value: 5 });
  });

  test('falls back to args when result.log is absent', () => {
    const card = buildCardData('log_workout_set', { exercise: 'Bench Press', weight: 80, unit: 'kg', reps: 8 }, {});
    expect(card.stats).toContainEqual({ label: 'Exercise', value: 'Bench Press' });
  });
});

describe('buildCardData: get_exercise_history', () => {
  test('reports correct session count', () => {
    const card = buildCardData('get_exercise_history', { exercise: 'Deadlift' }, { history: [{}, {}, {}] });
    expect(card.insight).toMatch(/3 sessions/i);
  });

  test('handles empty history gracefully', () => {
    const card = buildCardData('get_exercise_history', { exercise: 'Deadlift' }, { history: [] });
    expect(card.insight).toMatch(/no previous/i);
  });

  test('handles missing history field', () => {
    const card = buildCardData('get_exercise_history', { exercise: 'Deadlift' }, {});
    expect(card.insight).toMatch(/no previous/i);
  });
});

describe('buildCardData: look_up_form', () => {
  test('sets type to form and passes cues through', () => {
    const card = buildCardData('look_up_form', { exercise: 'squat' }, { cues: 'Bar over mid-foot.' });
    expect(card.type).toBe('form');
    expect(card.insight).toBe('Bar over mid-foot.');
    expect(card.title).toMatch(/squat/i);
  });
});

describe('buildCardData: log_recovery_metrics', () => {
  test('formats sleep, soreness, energy from result.recovery', () => {
    const card = buildCardData('log_recovery_metrics', {}, {
      recovery: { sleep_hours: 7, soreness_level: 4, energy_level: 6 }
    });
    expect(card.type).toBe('recovery');
    expect(card.stats).toContainEqual({ label: 'Sleep', value: '7h' });
    expect(card.stats).toContainEqual({ label: 'Soreness', value: '4/10' });
    expect(card.stats).toContainEqual({ label: 'Energy', value: '6/10' });
  });

  test('shows dash for missing fields', () => {
    const card = buildCardData('log_recovery_metrics', { sleep_hours: 8 }, { recovery: { sleep_hours: 8 } });
    expect(card.stats).toContainEqual({ label: 'Soreness', value: '—' });
    expect(card.stats).toContainEqual({ label: 'Energy', value: '—' });
  });
});

describe('buildCardData: web_search', () => {
  test('reports result count', () => {
    const card = buildCardData('web_search', { query: 'RPE training' }, {
      results: [{ title: 'A', snippet: 'B', url: 'http://a.com' }]
    });
    expect(card.type).toBe('search');
    expect(card.insight).toMatch(/1 result/i);
    expect(card.title).toMatch(/RPE training/);
  });

  test('shows no-results message when array is empty', () => {
    const card = buildCardData('web_search', { query: 'xyz' }, { results: [], message: 'No results found.' });
    expect(card.insight).toMatch(/no results/i);
  });
});

describe('buildCardData: unknown tool', () => {
  test('returns null for unrecognised tool names', () => {
    expect(buildCardData('unknown_tool', {}, {})).toBeNull();
  });
});

describe('buildCardData: rejected tool calls', () => {
  test('returns null for a rejected log_workout_set instead of rendering fabricated args', () => {
    const card = buildCardData(
      'log_workout_set',
      { exercise: 'deadlift', weight: 0, reps: 0, confirmed_by_user: false },
      { status: 'error', message: 'This set was not confirmed as something the user actually completed.' }
    );
    expect(card).toBeNull();
  });

  test('returns null for a rejected log_recovery_metrics', () => {
    const card = buildCardData(
      'log_recovery_metrics',
      { sleep_hours: 0 },
      { status: 'error', message: 'No valid sleep hours specified.' }
    );
    expect(card).toBeNull();
  });

  test('returns null for any tool call that errored, regardless of name', () => {
    expect(buildCardData('get_exercise_history', { exercise: 'Squat' }, { status: 'error' })).toBeNull();
  });
});
