CREATE TABLE IF NOT EXISTS execution_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    output TEXT,
    error TEXT,
    exit_code INTEGER NOT NULL DEFAULT 0,
    connection_type TEXT NOT NULL,
    connection_name TEXT NOT NULL,
    duration INTEGER NOT NULL,
    loader TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_history_created_at ON execution_history(created_at);
CREATE INDEX IF NOT EXISTS idx_execution_history_connection_type ON execution_history(connection_type);
CREATE INDEX IF NOT EXISTS idx_execution_history_exit_code ON execution_history(exit_code);
