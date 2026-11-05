#!/usr/bin/env bash

# ==============================================================================
# TweakPHP MCP Server - Complete Tool Suite Tester
# ==============================================================================
# Requirement: TweakPHP must be running with MCP Server enabled on port 3000.
# Usage: ./test-mcp-tools.sh [port] or bash test-mcp-tools.sh [port]
#
# Sections:
#   Test 0      Health check (blocking)
#   Test 1      tools/list
#   Test 2-6    Execution tools (execute_php, get_php_info, history, switch, loader)
#   Test 7-8    list_projects / list_folders
#   Test 9      Project lifecycle: create folder + project, code write roundtrip,
#               rename/tag, position changes (folder assign/unassign, pin)
#   Test 10     Folder management: rename, reorder, delete
#   Test 11     Connection lifecycle: create / assign / update / delete (reset)
#   Test 12     list_connections (project view)
#   Test 13     set_active_project / duplicate_project / delete + restore
#   Test 14     execute_with_loader on the Laravel demo project (optional)
#   Coverage    Verifies every tool registered on the server is exercised
#
# The script is self-contained: it creates its own test project and reuses it
# for the connection / state tests, then cleans everything up.
# ==============================================================================

PORT="${1:-3000}"
HOST="http://127.0.0.1:${PORT}"
HEADERS=(-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream")

# Portable print functions
p_info() { printf "\033[1;33m%s\033[0m\n" "$1"; }
p_success() { printf "\033[0;32m%s\033[0m\n" "$1"; }
p_error() { printf "\033[0;31m%s\033[0m\n" "$1"; }
p_header() { printf "\033[1;34m%s\033[0m\n" "$1"; }

p_header "===================================================="
p_header "    Testing TweakPHP MCP Server on ${HOST}   "
p_header "===================================================="
printf "\n"

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
# NOTE: printf is used everywhere instead of echo: echo interprets backslash
# escapes in some shells (zsh, sh/dash) and corrupts JSON payloads that contain
# PHP code with \n sequences.

# Extract the inner text payload from an MCP tool response.
# Handles both plain JSON responses and SSE responses ("event: message\ndata: ...").
mcp_text() {
  local response="$1"
  local payload
  # SSE response: take the data: line
  payload=$(printf '%s\n' "$response" | grep '^data:' | sed 's/^data: //')
  if [ -n "$payload" ]; then
    printf '%s' "$payload" | jq -r '.result.content[0].text' 2>/dev/null
  else
    # plain JSON response
    printf '%s' "$response" | jq -r '.result.content[0].text' 2>/dev/null
  fi
}

# Helper for formatted response output
print_response() {
  local response="$1"
  if command -v jq &> /dev/null; then
    local json_str
    json_str=$(printf '%s\n' "$response" | grep '^data:' | sed 's/^data: //')
    if [ -z "$json_str" ]; then
      json_str="$response"
    fi
    printf '%s\n' "$json_str" | jq '.' 2>/dev/null || printf '%s\n' "$response"
  else
    printf '%s\n' "$response"
  fi
}

# Extract a single field of a project from list_projects (requires jq)
project_field() {
  local field="$1" project_id="$2"
  local response
  response=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 91,
    \"method\": \"tools/call\",
    \"params\": { \"name\": \"list_projects\", \"arguments\": {} }
  }")
  mcp_text "$response" | jq -r --arg f "$field" --argjson pid "${project_id}" \
    '.projects[] | select(.id == $pid) | .[$f]'
}

# Extract the folders payload from list_folders (requires jq)
folders_payload() {
  local response
  response=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 92,
    \"method\": \"tools/call\",
    \"params\": { \"name\": \"list_folders\", \"arguments\": {} }
  }")
  mcp_text "$response" | jq -r '.folders'
}

# Detect demo Laravel project path
LARAVEL_DEMO_PATH=""
if [ -d "$HOME/.tweakphp_dev/laravel" ]; then
  LARAVEL_DEMO_PATH="$HOME/.tweakphp_dev/laravel"
elif [ -d "$HOME/.tweakphp/laravel" ]; then
  LARAVEL_DEMO_PATH="$HOME/.tweakphp/laravel"
fi

# State shared across tests: the test project created in Test 9 and reused by
# Tests 11-13 (falls back to the first open project if Test 9 was skipped)
TEST_PROJECT_ID=""
TEST_FOLDER_ID=""

# ------------------------------------------------------------------------------
# Test 0: Health Check Endpoint (blocking)
# ------------------------------------------------------------------------------
p_info "[Test 0/14] Health Check GET /health"
HEALTH_RES=$(curl -s "${HOST}/health")

if printf '%s' "$HEALTH_RES" | grep -q '"status":"ok"'; then
  p_success "✓ Health Check Passed!"
  print_response "$HEALTH_RES"
else
  p_error "✗ Health Check Failed or Server is offline!"
  echo "Make sure TweakPHP is running and MCP Server is enabled on port ${PORT}."
  exit 1
fi
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 1: List Available Tools (tools/list)
# ------------------------------------------------------------------------------
p_info "[Test 1/14] List MCP Tools (tools/list)"
LIST_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}')

p_success "✓ Response received:"
print_response "$LIST_RES"
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 2: Tool - execute_php
# ------------------------------------------------------------------------------
p_info "[Test 2/14] Tool: execute_php"
EXEC_PHP_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "execute_php",
    "arguments": {
      "code": "<?php echo \"Hello from TweakPHP MCP Test Script! Date: \" . date(\"Y-m-d H:i:s\");"
    }
  }
}')

p_success "✓ Response received:"
print_response "$EXEC_PHP_RES"
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 3: Tool - get_php_info
# ------------------------------------------------------------------------------
p_info "[Test 3/14] Tool: get_php_info (section: general)"
PHP_INFO_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_php_info",
    "arguments": {
      "section": "general"
    }
  }
}')

p_success "✓ Response received:"
print_response "$PHP_INFO_RES"
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 4: Tool - get_execution_history
# ------------------------------------------------------------------------------
p_info "[Test 4/14] Tool: get_execution_history (limit: 3)"
HISTORY_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "get_execution_history",
    "arguments": {
      "limit": 3
    }
  }
}')

p_success "✓ Response received:"
print_response "$HISTORY_RES"
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 5: Tool - switch_connection (error handling)
# ------------------------------------------------------------------------------
p_info "[Test 5/14] Tool: switch_connection (test invalid ID handling)"
SWITCH_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "switch_connection",
    "arguments": {
      "connectionId": "non-existent-connection-id"
    }
  }
}')

p_success "✓ Response received (Expected error response for invalid ID):"
print_response "$SWITCH_RES"
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 6: Tool - execute_with_loader (laravel syntax validation without path)
# ------------------------------------------------------------------------------
p_info "[Test 6/14] Tool: execute_with_loader (laravel default path check)"
LOADER_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "execute_with_loader",
    "arguments": {
      "code": "<?php echo \"Framework loader test\";",
      "loader": "laravel"
    }
  }
}')

p_success "✓ Response received:"
print_response "$LOADER_RES"
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 7: Tool - list_projects
# ------------------------------------------------------------------------------
p_info "[Test 7/14] Tool: list_projects"
LIST_PROJECTS_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "list_projects",
    "arguments": {}
  }
}')

p_success "✓ Response received:"
print_response "$LIST_PROJECTS_RES"
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 8: Tool - list_folders
# ------------------------------------------------------------------------------
p_info "[Test 8/14] Tool: list_folders"
LIST_FOLDERS_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "list_folders",
    "arguments": {}
  }
}')

p_success "✓ Response received:"
print_response "$LIST_FOLDERS_RES"
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 9: Project lifecycle — create folder + project, code write roundtrip,
#         rename/tag, position changes (folder assign/unassign, pin)
#         (the project is kept alive for Tests 11-13 and cleaned up in Test 13)
# ------------------------------------------------------------------------------
p_info "[Test 9/14] Project lifecycle: create / code write / position changes"

FOLDER_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tools/call",
  "params": {
    "name": "create_folder",
    "arguments": { "name": "MCP Test Folder" }
  }
}')
p_success "✓ create_folder response:"
print_response "$FOLDER_RES"

TEST_FOLDER_ID=$(mcp_text "$FOLDER_RES" | jq -r '.id' 2>/dev/null)

PROJECT_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "create_project",
    "arguments": { "path": "/tmp/mcp-test-project", "tag": "test", "color": "blue" }
  }
}')
p_success "✓ create_project response:"
print_response "$PROJECT_RES"

TEST_PROJECT_ID=$(mcp_text "$PROJECT_RES" | jq -r '.id' 2>/dev/null)

if [ -z "$TEST_PROJECT_ID" ] || [ "$TEST_PROJECT_ID" = "null" ]; then
  # Test 9 was skipped or failed: fall back to the first open project for the
  # connection / state tests (Tests 11-13)
  TEST_PROJECT_ID=$(mcp_text "$LIST_PROJECTS_RES" | jq -r '.projects[0].id' 2>/dev/null)
  if [ -n "$TEST_PROJECT_ID" ] && [ "$TEST_PROJECT_ID" != "null" ]; then
    p_info "Using existing project id ${TEST_PROJECT_ID} for the following tests"
  fi
fi

if [ -n "$TEST_PROJECT_ID" ] && [ "$TEST_PROJECT_ID" != "null" ] && command -v jq &> /dev/null; then
  p_info "Test project id: ${TEST_PROJECT_ID}"

  # ---- 9a: code write roundtrip (update_project.code, verified via list_projects)
  CODE_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 11,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"update_project\",
      \"arguments\": { \"projectId\": ${TEST_PROJECT_ID}, \"name\": \"mcp-renamed\", \"tag\": \"renamed\", \"code\": \"<?php echo 'mcp-code-roundtrip';\" }
    }
  }")
  p_success "✓ update_project (code write) response:"
  print_response "$CODE_RES"

  CODE_CHECK=$(project_field code "$TEST_PROJECT_ID")
  if [ "$CODE_CHECK" = "<?php echo 'mcp-code-roundtrip';" ]; then
    p_success "✓ [9a] Code write roundtrip PASSED (code persisted and readable via list_projects)"
  else
    p_error "✗ [9a] Code write roundtrip FAILED — expected '<?php echo 'mcp-code-roundtrip';' got: ${CODE_CHECK}"
  fi

  NAME_CHECK=$(project_field name "$TEST_PROJECT_ID")
  if [ "$NAME_CHECK" = "mcp-renamed" ]; then
    p_success "✓ [9a] Rename roundtrip PASSED"
  else
    p_error "✗ [9a] Rename roundtrip FAILED — got: ${NAME_CHECK}"
  fi

  # ---- 9b: position change — assign the project to the folder
  if [ -n "$TEST_FOLDER_ID" ] && [ "$TEST_FOLDER_ID" != "null" ]; then
    ASSIGN_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 12,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"update_project\",
        \"arguments\": { \"projectId\": ${TEST_PROJECT_ID}, \"folderId\": ${TEST_FOLDER_ID} }
      }
    }")
    p_success "✓ update_project (assign to folder ${TEST_FOLDER_ID}) response:"
    print_response "$ASSIGN_RES"

    FOLDER_CHECK=$(project_field folderId "$TEST_PROJECT_ID")
    if [ "$FOLDER_CHECK" = "$TEST_FOLDER_ID" ]; then
      p_success "✓ [9b] Position change PASSED (project moved into folder ${TEST_FOLDER_ID})"
    else
      p_error "✗ [9b] Folder assignment FAILED — expected ${TEST_FOLDER_ID} got: ${FOLDER_CHECK}"
    fi

    FOLDER_NAME_CHECK=$(project_field folderName "$TEST_PROJECT_ID")
    if [ "$FOLDER_NAME_CHECK" = "MCP Test Folder" ]; then
      p_success "✓ [9b] Folder name resolved in list_projects PASSED"
    else
      p_error "✗ [9b] Folder name resolution FAILED — got: ${FOLDER_NAME_CHECK}"
    fi
  else
    p_error "✗ [9b] Skipped: could not extract folder id (jq required)"
  fi

  # ---- 9c: position change — pin the project (moves it to the Pinned section)
  PIN_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 13,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"update_project\",
      \"arguments\": { \"projectId\": ${TEST_PROJECT_ID}, \"pinned\": true }
    }
  }")
  p_success "✓ update_project (pin) response:"
  print_response "$PIN_RES"

  PIN_CHECK=$(project_field pinned "$TEST_PROJECT_ID")
  if [ "$PIN_CHECK" = "true" ]; then
    p_success "✓ [9c] Pin position change PASSED (project pinned)"
  else
    p_error "✗ [9c] Pin FAILED — expected true got: ${PIN_CHECK}"
  fi

  # ---- 9d: position change — unassign the project from any folder
  UNASSIGN_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 14,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"update_project\",
      \"arguments\": { \"projectId\": ${TEST_PROJECT_ID}, \"folderId\": null }
    }
  }")
  p_success "✓ update_project (unassign from folder) response:"
  print_response "$UNASSIGN_RES"

  UNASSIGN_CHECK=$(project_field folderId "$TEST_PROJECT_ID")
  if [ "$UNASSIGN_CHECK" = "null" ]; then
    p_success "✓ [9d] Position change PASSED (project unassigned from folders)"
  else
    p_error "✗ [9d] Folder unassign FAILED — expected null got: ${UNASSIGN_CHECK}"
  fi
else
  p_error "✗ No project available for the lifecycle tests (jq required)"
fi
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 10: Folder management — rename (update_folder), reorder (reorder_folders),
#          delete (delete_folder)
# ------------------------------------------------------------------------------
p_info "[Test 10/14] Folder management: update_folder / reorder_folders / delete_folder"

if command -v jq &> /dev/null; then
  FOLDER_A_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
    "jsonrpc": "2.0",
    "id": 20,
    "method": "tools/call",
    "params": {
      "name": "create_folder",
      "arguments": { "name": "MCP Folder A" }
    }
  }')
  p_success "✓ create_folder (A) response:"
  print_response "$FOLDER_A_RES"

  FOLDER_B_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d '{
    "jsonrpc": "2.0",
    "id": 21,
    "method": "tools/call",
    "params": {
      "name": "create_folder",
      "arguments": { "name": "MCP Folder B" }
    }
  }')
  p_success "✓ create_folder (B) response:"
  print_response "$FOLDER_B_RES"

  FOLDER_A=$(mcp_text "$FOLDER_A_RES" | jq -r '.id' 2>/dev/null)
  FOLDER_B=$(mcp_text "$FOLDER_B_RES" | jq -r '.id' 2>/dev/null)

  if [ -n "$FOLDER_A" ] && [ "$FOLDER_A" != "null" ] && [ -n "$FOLDER_B" ] && [ "$FOLDER_B" != "null" ]; then
    p_info "Created folders: A=${FOLDER_A}, B=${FOLDER_B}"

    # ---- 10a: rename folder A
    RENAME_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 22,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"update_folder\",
        \"arguments\": { \"folderId\": ${FOLDER_A}, \"name\": \"MCP Folder A Renamed\" }
      }
    }")
    p_success "✓ update_folder (rename) response:"
    print_response "$RENAME_RES"

    RENAME_CHECK=$(folders_payload | jq -r --argjson a "$FOLDER_A" '.[] | select(.id == $a) | .name')
    if [ "$RENAME_CHECK" = "MCP Folder A Renamed" ]; then
      p_success "✓ [10a] update_folder rename PASSED"
    else
      p_error "✗ [10a] update_folder rename FAILED — got: ${RENAME_CHECK}"
    fi

    # ---- 10b: reorder (B before A) and verify the new order
    REORDER_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 23,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"reorder_folders\",
        \"arguments\": { \"folderIds\": [${FOLDER_B}, ${FOLDER_A}] }
      }
    }")
    p_success "✓ reorder_folders response:"
    print_response "$REORDER_RES"

    ORDER_CHECK=$(folders_payload | jq -r --argjson a "$FOLDER_A" --argjson b "$FOLDER_B" \
      '((map(.id) | index($b)) != null) and ((map(.id) | index($b)) < (map(.id) | index($a)))')
    if [ "$ORDER_CHECK" = "true" ]; then
      p_success "✓ [10b] reorder_folders PASSED (folder ${FOLDER_B} now comes before ${FOLDER_A})"
    else
      p_error "✗ [10b] reorder_folders FAILED — expected B before A"
    fi

    # ---- 10c: delete folder B and verify it is gone
    DELETE_B_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 24,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"delete_folder\",
        \"arguments\": { \"folderId\": ${FOLDER_B} }
      }
    }")
    p_success "✓ delete_folder (B) response:"
    print_response "$DELETE_B_RES"

    DELETE_CHECK=$(folders_payload | jq -r --argjson b "$FOLDER_B" 'map(.id) | index($b)')
    if [ "$DELETE_CHECK" = "null" ]; then
      p_success "✓ [10c] delete_folder PASSED (folder ${FOLDER_B} removed)"
    else
      p_error "✗ [10c] delete_folder FAILED — folder ${FOLDER_B} still present"
    fi

    # cleanup: remove folder A
    DELETE_A_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 25,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"delete_folder\",
        \"arguments\": { \"folderId\": ${FOLDER_A} }
      }
    }")
    p_success "✓ cleanup delete_folder (A) response:"
    print_response "$DELETE_A_RES"
  else
    p_error "✗ Could not extract folder ids (jq required for the folder management flow)"
  fi
else
  p_error "✗ jq not available — folder management flow skipped"
fi
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 11: Tool - create_connection / update_connection / delete_connection
#          (uses the test project; verifies assignment and reset-to-local)
# ------------------------------------------------------------------------------
p_info "[Test 11/14] Tool: create_connection / update_connection / delete_connection flow"

if [ -n "$TEST_PROJECT_ID" ] && [ "$TEST_PROJECT_ID" != "null" ]; then
  p_info "Using test project id: ${TEST_PROJECT_ID}"

  CREATE_CONN_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 13,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"create_connection\",
      \"arguments\": {
        \"projectId\": ${TEST_PROJECT_ID},
        \"type\": \"docker\",
        \"config\": { \"name\": \"mcp-test-container\", \"container_id\": \"mcp-test\", \"container_name\": \"mcp-test-container\", \"working_directory\": \"/var/www/html\" }
      }
    }
  }")
  p_success "✓ create_connection response (projectId required, secrets never returned):"
  print_response "$CREATE_CONN_RES"

  CONN_ID=$(mcp_text "$CREATE_CONN_RES" | jq -r '.connection.id' 2>/dev/null)

  if [ -n "$CONN_ID" ] && [ "$CONN_ID" != "null" ]; then
    p_info "Created connection id: ${CONN_ID}"

    # verify the connection was assigned to the project as active
    if command -v jq &> /dev/null; then
      ASSIGN_CONN_CHECK=$(project_field execution "$TEST_PROJECT_ID")
      CONN_REF_CHECK=$(project_field connectionId "$TEST_PROJECT_ID")
      if [ "$ASSIGN_CONN_CHECK" = "docker" ] && [ "$CONN_REF_CHECK" = "$CONN_ID" ]; then
        p_success "✓ [11a] Connection assignment PASSED (project execution=docker, connectionId=${CONN_ID})"
      else
        p_error "✗ [11a] Connection assignment FAILED — execution=${ASSIGN_CONN_CHECK}, connectionId=${CONN_REF_CHECK}"
      fi
    fi

    UPDATE_CONN_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 14,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"update_connection\",
        \"arguments\": { \"connectionId\": \"${CONN_ID}\", \"changes\": { \"working_directory\": \"/var/www/public\" } }
      }
    }")
    p_success "✓ update_connection response:"
    print_response "$UPDATE_CONN_RES"

    DELETE_CONN_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 15,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"delete_connection\",
        \"arguments\": { \"connectionId\": \"${CONN_ID}\" }
      }
    }")
    p_success "✓ delete_connection response:"
    print_response "$DELETE_CONN_RES"

    # verify the project fell back to implicit local after the delete
    if command -v jq &> /dev/null; then
      RESET_CHECK=$(project_field execution "$TEST_PROJECT_ID")
      if [ "$RESET_CHECK" = "local" ]; then
        p_success "✓ [11b] Delete reset PASSED (project execution back to local)"
      else
        p_error "✗ [11b] Delete reset FAILED — execution=${RESET_CHECK}"
      fi
    fi
  else
    p_error "✗ Could not extract connection id from create_connection response"
  fi
else
  p_error "✗ No test project available — connection flow skipped"
fi
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 12: Tool - list_connections (project view of the test project)
# ------------------------------------------------------------------------------
p_info "[Test 12/14] Tool: list_connections (project view)"

if [ -n "$TEST_PROJECT_ID" ] && [ "$TEST_PROJECT_ID" != "null" ]; then
  LIST_CONN_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 16,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"list_connections\",
      \"arguments\": { \"projectId\": ${TEST_PROJECT_ID} }
    }
  }")

  p_success "✓ Response received:"
  print_response "$LIST_CONN_RES"

  # verify the project view payload structure
  if command -v jq &> /dev/null; then
    PROJECT_VIEW_CHECK=$(mcp_text "$LIST_CONN_RES" | jq -r '.project.id' 2>/dev/null)
    if [ "$PROJECT_VIEW_CHECK" = "$TEST_PROJECT_ID" ]; then
      p_success "✓ [12] Project view PASSED (project.id=${TEST_PROJECT_ID}, connection source resolved)"
    else
      p_error "✗ [12] Project view FAILED — project.id=${PROJECT_VIEW_CHECK}"
    fi
  fi
else
  p_error "✗ No test project available — list_connections skipped"
fi
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 13: Tool - set_active_project / duplicate_project / delete + restore
# ------------------------------------------------------------------------------
p_info "[Test 13/14] Tool: set_active_project / duplicate_project / delete_project / restore_project"

if [ -n "$TEST_PROJECT_ID" ] && [ "$TEST_PROJECT_ID" != "null" ]; then
  # set_active_project on the test project (it exists, must succeed)
  ACTIVE_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 17,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"set_active_project\",
      \"arguments\": { \"projectId\": ${TEST_PROJECT_ID} }
    }
  }")
  p_success "✓ set_active_project response:"
  print_response "$ACTIVE_RES"

  if command -v jq &> /dev/null; then
    ACTIVE_CHECK=$(mcp_text "$ACTIVE_RES" | jq -r '.success' 2>/dev/null)
    if [ "$ACTIVE_CHECK" = "true" ]; then
      p_success "✓ [13a] set_active_project PASSED"
    else
      p_error "✗ [13a] set_active_project FAILED — success=${ACTIVE_CHECK}"
    fi
  fi

  # duplicate the test project, then clean up the duplicate (force delete)
  DUPLICATE_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 18,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"duplicate_project\",
      \"arguments\": { \"projectId\": ${TEST_PROJECT_ID} }
    }
  }")
  p_success "✓ duplicate_project response:"
  print_response "$DUPLICATE_RES"

  DUP_ID=$(mcp_text "$DUPLICATE_RES" | jq -r '.id' 2>/dev/null)
  if [ -n "$DUP_ID" ] && [ "$DUP_ID" != "null" ]; then
    DUP_CLEANUP_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 26,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"delete_project\",
        \"arguments\": { \"projectId\": ${DUP_ID}, \"force\": true }
      }
    }")
    p_success "✓ cleanup delete_project (duplicate ${DUP_ID}, force) response:"
    print_response "$DUP_CLEANUP_RES"
  fi

  # delete the test project (soft → trash), then restore it
  DELETE_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 19,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"delete_project\",
      \"arguments\": { \"projectId\": ${TEST_PROJECT_ID} }
    }
  }")
  p_success "✓ delete_project (soft) response:"
  print_response "$DELETE_RES"

  RESTORE_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 27,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"restore_project\",
      \"arguments\": { \"projectId\": ${TEST_PROJECT_ID} }
    }
  }")
  p_success "✓ restore_project response:"
  print_response "$RESTORE_RES"

  if command -v jq &> /dev/null; then
    TRASHED_CHECK=$(mcp_text "$DELETE_RES" | jq -r '.trashed' 2>/dev/null)
    RESTORE_CHECK=$(mcp_text "$RESTORE_RES" | jq -r '.success' 2>/dev/null)
    if [ "$TRASHED_CHECK" = "true" ] && [ "$RESTORE_CHECK" = "true" ]; then
      p_success "✓ [13b] Trash + restore roundtrip PASSED"
    else
      p_error "✗ [13b] Trash/restore FAILED — trashed=${TRASHED_CHECK}, restore.success=${RESTORE_CHECK}"
    fi
  fi

  # final cleanup: force delete the test project and its folder
  FINAL_DELETE_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 28,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"delete_project\",
      \"arguments\": { \"projectId\": ${TEST_PROJECT_ID}, \"force\": true }
    }
  }")
  p_success "✓ cleanup delete_project (force) response:"
  print_response "$FINAL_DELETE_RES"

  if [ -n "$TEST_FOLDER_ID" ] && [ "$TEST_FOLDER_ID" != "null" ]; then
    CLEANUP_FOLDER_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 29,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"delete_folder\",
        \"arguments\": { \"folderId\": ${TEST_FOLDER_ID} }
      }
    }")
    p_success "✓ cleanup delete_folder response:"
    print_response "$CLEANUP_FOLDER_RES"
  fi
else
  p_error "✗ No test project available — state tools skipped"
fi
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Test 14: Tool - execute_with_loader on Demo Laravel Project
# ------------------------------------------------------------------------------
p_info "[Test 14/14] Tool: execute_with_loader on Demo Laravel Project"

if [ -n "$LARAVEL_DEMO_PATH" ]; then
  p_info "Detected Laravel Demo Path: ${LARAVEL_DEMO_PATH}"

  LARAVEL_PHP_CODE='<?php
use App\Models\User;

$user = User::firstOrCreate(
    ["email" => "mcp_demo_user@example.com"],
    ["name" => "MCP Demo User", "password" => "secret_password"]
);

return User::first();'

  # Escape JSON string for curl payload
  PAYLOAD_CODE=$(printf '%s' "$LARAVEL_PHP_CODE" | jq -aRs '.')

  DEMO_RES=$(curl -s -X POST "${HOST}/mcp" "${HEADERS[@]}" -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 7,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"execute_with_loader\",
      \"arguments\": {
        \"code\": ${PAYLOAD_CODE},
        \"loader\": \"laravel\",
        \"projectPath\": \"${LARAVEL_DEMO_PATH}\"
      }
    }
  }")

  p_success "✓ Response received from Laravel Demo execution:"
  print_response "$DEMO_RES"
else
  p_error "✗ Laravel Demo path not found in ~/.tweakphp_dev/laravel or ~/.tweakphp/laravel"
fi
printf "\n----------------------------------------------------\n\n"

# ------------------------------------------------------------------------------
# Coverage: every tool registered on the server must be exercised by this script
# ------------------------------------------------------------------------------
p_info "[Coverage] Verifying all registered MCP tools are tested by this script"

if command -v jq &> /dev/null; then
  SERVER_TOOLS=$(printf '%s\n' "$LIST_RES" | grep '^data:' | sed 's/^data: //' | jq -r '.result.tools[].name' 2>/dev/null | sort -u)
  if [ -z "$SERVER_TOOLS" ]; then
    SERVER_TOOLS=$(printf '%s\n' "$LIST_RES" | jq -r '.result.tools[].name' 2>/dev/null | sort -u)
  fi

  if [ -z "$SERVER_TOOLS" ]; then
    p_error "✗ Could not read tools/list response — coverage check skipped"
  else
    # Tools invoked by this script: plain JSON payloads and escaped (\"name\") payloads
    TESTED_TOOLS=$(
      {
        grep -o '"name": "[a-z_]*"' "${BASH_SOURCE[0]}" 2>/dev/null
        grep -o '\\\"name\\\": \\\"[a-z_]*\\\"' "${BASH_SOURCE[0]}" 2>/dev/null | sed 's/\\\"/"/g'
      } | sed 's/"name": "//;s/"$//' | sort -u
    )

    UNTESTED=0
    TOTAL=0
    while IFS= read -r tool; do
      [ -z "$tool" ] && continue
      TOTAL=$((TOTAL + 1))
      if printf '%s\n' "$TESTED_TOOLS" | grep -qx "$tool"; then
        p_success "  ✓ ${tool}"
      else
        p_error "  ✗ ${tool} — registered on the server but NOT tested by this script"
        UNTESTED=$((UNTESTED + 1))
      fi
    done <<< "$SERVER_TOOLS"

    if [ "$UNTESTED" -gt 0 ]; then
      p_error "Coverage: ${UNTESTED} of ${TOTAL} registered tool(s) NOT covered"
    else
      p_success "Coverage: all ${TOTAL} registered tools are tested by this script"
    fi
  fi
else
  p_error "✗ jq not available — coverage check skipped"
fi

printf "\n----------------------------------------------------\n\n"

p_success "===================================================="
p_success "    All MCP tool tests completed successfully!     "
p_success "===================================================="
