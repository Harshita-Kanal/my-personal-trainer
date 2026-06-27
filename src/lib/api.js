const API_URL = 'http://localhost:3001/api';

export const api = {
  // Logs
  getLogs: async (exercise = '') => {
    try {
      const res = await fetch(`${API_URL}/logs${exercise ? `?exercise=${encodeURIComponent(exercise)}` : ''}`);
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  getTrainingLog: async () => {
    try {
      const res = await fetch(`${API_URL}/training-log`);
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  saveLog: async (log) => {
    try {
      const res = await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log)
      });
      return await res.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
  logRecovery: async (metrics) => {
    try {
      const res = await fetch(`${API_URL}/recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });
      return await res.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
  
  // Sessions
  getSessions: async () => {
    try {
      const res = await fetch(`${API_URL}/sessions`);
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  createSession: async (title = 'New Workout') => {
    try {
      const res = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      return await res.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
  
  // Messages
  getMessages: async (sessionId) => {
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/messages`);
      return await res.json();
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  updateSessionTitle: async (sessionId, title) => {
    try {
      await fetch(`${API_URL}/sessions/${sessionId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
    } catch (err) {
      console.error(err);
    }
  },
  saveMessage: async (sessionId, role, content, card = null) => {
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content, card })
      });
      return await res.json();
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
};
