CREATE INDEX IF NOT EXISTS idx_snippets_name ON snippets(name);
CREATE INDEX IF NOT EXISTS idx_snippets_tab_name ON snippets(tab_name);
CREATE INDEX IF NOT EXISTS idx_snippets_code ON snippets(code);