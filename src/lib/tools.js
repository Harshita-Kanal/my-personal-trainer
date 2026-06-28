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
        description: "Logs a single workout set. Use this whenever the user reports an exercise, weight, and reps.",
        parameters: {
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
        description: "Logs fatigue metrics (sleep, soreness) to inform future training.",
        parameters: {
          type: "OBJECT",
          properties: {
            sleep_hours: { type: "NUMBER", description: "Hours slept" },
            soreness_level: { type: "NUMBER", description: "1-10 scale" },
            energy_level: { type: "NUMBER", description: "1-10 scale" }
          },
          required: ["sleep_hours"]
        }
      }
    ]
  }
];

export const executeTool = async (functionCall) => {
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
    const log = await workoutService.saveLog(args);
    return { status: "success", message: "Set saved to SQLite database", log };
  }

  if (name === 'get_exercise_history') {
    const history = await workoutService.getLogs(args.exercise);
    return { status: "success", history: history.slice(0, 5) };
  }

  if (name === 'log_recovery_metrics') {
    const res = await workoutService.logRecovery(args);
    return { status: "success", message: "Recovery data saved to SQLite database", recovery: res };
  }

  if (name === 'look_up_form') {
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
