export const db = {
  getLogs: () => {
    try {
      return JSON.parse(localStorage.getItem('workout_logs') || '[]');
    } catch {
      return [];
    }
  },
  
  saveLog: (log) => {
    const logs = db.getLogs();
    const newLog = { 
      id: Date.now(), 
      date: new Date().toLocaleDateString(),
      ...log 
    };
    logs.push(newLog);
    localStorage.setItem('workout_logs', JSON.stringify(logs));
    return newLog;
  },
  
  getHistory: (exercise) => {
    const logs = db.getLogs();
    return logs.filter(log => 
      log.exercise.toLowerCase().includes(exercise.toLowerCase())
    );
  },
  
  clear: () => localStorage.removeItem('workout_logs')
};
