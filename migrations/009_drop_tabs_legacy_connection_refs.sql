-- Legacy inline connection refs (tabs.docker/ssh/kubectl) are redundant:
-- tabs.connection_id is the single source of truth. Backfill the residual
-- cases skipped by 006 (docker configs without container_name, ids that were
-- missing from the connections table at the time), then drop the columns.

INSERT INTO connections (id, type, name, config, tab_id, created_at, updated_at)
SELECT
    'docker-' || id,
    'docker',
    COALESCE(
        NULLIF(JSON_EXTRACT(docker, '$.container_name'), ''),
        NULLIF(JSON_EXTRACT(docker, '$.container_id'), ''),
        'docker-' || id
    ),
    JSON_REMOVE(docker, '$.type', '$.ssh'),
    CAST(id AS INTEGER),
    COALESCE(created_at, datetime('now')),
    datetime('now')
FROM tabs
WHERE execution = 'docker'
  AND connection_id IS NULL
  AND docker IS NOT NULL
  AND JSON_VALID(docker)
  AND 'docker-' || id NOT IN (SELECT id FROM connections);

UPDATE tabs
SET connection_id = 'docker-' || id
WHERE execution = 'docker'
  AND connection_id IS NULL
  AND docker IS NOT NULL
  AND JSON_VALID(docker)
  AND 'docker-' || id IN (SELECT id FROM connections);

UPDATE tabs
SET connection_id = CAST(JSON_EXTRACT(ssh, '$.id') AS TEXT)
WHERE execution = 'ssh'
  AND connection_id IS NULL
  AND ssh IS NOT NULL
  AND JSON_VALID(ssh)
  AND CAST(JSON_EXTRACT(ssh, '$.id') AS TEXT) IN (SELECT id FROM connections WHERE type = 'ssh');

UPDATE tabs
SET connection_id = CAST(JSON_EXTRACT(kubectl, '$.id') AS TEXT)
WHERE execution = 'kubectl'
  AND connection_id IS NULL
  AND kubectl IS NOT NULL
  AND JSON_VALID(kubectl)
  AND CAST(JSON_EXTRACT(kubectl, '$.id') AS TEXT) IN (SELECT id FROM connections WHERE type = 'kubectl');

ALTER TABLE tabs DROP COLUMN docker;
ALTER TABLE tabs DROP COLUMN ssh;
ALTER TABLE tabs DROP COLUMN kubectl;
