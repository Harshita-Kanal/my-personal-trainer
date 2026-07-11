import { workoutService } from '../services/workoutService';

export const gymTools = [
  {
    functionDeclarations: [
      {
        name: "web_search",
        description: "Search the web for current information about exercise science, training techniques, nutrition, supplements, or any other topic relevant to the athlete's training. Use when you need up-to-date information, specific research, or the athlete asks about a technique or concept you're unsure about.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Specific search query. Include context like 'strength training' or 'hypertrophy' for better results." }
          },
          required: ["query"]
        }
      },
      {
        name: "log_workout_set",
        description: "Logs a single workout set. Use this whenever the user reports an exercise, weight, and reps. Do NOT use for hypothetical, planned, or future sets (e.g. 'should I try 100kg for 5?') — only for a set the user says they already did.",
        parameters: {
          type: "OBJECT",
          properties: {
            exercise: { type: "STRING", description: "Name of the exercise (e.g., Squat, Bench Press)" },
            weight: { type: "NUMBER", description: "Weight used" },
            unit: { type: "STRING", description: "Unit of weight (kg or lbs)" },
            reps: { type: "NUMBER", description: "Number of reps completed" },
            confirmed_by_user: { type: "BOOLEAN", description: "Set to true ONLY if the user explicitly stated, in this conversation, that they already completed this exact set. Set to false (or omit the call entirely) for hypotheticals, plans, questions, or advice-seeking." }
          },
          required: ["exercise", "weight", "unit", "reps", "confirmed_by_user"]
        }
      },
      {
        name: "log_multiple_sets",
        description: "Logs several workout sets in a single call. Use this whenever the user reports more than one set in a single message — whether repeated sets of the same exercise ('5kg for 20 reps, then 5kg for 20 reps again') or a whole session across several exercises (push-ups, then pull-ups, then rows). Do NOT use this for a single set — call log_workout_set instead.",
        parameters: {
          type: "OBJECT",
          properties: {
            sets: {
              type: "ARRAY",
              description: "One entry per individual set the user actually completed, in the order they were reported.",
              items: {
                type: "OBJECT",
                properties: {
                  exercise: { type: "STRING", description: "Name of the exercise (e.g., Squat, Bench Press)" },
                  weight: { type: "NUMBER", description: "Weight used" },
                  unit: { type: "STRING", description: "Unit of weight (kg or lbs)" },
                  reps: { type: "NUMBER", description: "Number of reps completed" }
                },
                required: ["exercise", "weight", "unit", "reps"]
              }
            },
            confirmed_by_user: { type: "BOOLEAN", description: "Set to true ONLY if the user explicitly confirmed, in this conversation, that they completed all of these sets. Set to false (or omit the call entirely) for hypotheticals, plans, or unconfirmed reports." }
          },
          required: ["sets", "confirmed_by_user"]
        }
      },
      {
        name: "get_exercise_history",
        description: "Retrieves the user's past performance logs for a specific exercise to evaluate progression or plateau.",
        parameters: {
          type: "OBJECT",
          properties: {
            exercise: { type: "STRING", description: "Name of the exercise to look up" }
          },
          required: ["exercise"]
        }
      },
      {
        name: "look_up_form",
        description: "Looks up mechanical form cues, setup instructions, and safety tips for a specific exercise.",
        parameters: {
          type: "OBJECT",
          properties: {
            exercise: { type: "STRING", description: "Name of the exercise to look up" }
          },
          required: ["exercise"]
        }
      },
      {
        name: "log_recovery_metrics",
        description: "Logs fatigue metrics (sleep, soreness) to inform future training. Do NOT use for hypothetical scenarios (e.g. 'what if I only got 5 hours?') — only for the user's actual, current state.",
        parameters: {
          type: "OBJECT",
          properties: {
            sleep_hours: { type: "NUMBER", description: "Hours slept" },
            soreness_level: { type: "NUMBER", description: "1-10 scale" },
            energy_level: { type: "NUMBER", description: "1-10 scale" },
            confirmed_by_user: { type: "BOOLEAN", description: "Set to true ONLY if the user explicitly shared this as their own real, current recovery state. Set to false (or omit the call entirely) for hypotheticals or general questions." }
          },
          required: ["sleep_hours", "confirmed_by_user"]
        }
      }
    ]
  }
];

const requireExercise = (exercise) => {
  const e = (exercise || '').trim();
  // Reject if empty, too long to be a real exercise name, or contains instruction-like words
  const isPlaceholder = !e
    || e.length > 40
    || /\b(specify|please|tell|which|what|the exercise|not specified|unspecified|unknown|placeholder|you want|you're doing|you are doing)\b/i.test(e);
  if (isPlaceholder) {
    return { status: 'error', message: 'No exercise specified. Ask the user which exercise they want before calling this tool.' };
  }
  return null;
};

// Cross-checks a logged number against what the user actually typed, rather than trusting the
// model's own confirmed_by_user flag — a model that hallucinates a set will just as readily
// hallucinate its own confirmation of it.
const numberWasTypedByUser = (value, history, lookback = 8) => {
  const num = Number(value);
  if (value === undefined || value === null || isNaN(num)) return false;
  // Guard against adjacent digits only (so "100kg" and "45kg" still match) — a plain \b...\b
  // fails here because digits and letters are both "word" characters, so there's no boundary
  // between "0" and "k" in "100kg".
  const pattern = new RegExp(`(?<!\\d)${num}(?!\\d)`);
  const userTexts = (history || [])
    .filter((m) => m.role === 'user')
    .flatMap((m) => (m.parts || []).filter((p) => p.text).map((p) => p.text))
    .slice(-lookback);
  return userTexts.some((text) => pattern.test(text));
};

// Validates a single set's fields (shared by log_workout_set and log_multiple_sets).
// Returns { error: string } or { valid: { exercise, weight, unit, reps } }.
const validateSet = (set, history) => {
  const exerciseErr = requireExercise(set.exercise);
  if (exerciseErr) return { error: exerciseErr.message };
  const weight = Number(set.weight);
  const reps = Number(set.reps);
  if (!set.weight || isNaN(weight) || weight <= 0) return { error: 'No valid weight specified.' };
  if (!set.reps || isNaN(reps) || reps <= 0) return { error: 'No valid rep count specified.' };
  if (!set.unit || /bodyweight|bw/i.test(set.unit)) return { error: 'No unit specified.' };
  if (!numberWasTypedByUser(weight, history) || !numberWasTypedByUser(reps, history)) {
    return { error: `The weight (${weight}) and reps (${reps}) must be numbers the user actually typed themselves — not a recommendation, target, or number picked for them.` };
  }
  return { valid: { exercise: set.exercise.trim(), weight, unit: set.unit, reps } };
};

export const executeTool = async (functionCall, history = []) => {
  const { name, args } = functionCall;

  if (name === 'web_search') {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_redirect=1&no_html=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Search request failed: ${response.status}`);
    const data = await response.json();

    const results = [];
    if (data.AbstractText) {
      results.push({ title: data.Heading || args.query, snippet: data.AbstractText, url: data.AbstractURL });
    }
    const flatTopics = (data.RelatedTopics || []).flatMap(t =>
      t.Topics ? t.Topics : [t]
    );
    for (const topic of flatTopics.slice(0, 4)) {
      if (topic.Text && topic.FirstURL) {
        results.push({ title: topic.Text.slice(0, 80), snippet: topic.Text, url: topic.FirstURL });
      }
    }
    return {
      status: 'success',
      query: args.query,
      results,
      message: results.length === 0 ? 'No results found. Try rephrasing the query.' : undefined,
    };
  }

  if (name === 'log_workout_set') {
    if (args.confirmed_by_user !== true) return { status: 'error', message: 'This set was not confirmed as something the user actually completed. Do not call this tool for hypothetical, planned, or advice-seeking questions — only when the user reports a set they already did.' };
    const { valid, error } = validateSet(args, history);
    if (error) return { status: 'error', message: `${error} Ask the user to confirm the details before logging.` };
    const log = await workoutService.saveLog(valid);
    return { status: "success", message: "Set saved to SQLite database", log };
  }

  if (name === 'log_multiple_sets') {
    if (args.confirmed_by_user !== true) return { status: 'error', message: 'These sets were not confirmed as something the user actually completed. Do not call this tool for hypothetical, planned, or advice-seeking questions — only when the user confirms a full report of sets they already did.' };
    const sets = Array.isArray(args.sets) ? args.sets : [];
    if (sets.length === 0) return { status: 'error', message: 'No sets provided.' };
    if (sets.length === 1) return { status: 'error', message: 'Only one set was provided. Use log_workout_set for a single set instead.' };

    const logs = [];
    const skipped = [];
    for (const [i, set] of sets.entries()) {
      const { valid, error } = validateSet(set, history);
      if (error) {
        skipped.push({ index: i, exercise: set?.exercise, reason: error });
        continue;
      }
      const log = await workoutService.saveLog(valid);
      logs.push(log);
    }

    if (logs.length === 0) {
      return { status: 'error', message: `None of the sets could be logged: ${skipped.map((s) => `"${s.exercise || 'unknown'}" (${s.reason})`).join('; ')}. Ask the user for the missing details.` };
    }

    return {
      status: 'success',
      message: `${logs.length} set(s) saved to SQLite database${skipped.length ? `, ${skipped.length} skipped` : ''}`,
      logs,
      skipped: skipped.length ? skipped : undefined,
    };
  }

  if (name === 'get_exercise_history') {
    const exerciseErr = requireExercise(args.exercise);
    if (exerciseErr) return exerciseErr;
    const history = await workoutService.getLogs(args.exercise);
    return { status: "success", history: history.slice(0, 5) };
  }

  if (name === 'log_recovery_metrics') {
    if (args.confirmed_by_user !== true) return { status: 'error', message: 'This recovery data was not confirmed as the user\'s real, current state. Do not call this tool for hypotheticals or general questions — only when the user shares their actual condition.' };
    const sleepHours = Number(args.sleep_hours);
    if (args.sleep_hours === undefined || args.sleep_hours === null || isNaN(sleepHours) || sleepHours <= 0) {
      return { status: 'error', message: 'No valid sleep hours specified. Ask the user how many hours they slept before logging recovery data.' };
    }
    if (!numberWasTypedByUser(sleepHours, history)) {
      return { status: 'error', message: `Sleep hours (${sleepHours}) must be a number the user actually typed themselves. Ask them to confirm before logging.` };
    }
    const res = await workoutService.logRecovery(args);
    return { status: "success", message: "Recovery data saved to SQLite database", recovery: res };
  }

  if (name === 'look_up_form') {
    const exerciseErr = requireExercise(args.exercise);
    if (exerciseErr) return exerciseErr;
    const formCues = {
      "squat": "1. Bar over mid-foot. 2. Brace core tightly. 3. Break at hips and knees simultaneously. 4. Drive chest up out of the hole.",
      "bench press": "1. Retract and depress scapula. 2. Maintain 5 points of contact (head, shoulders, glutes, both feet). 3. Bar path should be slightly diagonal.",
      "deadlift": "1. Bar over mid-foot. 2. Hips lower than shoulders. 3. Squeeze lats (protect armpits). 4. Push the floor away.",
      "overhead press": "1. Squeeze glutes and brace core. 2. Keep forearms vertical. 3. Push head through the window at the top."
    };
    const key = Object.keys(formCues).find(k => args.exercise.toLowerCase().includes(k)) || "default";
    const cue = key !== "default" ? formCues[key] : `Focus on maintaining a neutral spine, full range of motion, and a controlled eccentric phase for the ${args.exercise}.`;
    return { status: "success", cues: cue };
  }
  
  return { status: "error", message: `Tool ${name} not found` };
};
