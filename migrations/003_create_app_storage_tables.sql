CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loaders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tabs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'code',
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    path TEXT DEFAULT NULL,
    loader TEXT DEFAULT NULL,
    execution TEXT NOT NULL DEFAULT 'local',
    connection_id TEXT,
    result TEXT NOT NULL DEFAULT '[]',
    queries TEXT NOT NULL DEFAULT '[]',
    pane TEXT NOT NULL DEFAULT '{"code":50,"result":50}',
    info TEXT NOT NULL DEFAULT '{"name":"","php_version":"","version":""}',
    docker TEXT DEFAULT NULL,
    ssh TEXT DEFAULT NULL,
    kubectl TEXT DEFAULT NULL,
    active INTEGER DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT DEFAULT NULL,
    FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings_kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_connections_type ON connections(type);
CREATE INDEX IF NOT EXISTS idx_tabs_position ON tabs(position);
CREATE INDEX IF NOT EXISTS idx_tabs_deleted_at ON tabs(deleted_at);
