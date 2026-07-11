/**
 * Builds UI card data from a completed tool call.
 * Pure function — no side effects.
 *
 * @param {string} callName - tool name
 * @param {object} args     - args passed to the tool
 * @param {object} result   - result returned by executeTool
 * @returns {{ type, title, stats?, insight } | null}
 */
export function buildCardData(callName, args, result) {
  if (result?.status === 'error') return null;

  if (callName === 'log_workout_set') {
    const log = result.log || args;
    const unit = (log.unit || '').toLowerCase();
    const isBodyweight = unit === 'bodyweight' || unit === 'bw' || Number(log.weight) === 0;
    const weightDisplay = isBodyweight ? 'Bodyweight' : `${log.weight} ${log.unit}`;
    return {
      type: 'progress',
      title: 'Set Logged',
      stats: [
        { label: 'Exercise', value: log.exercise },
        { label: 'Weight',   value: weightDisplay },
        { label: 'Reps',     value: log.reps },
      ],
      insight: 'Saved to your training log.',
    };
  }

  if (callName === 'get_exercise_history') {
    const count = result.history?.length ?? 0;
    return {
      type: 'progress',
      title: 'Exercise History',
      stats: [{ label: 'Exercise', value: args.exercise }],
      insight: count > 0 ? `Last ${count} session${count !== 1 ? 's' : ''} loaded.` : 'No previous sessions found.',
    };
  }

  if (callName === 'look_up_form') {
    return {
      type: 'form',
      title: `Form: ${args.exercise}`,
      insight: result.cues,
    };
  }

  if (callName === 'log_recovery_metrics') {
    const rec = result.recovery || args;
    return {
      type: 'recovery',
      title: 'Recovery Logged',
      stats: [
        { label: 'Sleep',    value: rec.sleep_hours    ? `${rec.sleep_hours}h`      : '—' },
        { label: 'Soreness', value: rec.soreness_level ? `${rec.soreness_level}/10` : '—' },
        { label: 'Energy',   value: rec.energy_level   ? `${rec.energy_level}/10`   : '—' },
      ],
      insight: 'Recovery markers saved.',
    };
  }

  if (callName === 'web_search') {
    const count = result.results?.length ?? 0;
    return {
      type: 'search',
      title: `Search: ${args.query}`,
      insight: count > 0
        ? `${count} result${count !== 1 ? 's' : ''} found.`
        : result.message || 'No results found.',
    };
  }

  return null;
}
