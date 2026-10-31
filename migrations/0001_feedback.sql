-- The feedback log of the site (the server keeps data/feedback.jsonl; the Worker keeps this table). Read it with:
--   npx wrangler d1 execute citypulse --remote --command "SELECT * FROM feedback ORDER BY id DESC LIMIT 50"
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  message TEXT NOT NULL,
  email TEXT,
  context TEXT
);
