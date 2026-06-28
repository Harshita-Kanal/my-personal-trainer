import { get, post } from './api';

export const workoutService = {
  saveLog: (log) =>
    post('/logs', log),

  getLogs: (exercise = '') =>
    get(`/logs${exercise ? `?exercise=${encodeURIComponent(exercise)}` : ''}`),

  getTrainingLog: () =>
    get('/training-log'),

  logRecovery: (metrics) =>
    post('/recovery', metrics),
};
