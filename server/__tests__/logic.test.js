const { getExerciseRecommendation, getRecoveryRecommendation } = require('../index');

describe('getExerciseRecommendation', () => {
  test('returns baseline message when no previous log exists', () => {
    const log = { weight: 80, unit: 'kg', reps: 5 };
    const msg = getExerciseRecommendation(log, null);
    expect(msg).toMatch(/Baseline/i);
    expect(msg).toContain('80kg');
  });

  test('detects load progression when weight increased and reps held', () => {
    const prev = { weight: 77.5, unit: 'kg', reps: 5 };
    const log  = { weight: 80,   unit: 'kg', reps: 5 };
    const msg = getExerciseRecommendation(log, prev);
    expect(msg).toMatch(/progressed/i);
  });

  test('detects load progression when weight increased and reps dropped by 1', () => {
    const prev = { weight: 77.5, unit: 'kg', reps: 5 };
    const log  = { weight: 80,   unit: 'kg', reps: 4 };
    const msg = getExerciseRecommendation(log, prev);
    expect(msg).toMatch(/progressed/i);
  });

  test('reports volume increase and prompts adding a rep', () => {
    const prev = { weight: 80, unit: 'kg', reps: 5 };
    const log  = { weight: 80, unit: 'kg', reps: 6 };
    const msg = getExerciseRecommendation(log, prev);
    expect(msg).toMatch(/Volume is up/i);
    expect(msg).toContain('1 rep');
  });

  test('suggests load increase when reps reach 8 with no volume gain', () => {
    const prev = { weight: 80, unit: 'kg', reps: 8 };
    const log  = { weight: 80, unit: 'kg', reps: 8 };
    const msg = getExerciseRecommendation(log, prev);
    expect(msg).toMatch(/load increase/i);
  });

  test('returns maintenance cue when reps and volume are stagnant below top-end', () => {
    const prev = { weight: 80, unit: 'kg', reps: 5 };
    const log  = { weight: 80, unit: 'kg', reps: 5 };
    const msg = getExerciseRecommendation(log, prev);
    expect(msg).toMatch(/Maintain/i);
  });
});

describe('getRecoveryRecommendation', () => {
  test('flags low sleep as a recovery risk', () => {
    const msg = getRecoveryRecommendation({ sleep_hours: 5, soreness_level: 3, energy_level: 7 });
    expect(msg).toMatch(/intensity moderate/i);
  });

  test('flags high soreness', () => {
    const msg = getRecoveryRecommendation({ sleep_hours: 8, soreness_level: 8, energy_level: 7 });
    expect(msg).toMatch(/High soreness/i);
  });

  test('flags low energy', () => {
    const msg = getRecoveryRecommendation({ sleep_hours: 8, soreness_level: 3, energy_level: 3 });
    expect(msg).toMatch(/Energy is low/i);
  });

  test('returns green-light cue when all metrics are solid', () => {
    const msg = getRecoveryRecommendation({ sleep_hours: 8, soreness_level: 3, energy_level: 8 });
    expect(msg).toMatch(/usable/i);
  });

  test('sleep check takes priority over soreness', () => {
    const msg = getRecoveryRecommendation({ sleep_hours: 5, soreness_level: 9, energy_level: 2 });
    expect(msg).toMatch(/intensity moderate/i);
  });
});
