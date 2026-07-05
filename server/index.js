const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { clerkMiddleware, getAuth } = require('@clerk/express');

const app = express();
app.use(cors());
app.use(express.json());
app.use(clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
  authorizedParties: (process.env.CLERK_AUTHORIZED_PARTIES || '').split(',').filter(Boolean),
}));

function requireUserId(req, res, next) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = userId;
  next();
}

// Initialize DB
const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Adds a user_id column to a table if it doesn't already have one (safe on existing deployed DBs).
function ensureUserIdColumn(table, cb) {
  db.all(`PRAGMA table_info(${table})`, [], (err, cols) => {
    if (err) return cb(err);
    if (cols.some((c) => c.name === 'user_id')) return cb();
    db.run(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`, cb);
  });
}

const ready = new Promise((resolve, reject) => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise TEXT NOT NULL,
      weight REAL NOT NULL,
      unit TEXT NOT NULL,
      reps INTEGER NOT NULL,
      date TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS recovery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sleep_hours REAL,
      soreness_level INTEGER,
      energy_level INTEGER,
      notes TEXT,
      date TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT,
      card_data TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )`, (err) => {
      if (err) return reject(err);

      const tables = ['logs', 'recovery', 'sessions', 'messages'];
      let remaining = tables.length;
      tables.forEach((table) => {
        ensureUserIdColumn(table, (migrateErr) => {
          if (migrateErr) return reject(migrateErr);
          remaining -= 1;
          if (remaining === 0) {
            db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id)`, resolve);
          }
        });
      });
    });
  });
});

const getExerciseRecommendation = (log, previousLog) => {
  if (!previousLog) {
    return `Baseline captured. Repeat ${log.weight}${log.unit} and add reps before increasing load.`;
  }

  const currentVolume = Number(log.weight) * Number(log.reps);
  const previousVolume = Number(previousLog.weight) * Number(previousLog.reps);
  const volumeDelta = currentVolume - previousVolume;

  if (Number(log.weight) > Number(previousLog.weight) && Number(log.reps) >= Number(previousLog.reps) - 1) {
    return `Load progressed from ${previousLog.weight}${previousLog.unit}. Hold this weight until reps climb again.`;
  }

  if (volumeDelta > 0) {
    return `Volume is up ${Math.round(volumeDelta)}${log.unit}. Next target: add 1 rep at ${log.weight}${log.unit}.`;
  }

  if (Number(log.reps) >= 8) {
    return `Top-end reps are there. Consider a small load increase next time if recovery is solid.`;
  }

  return `Maintain ${log.weight}${log.unit} and aim for cleaner reps before increasing load.`;
};

const getRecoveryRecommendation = (entry) => {
  const sleep = Number(entry.sleep_hours);
  const soreness = Number(entry.soreness_level);
  const energy = Number(entry.energy_level);

  if (sleep && sleep < 6) {
    return 'Recovery is low. Keep intensity moderate and avoid max-effort sets today.';
  }

  if (soreness && soreness >= 7) {
    return 'High soreness logged. Reduce volume or bias technique work until it settles.';
  }

  if (energy && energy <= 4) {
    return 'Energy is low. Maintain load, stop shy of failure, and reassess after warmups.';
  }

  return 'Recovery looks usable. Progress only if warmups move well.';
};

// API Routes: Workout Logs
app.post('/api/logs', requireUserId, (req, res) => {
  const { exercise, weight, unit, reps } = req.body;
  const date = new Date().toLocaleDateString();

  db.run(
    `INSERT INTO logs (exercise, weight, unit, reps, date, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [exercise, weight, unit, reps, date, req.userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, exercise, weight, unit, reps, date });
    }
  );
});

app.get('/api/logs', requireUserId, (req, res) => {
  const { exercise } = req.query;
  let query = `SELECT * FROM logs WHERE user_id = ?`;
  let params = [req.userId];

  if (exercise) {
    query += ` AND exercise LIKE ?`;
    params.push(`%${exercise}%`);
  }
  query += ` ORDER BY timestamp DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/training-log', requireUserId, (req, res) => {
  db.all(`SELECT * FROM logs WHERE user_id = ? ORDER BY timestamp ASC, id ASC`, [req.userId], (logsErr, logs) => {
    if (logsErr) return res.status(500).json({ error: logsErr.message });

    db.all(`SELECT * FROM recovery WHERE user_id = ? ORDER BY timestamp ASC, id ASC`, [req.userId], (recoveryErr, recoveryRows) => {
      if (recoveryErr) return res.status(500).json({ error: recoveryErr.message });

      const previousByExercise = new Map();
      const exerciseEntries = logs.map((log) => {
        const key = log.exercise.toLowerCase();
        const previousLog = previousByExercise.get(key);
        previousByExercise.set(key, log);

        return {
          ...log,
          type: 'exercise',
          recommendation: getExerciseRecommendation(log, previousLog)
        };
      });

      const recoveryEntries = recoveryRows.map((entry) => ({
        ...entry,
        type: 'recovery',
        recommendation: getRecoveryRecommendation(entry)
      }));

      const combined = [...exerciseEntries, ...recoveryEntries].sort((a, b) => {
        const dateDelta = new Date(b.timestamp) - new Date(a.timestamp);
        return dateDelta || b.id - a.id;
      });

      res.json(combined);
    });
  });
});

app.post('/api/recovery', requireUserId, (req, res) => {
  const { sleep_hours, soreness_level, energy_level, notes } = req.body;
  const date = new Date().toLocaleDateString();

  db.run(
    `INSERT INTO recovery (sleep_hours, soreness_level, energy_level, notes, date, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [sleep_hours, soreness_level, energy_level, notes, date, req.userId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, sleep_hours, soreness_level, energy_level, notes, date });
    }
  );
});

// API Routes: Chat Sessions
app.get('/api/sessions', requireUserId, (req, res) => {
  db.all(`SELECT * FROM sessions WHERE user_id = ? ORDER BY timestamp DESC`, [req.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/sessions', requireUserId, (req, res) => {
  const { title } = req.body;
  db.run(`INSERT INTO sessions (title, user_id) VALUES (?, ?)`, [title || 'New Workout', req.userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, title: title || 'New Workout' });
  });
});

app.get('/api/sessions/:id/messages', requireUserId, (req, res) => {
  const sessionId = req.params.id;
  db.get(`SELECT id FROM sessions WHERE id = ? AND user_id = ?`, [sessionId, req.userId], (ownErr, session) => {
    if (ownErr) return res.status(500).json({ error: ownErr.message });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    db.all(`SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC`, [sessionId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows.map(r => ({
        id: r.id,
        role: r.role,
        content: r.content,
        card: r.card_data ? JSON.parse(r.card_data) : null
      })));
    });
  });
});

app.post('/api/sessions/:id/messages', requireUserId, (req, res) => {
  const sessionId = req.params.id;
  const { role, content, card } = req.body;
  const cardStr = card ? JSON.stringify(card) : null;

  db.get(`SELECT id FROM sessions WHERE id = ? AND user_id = ?`, [sessionId, req.userId], (ownErr, session) => {
    if (ownErr) return res.status(500).json({ error: ownErr.message });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    db.run(`INSERT INTO messages (session_id, role, content, card_data, user_id) VALUES (?, ?, ?, ?, ?)`,
      [sessionId, role, content, cardStr, req.userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, session_id: sessionId, role, content, card });
    });
  });
});

app.delete('/api/history', requireUserId, (req, res) => {
  db.run(`DELETE FROM logs WHERE user_id = ?`, [req.userId], (logsErr) => {
    if (logsErr) return res.status(500).json({ error: logsErr.message });
    db.run(`DELETE FROM recovery WHERE user_id = ?`, [req.userId], (recErr) => {
      if (recErr) return res.status(500).json({ error: recErr.message });
      res.json({ success: true });
    });
  });
});

app.delete('/api/sessions/:id', requireUserId, (req, res) => {
  const sessionId = req.params.id;
  db.get(`SELECT id FROM sessions WHERE id = ? AND user_id = ?`, [sessionId, req.userId], (ownErr, session) => {
    if (ownErr) return res.status(500).json({ error: ownErr.message });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    db.run(`DELETE FROM messages WHERE session_id = ?`, [sessionId], (msgErr) => {
      if (msgErr) return res.status(500).json({ error: msgErr.message });
      db.run(`DELETE FROM sessions WHERE id = ? AND user_id = ?`, [sessionId, req.userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Session not found' });
        res.json({ success: true });
      });
    });
  });
});

app.put('/api/sessions/:id/title', requireUserId, (req, res) => {
  const sessionId = req.params.id;
  const { title } = req.body;
  db.run(`UPDATE sessions SET title = ? WHERE id = ? AND user_id = ?`, [title, sessionId, req.userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true });
  });
});

// Serve React build in production
const distPath = path.resolve(__dirname, '../dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

module.exports = { app, ready, getExerciseRecommendation, getRecoveryRecommendation };

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
