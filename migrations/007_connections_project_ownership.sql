-- Connections become atomic to a project: every connection row is owned by
-- exactly one project (tab). Projects reference their active connection via
-- tabs.connection_id. Local execution stays implicit (no row).

ALTER TABLE connections ADD COLUMN tab_id INTEGER REFERENCES tabs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_connections_tab_id ON connections(tab_id);

-- Safety: drop dangling connection references before enforcing foreign keys
UPDATE tabs
SET connection_id = NULL
WHERE connection_id IS NOT NULL
  AND connection_id NOT IN (SELECT id FROM connections);

-- Vapor rows are per-project by design: their id IS the tab id
UPDATE connections
SET tab_id = CAST(id AS INTEGER)
WHERE type = 'vapor'
  AND tab_id IS NULL
  AND CAST(id AS INTEGER) IN (SELECT CAST(id AS INTEGER) FROM tabs);

-- Recover inline docker configs that never made it into the connections table
-- (tabs previously connected to docker and then switched back to local)
INSERT INTO connections (id, type, name, config, tab_id, is_active, created_at, updated_at)
SELECT
    'docker-' || id,
    'docker',
    COALESCE(NULLIF(JSON_EXTRACT(docker, '$.container_name'), ''), 'docker-' || id),
    JSON_REMOVE(docker, '$.type', '$.ssh'),
    CAST(id AS INTEGER),
    0,
    COALESCE(created_at, datetime('now')),
    datetime('now')
FROM tabs
WHERE docker IS NOT NULL
  AND JSON_VALID(docker)
  AND COALESCE(JSON_EXTRACT(docker, '$.container_name'), '') != ''
  AND connection_id IS NULL
  AND 'docker-' || id NOT IN (SELECT id FROM connections);

-- Assign ownership: the owner is the (lowest-id) tab referencing the connection
UPDATE connections
SET tab_id = (
    SELECT MIN(CAST(t.id AS INTEGER)) FROM tabs t WHERE t.connection_id = connections.id
)
WHERE tab_id IS NULL
  AND EXISTS (SELECT 1 FROM tabs t WHERE t.connection_id = connections.id);

-- Connections shared by multiple projects: duplicate the row for every
-- non-owner tab so each project owns its own copy
INSERT INTO connections (id, type, name, config, tab_id, is_active, created_at, updated_at)
SELECT
    'dup-' || CAST(t.id AS TEXT) || '-' || c.id,
    c.type,
    c.name,
    c.config,
    CAST(t.id AS INTEGER),
    0,
    c.created_at,
    datetime('now')
FROM tabs t
JOIN connections c ON c.id = t.connection_id
WHERE c.tab_id IS NOT NULL
  AND c.tab_id != CAST(t.id AS INTEGER)
  AND 'dup-' || CAST(t.id AS TEXT) || '-' || c.id NOT IN (SELECT id FROM connections);

UPDATE tabs
SET connection_id = 'dup-' || CAST(id AS TEXT) || '-' || connection_id
WHERE connection_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM connections c
    WHERE c.id = tabs.connection_id
      AND c.tab_id IS NOT NULL
      AND c.tab_id != CAST(tabs.id AS INTEGER)
  );
