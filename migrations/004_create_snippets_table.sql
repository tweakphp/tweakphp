CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    title TEXT,
    code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snippets_updated_at ON snippets(updated_at);
