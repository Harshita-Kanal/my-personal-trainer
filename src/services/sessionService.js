import { get, post, put, del } from './api';

export const sessionService = {
  list: () =>
    get('/sessions'),

  create: (title = 'New Workout') =>
    post('/sessions', { title }),

  delete: (sessionId) =>
    del(`/sessions/${sessionId}`),

  updateTitle: (sessionId, title) =>
    put(`/sessions/${sessionId}/title`, { title }),

  getMessages: (sessionId) =>
    get(`/sessions/${sessionId}/messages`),

  saveMessage: (sessionId, role, content, card = null) =>
    post(`/sessions/${sessionId}/messages`, { role, content, card }),
};
