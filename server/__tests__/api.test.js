const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Point to a temp DB so tests are isolated from production data
const TEST_DB = path.resolve(__dirname, 'test.sqlite');
process.env.DB_PATH = TEST_DB;

// Clear and re-create the test DB file before loading the server
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

// Stub out real Clerk verification. Requests are treated as authenticated as
// 'test-user-1' by default; tests can simulate a second user via the
// x-test-user header (a test-only shim, never read by production code) or
// simulate a signed-out request via x-test-user: '' .
jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req, res, next) => next(),
  getAuth: (req) => ({
    userId: req.headers['x-test-user'] !== undefined ? req.headers['x-test-user'] || null : 'test-user-1',
  }),
}));

const { app, ready } = require('../index');

beforeAll(() => ready);

afterAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

// ─── Logs ────────────────────────────────────────────────────────────────────

describe('POST /api/logs', () => {
  test('saves a valid workout set and returns it', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({ exercise: 'Squat', weight: 100, unit: 'kg', reps: 5 });
    expect(res.status).toBe(200);
    expect(res.body.exercise).toBe('Squat');
    expect(res.body.weight).toBe(100);
    expect(res.body.unit).toBe('kg');
    expect(res.body.reps).toBe(5);
    expect(res.body.id).toBeDefined();
  });

  test('returns 500 when required fields are missing (sqlite constraint)', async () => {
    const res = await request(app)
      .post('/api/logs')
      .send({ weight: 100 }); // missing exercise, unit, reps
    expect(res.status).toBe(500);
  });
});

describe('GET /api/logs', () => {
  test('returns all logs when no filter given', async () => {
    const res = await request(app).get('/api/logs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('filters by exercise name (case-insensitive partial match)', async () => {
    await request(app).post('/api/logs').send({ exercise: 'Bench Press', weight: 80, unit: 'kg', reps: 5 });
    const res = await request(app).get('/api/logs?exercise=bench');
    expect(res.status).toBe(200);
    expect(res.body.every(l => l.exercise.toLowerCase().includes('bench'))).toBe(true);
  });
});

// ─── Recovery ────────────────────────────────────────────────────────────────

describe('POST /api/recovery', () => {
  test('saves recovery metrics and returns them', async () => {
    const res = await request(app)
      .post('/api/recovery')
      .send({ sleep_hours: 7, soreness_level: 4, energy_level: 8, notes: 'Felt okay' });
    expect(res.status).toBe(200);
    expect(res.body.sleep_hours).toBe(7);
    expect(res.body.soreness_level).toBe(4);
    expect(res.body.energy_level).toBe(8);
    expect(res.body.id).toBeDefined();
  });
});

// ─── Training log ─────────────────────────────────────────────────────────────

describe('GET /api/training-log', () => {
  test('returns combined exercise and recovery entries', async () => {
    const res = await request(app).get('/api/training-log');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const types = new Set(res.body.map(e => e.type));
    expect(types.has('exercise')).toBe(true);
    expect(types.has('recovery')).toBe(true);
  });

  test('each exercise entry has a recommendation string', async () => {
    const res = await request(app).get('/api/training-log');
    const exercises = res.body.filter(e => e.type === 'exercise');
    exercises.forEach(e => {
      expect(typeof e.recommendation).toBe('string');
      expect(e.recommendation.length).toBeGreaterThan(0);
    });
  });
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

describe('POST /api/sessions', () => {
  test('creates a session with the given title', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ title: 'Test Session' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test Session');
    expect(res.body.id).toBeDefined();
  });

  test('defaults title to "New Workout" when not provided', async () => {
    const res = await request(app).post('/api/sessions').send({});
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Workout');
  });
});

describe('GET /api/sessions', () => {
  test('returns a list of sessions', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Messages', () => {
  let sessionId;

  beforeAll(async () => {
    const res = await request(app).post('/api/sessions').send({ title: 'Msg Test' });
    sessionId = res.body.id;
  });

  test('POST /api/sessions/:id/messages saves a message', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/messages`)
      .send({ role: 'user', content: 'Test message', card: null });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('user');
    expect(res.body.content).toBe('Test message');
  });

  test('GET /api/sessions/:id/messages returns messages for the session', async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}/messages`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].role).toBe('user');
  });

  test('PUT /api/sessions/:id/title updates the session title', async () => {
    const res = await request(app)
      .put(`/api/sessions/${sessionId}/title`)
      .send({ title: 'Renamed Session' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Auth: unauthenticated requests ───────────────────────────────────────────

describe('Unauthenticated requests', () => {
  test('GET /api/sessions returns 401 with no userId', async () => {
    const res = await request(app).get('/api/sessions').set('x-test-user', '');
    expect(res.status).toBe(401);
  });

  test('POST /api/logs returns 401 with no userId', async () => {
    const res = await request(app)
      .post('/api/logs')
      .set('x-test-user', '')
      .send({ exercise: 'Deadlift', weight: 100, unit: 'kg', reps: 5 });
    expect(res.status).toBe(401);
  });
});

// ─── Auth: cross-user isolation ───────────────────────────────────────────────

describe('Cross-user isolation', () => {
  let userASessionId;

  beforeAll(async () => {
    await request(app).post('/api/logs').set('x-test-user', 'user-a')
      .send({ exercise: 'Overhead Press', weight: 40, unit: 'kg', reps: 6 });
    await request(app).post('/api/recovery').set('x-test-user', 'user-a')
      .send({ sleep_hours: 8, soreness_level: 2, energy_level: 9, notes: 'Great' });
    const res = await request(app).post('/api/sessions').set('x-test-user', 'user-a')
      .send({ title: 'User A Session' });
    userASessionId = res.body.id;
    await request(app).post(`/api/sessions/${userASessionId}/messages`).set('x-test-user', 'user-a')
      .send({ role: 'user', content: 'Hello from A', card: null });
  });

  test("user B's logs do not include user A's entries", async () => {
    const res = await request(app).get('/api/logs').set('x-test-user', 'user-b');
    expect(res.body.every((l) => l.exercise !== 'Overhead Press')).toBe(true);
  });

  test("user B's training log does not include user A's entries", async () => {
    const res = await request(app).get('/api/training-log').set('x-test-user', 'user-b');
    expect(res.body.every((e) => e.exercise !== 'Overhead Press' && e.notes !== 'Great')).toBe(true);
  });

  test("user B's session list does not include user A's session", async () => {
    const res = await request(app).get('/api/sessions').set('x-test-user', 'user-b');
    expect(res.body.some((s) => s.id === userASessionId)).toBe(false);
  });

  test("user B can't read user A's session messages (404)", async () => {
    const res = await request(app)
      .get(`/api/sessions/${userASessionId}/messages`)
      .set('x-test-user', 'user-b');
    expect(res.status).toBe(404);
  });

  test("user B can't post a message into user A's session (404)", async () => {
    const res = await request(app)
      .post(`/api/sessions/${userASessionId}/messages`)
      .set('x-test-user', 'user-b')
      .send({ role: 'user', content: 'Sneaky', card: null });
    expect(res.status).toBe(404);
  });

  test("user B can't rename user A's session (404, and title unchanged)", async () => {
    const res = await request(app)
      .put(`/api/sessions/${userASessionId}/title`)
      .set('x-test-user', 'user-b')
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(404);

    const check = await request(app)
      .get(`/api/sessions/${userASessionId}/messages`)
      .set('x-test-user', 'user-a');
    expect(check.status).toBe(200);
  });

  test("user B can't delete user A's session (404, session survives)", async () => {
    const res = await request(app)
      .delete(`/api/sessions/${userASessionId}`)
      .set('x-test-user', 'user-b');
    expect(res.status).toBe(404);

    const check = await request(app)
      .get(`/api/sessions/${userASessionId}/messages`)
      .set('x-test-user', 'user-a');
    expect(check.status).toBe(200);
  });

  test("DELETE /api/history for user B doesn't delete user A's logs/recovery", async () => {
    await request(app).delete('/api/history').set('x-test-user', 'user-b');
    const res = await request(app).get('/api/logs').set('x-test-user', 'user-a');
    expect(res.body.some((l) => l.exercise === 'Overhead Press')).toBe(true);
  });
});
