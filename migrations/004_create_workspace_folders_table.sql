CREATE TABLE IF NOT EXISTS workspace_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_folders_position ON workspace_folders(position);

ALTER TABLE tabs ADD COLUMN folder_id INTEGER DEFAULT NULL REFERENCES workspace_folders(id) ON DELETE SET NULL;
ALTER TABLE tabs ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tabs_folder_id ON tabs(folder_id);
