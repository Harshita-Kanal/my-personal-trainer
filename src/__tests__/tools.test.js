import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/workoutService', () => ({
  workoutService: {
    saveLog: vi.fn(),
    getLogs: vi.fn(),
    logRecovery: vi.fn(),
  },
}));

import { executeTool } from '../lib/tools';
import { workoutService } from '../services/workoutService';

beforeEach(() => vi.clearAllMocks());

// ─── web_search ───────────────────────────────────────────────────────────────

describe('executeTool: web_search', () => {
  test('returns results from DuckDuckGo abstract', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Heading: 'Progressive Overload',
        AbstractText: 'A training principle.',
        AbstractURL: 'https://en.wikipedia.org/wiki/Progressive_overload',
        RelatedTopics: [],
      }),
    });

    const result = await executeTool({ name: 'web_search', args: { query: 'progressive overload' } });
    expect(result.status).toBe('success');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe('Progressive Overload');
  });

  test('returns related topics when abstract is absent', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Heading: '',
        AbstractText: '',
        AbstractURL: '',
        RelatedTopics: [
          { Text: 'Topic A', FirstURL: 'https://ddg.gg/a' },
          { Text: 'Topic B', FirstURL: 'https://ddg.gg/b' },
        ],
      }),
    });

    const result = await executeTool({ name: 'web_search', args: { query: 'RPE training' } });
    expect(result.status).toBe('success');
    expect(result.results).toHaveLength(2);
  });

  test('flattens nested topic groups from DuckDuckGo response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Heading: '', AbstractText: '', AbstractURL: '',
        RelatedTopics: [
          { Name: 'Exercises', Topics: [
            { Text: 'Squat exercise', FirstURL: 'https://ddg.gg/squat' },
            { Text: 'Deadlift exercise', FirstURL: 'https://ddg.gg/deadlift' },
          ]},
        ],
      }),
    });

    const result = await executeTool({ name: 'web_search', args: { query: 'squat' } });
    expect(result.status).toBe('success');
    expect(result.results).toHaveLength(2);
    expect(result.results[0].snippet).toBe('Squat exercise');
  });

  test('returns empty results with message when nothing is found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Heading: '', AbstractText: '', AbstractURL: '', RelatedTopics: [] }),
    });

    const result = await executeTool({ name: 'web_search', args: { query: 'xyzxyz123abc' } });
    expect(result.status).toBe('success');
    expect(result.results).toHaveLength(0);
    expect(result.message).toMatch(/no results/i);
  });

  test('throws when the fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(
      executeTool({ name: 'web_search', args: { query: 'anything' } })
    ).rejects.toThrow('500');
  });
});

// ─── look_up_form ─────────────────────────────────────────────────────────────

describe('executeTool: look_up_form', () => {
  test('returns squat cues for "squat"', async () => {
    const result = await executeTool({ name: 'look_up_form', args: { exercise: 'squat' } });
    expect(result.status).toBe('success');
    expect(result.cues).toMatch(/mid-foot/i);
  });

  test('returns bench press cues for "bench press"', async () => {
    const result = await executeTool({ name: 'look_up_form', args: { exercise: 'bench press' } });
    expect(result.status).toBe('success');
    expect(result.cues).toMatch(/scapula/i);
  });

  test('returns deadlift cues for "deadlift"', async () => {
    const result = await executeTool({ name: 'look_up_form', args: { exercise: 'deadlift' } });
    expect(result.status).toBe('success');
    expect(result.cues).toMatch(/lats/i);
  });

  test('returns overhead press cues for "overhead press"', async () => {
    const result = await executeTool({ name: 'look_up_form', args: { exercise: 'overhead press' } });
    expect(result.status).toBe('success');
    expect(result.cues).toMatch(/glutes/i);
  });

  test('partial match works — "barbell squat" resolves to squat cues', async () => {
    const result = await executeTool({ name: 'look_up_form', args: { exercise: 'barbell squat' } });
    expect(result.status).toBe('success');
    expect(result.cues).toMatch(/mid-foot/i);
  });

  test('returns generic cue for unknown exercise', async () => {
    const result = await executeTool({ name: 'look_up_form', args: { exercise: 'cable fly' } });
    expect(result.status).toBe('success');
    expect(result.cues).toMatch(/neutral spine/i);
    expect(result.cues).toContain('cable fly');
  });
});

// ─── log_workout_set ──────────────────────────────────────────────────────────

describe('executeTool: log_workout_set', () => {
  test('calls workoutService.saveLog with the provided args and returns success', async () => {
    const saved = { id: 1, exercise: 'Squat', weight: 100, unit: 'kg', reps: 5 };
    workoutService.saveLog.mockResolvedValue(saved);

    const result = await executeTool({
      name: 'log_workout_set',
      args: { exercise: 'Squat', weight: 100, unit: 'kg', reps: 5 },
    });

    expect(workoutService.saveLog).toHaveBeenCalledWith({ exercise: 'Squat', weight: 100, unit: 'kg', reps: 5 });
    expect(result.status).toBe('success');
    expect(result.log).toEqual(saved);
  });
});

// ─── get_exercise_history ─────────────────────────────────────────────────────

describe('executeTool: get_exercise_history', () => {
  test('fetches logs and caps result at 5 entries', async () => {
    const sixLogs = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, exercise: 'Bench Press' }));
    workoutService.getLogs.mockResolvedValue(sixLogs);

    const result = await executeTool({
      name: 'get_exercise_history',
      args: { exercise: 'Bench Press' },
    });

    expect(workoutService.getLogs).toHaveBeenCalledWith('Bench Press');
    expect(result.status).toBe('success');
    expect(result.history).toHaveLength(5);
  });

  test('returns empty history without error when no logs exist', async () => {
    workoutService.getLogs.mockResolvedValue([]);
    const result = await executeTool({ name: 'get_exercise_history', args: { exercise: 'Deadlift' } });
    expect(result.status).toBe('success');
    expect(result.history).toHaveLength(0);
  });
});

// ─── log_recovery_metrics ─────────────────────────────────────────────────────

describe('executeTool: log_recovery_metrics', () => {
  test('calls workoutService.logRecovery and returns success', async () => {
    const saved = { id: 1, sleep_hours: 7, soreness_level: 3, energy_level: 8 };
    workoutService.logRecovery.mockResolvedValue(saved);

    const result = await executeTool({
      name: 'log_recovery_metrics',
      args: { sleep_hours: 7, soreness_level: 3, energy_level: 8 },
    });

    expect(workoutService.logRecovery).toHaveBeenCalledWith({ sleep_hours: 7, soreness_level: 3, energy_level: 8 });
    expect(result.status).toBe('success');
    expect(result.recovery).toEqual(saved);
  });
});

// ─── unknown tool ─────────────────────────────────────────────────────────────

describe('executeTool: unknown tool', () => {
  test('returns error status for unrecognized tool name', async () => {
    const result = await executeTool({ name: 'nonexistent_tool', args: {} });
    expect(result.status).toBe('error');
    expect(result.message).toContain('nonexistent_tool');
  });
});
