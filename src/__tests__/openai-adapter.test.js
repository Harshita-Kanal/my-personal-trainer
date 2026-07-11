import { describe, test, expect, vi, afterEach } from 'vitest';
import { extractTextModeFunctionCall } from '../lib/adapters/openai';

describe('extractTextModeFunctionCall: malformed tool calls are not silently dropped', () => {
  afterEach(() => vi.restoreAllMocks());

  test('Format 3 (<function=name>) forwards the call with empty args when JSON is malformed', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const text = '<function=log_workout_set>{"exercise": "squat", "weight": 100 "reps": 5}</function>';

    const result = extractTextModeFunctionCall(text);

    expect(result).not.toBeNull();
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toEqual({ name: 'log_workout_set', args: {} });
    expect(errSpy).toHaveBeenCalled();
  });

  test('Format 3 still recovers a well-formed call after a malformed one earlier in the text', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const text =
      '<function=log_workout_set>{"exercise": "squat", bad json here}</function>' +
      '<function=log_workout_set>{"exercise": "bench press", "weight": 45, "unit": "kg", "reps": 8}</function>';

    const result = extractTextModeFunctionCall(text);

    expect(result.calls).toHaveLength(2);
    expect(result.calls[0]).toEqual({ name: 'log_workout_set', args: {} });
    expect(result.calls[1].args.exercise).toBe('bench press');
  });

  test('Format 4 (<function(name)(args)>) forwards the call with empty args on malformed JSON', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const text = '<function(log_recovery_metrics)({"sleep_hours": 7 "soreness_level": 3})>';

    const result = extractTextModeFunctionCall(text);

    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toEqual({ name: 'log_recovery_metrics', args: {} });
  });

  test('well-formed calls still parse normally (no regression)', () => {
    const text = '<function=log_workout_set>{"exercise": "deadlift", "weight": 100, "unit": "kg", "reps": 5}</function>';

    const result = extractTextModeFunctionCall(text);

    expect(result.calls).toHaveLength(1);
    expect(result.calls[0].name).toBe('log_workout_set');
    expect(result.calls[0].args).toEqual({ exercise: 'deadlift', weight: 100, unit: 'kg', reps: 5 });
  });
});
