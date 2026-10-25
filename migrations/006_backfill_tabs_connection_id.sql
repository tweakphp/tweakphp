-- Backfill tabs.connection_id from legacy inline connection references.
--
-- Docker configs were stored inline in the tabs.docker JSON column: create a
-- proper row in the connections table for each of them and link the tab.
INSERT INTO connections (id, type, name, config, is_active, created_at, updated_at)
SELECT
    'docker-' || id,
    'docker',
    COALESCE(NULLIF(JSON_EXTRACT(docker, '$.container_name'), ''), 'docker-' || id),
    JSON_REMOVE(docker, '$.type', '$.ssh'),
    0,
    COALESCE(created_at, datetime('now')),
    datetime('now')
FROM tabs
WHERE execution = 'docker'
  AND connection_id IS NULL
  AND docker IS NOT NULL
  AND JSON_VALID(docker)
  AND COALESCE(JSON_EXTRACT(docker, '$.container_name'), '') != ''
  AND id NOT IN (SELECT CAST(REPLACE(id, 'docker-', '') AS INTEGER) FROM connections WHERE id LIKE 'docker-%');

UPDATE tabs
SET connection_id = 'docker-' || id
WHERE execution = 'docker'
  AND connection_id IS NULL
  AND docker IS NOT NULL
  AND JSON_VALID(docker)
  AND COALESCE(JSON_EXTRACT(docker, '$.container_name'), '') != ''
  AND 'docker-' || id IN (SELECT id FROM connections);

-- SSH connections already live in the connections table: link the tab to them.
UPDATE tabs
SET connection_id = CAST(JSON_EXTRACT(ssh, '$.id') AS TEXT)
WHERE execution = 'ssh'
  AND connection_id IS NULL
  AND ssh IS NOT NULL
  AND JSON_VALID(ssh)
  AND JSON_EXTRACT(ssh, '$.id') IS NOT NULL
  AND CAST(JSON_EXTRACT(ssh, '$.id') AS TEXT) IN (SELECT id FROM connections WHERE type = 'ssh');

-- Kubectl connections already live in the connections table: link the tab.
UPDATE tabs
SET connection_id = CAST(JSON_EXTRACT(kubectl, '$.id') AS TEXT)
WHERE execution = 'kubectl'
  AND connection_id IS NULL
  AND kubectl IS NOT NULL
  AND JSON_VALID(kubectl)
  AND JSON_EXTRACT(kubectl, '$.id') IS NOT NULL
  AND CAST(JSON_EXTRACT(kubectl, '$.id') AS TEXT) IN (SELECT id FROM connections WHERE type = 'kubectl');

-- Vapor configs are stored per tab with id = tab id: link the tab.
UPDATE tabs
SET connection_id = CAST(id AS TEXT)
WHERE execution = 'vapor'
  AND connection_id IS NULL
  AND CAST(id AS TEXT) IN (SELECT id FROM connections WHERE type = 'vapor');

CREATE INDEX IF NOT EXISTS idx_tabs_connection_id ON tabs(connection_id);
