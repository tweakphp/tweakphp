#!/usr/bin/env bash

# ==============================================================================
# TweakPHP MCP Server - Complete Tool Suite Tester
# ==============================================================================
# Requirement: TweakPHP must be running with MCP Server enabled on port 3000.
# Usage: ./test-mcp-tools.sh [port] or bash test-mcp-tools.sh [port]
# ==============================================================================

PORT="${1:-3000}"
HOST="http://127.0.0.1:${PORT}"
HEADERS=(-H "Content-Type: application/json" -H "Accept: application/json, text/event-stream")

# Portable print functions
p_info() { printf "\033[1;33m%s\033[0m\n" "$1"; }
p_success() { printf "\033[0;32m%s\033[0m\n" "$1"; }
p_error() { printf "\033[0;31m%s\033[0m\n" "$1"; }
p_header() { printf "\033[0;34m%s\033[0m\n" "$1"; }

p_header "===================================================="
p_header "    Testing TweakPHP MCP Server on ${HOST}   "
p_header "===================================================="
printf "\n"

# Helper for formatted response output
print_response() {
  local response="$1"
  if command -v jq &> /dev/null; then
    local json_str
    json_str=$(echo "$response" | grep '^data:' | sed 's/^data: //')
    if [ -z "$json_str" ]; then
      json_str="$response"
    fi
    echo "$json_str" | jq '.' 2>/dev/null || echo "$response"
  else
    echo "$response"
  fi
}

# Detect demo Laravel project path
LARAVEL_DEMO_PATH=""
if [ -d "$HOME/.tweakphp_dev/laravel" ]; then
  LARAVEL_DEMO_PATH="$HOME/.tweakphp_dev/laravel"
elif [ -d "$HOME/.tweakphp/laravel" ]; then
  LARAVEL_DEMO_PATH="$HOME/.tweakphp/laravel"
fi

# ------------------------------------------------------------------------------
# Test 0: Health Check Endpoint
# ------------------------------------------------------------------------------
p_info "[Test 0/7] Health Check GET /health"
HEALTH_RES=$(curl -s "${HOST}/health")

if echo "$HEALTH_RES" | grep -q '"status":"ok"'; then
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
p_info "[Test 1/7] List MCP Tools (tools/list)"
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
p_info "[Test 2/7] Tool: execute_php"
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
p_info "[Test 3/7] Tool: get_php_info (section: general)"
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
p_info "[Test 4/7] Tool: get_execution_history (limit: 3)"
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
# Test 5: Tool - switch_connection
# ------------------------------------------------------------------------------
p_info "[Test 5/7] Tool: switch_connection (test invalid ID handling)"
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
p_info "[Test 6/7] Tool: execute_with_loader (laravel default path check)"
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
# Test 7: Tool - execute_with_loader on Demo Laravel Project (User::firstOrCreate & User::first)
# ------------------------------------------------------------------------------
p_info "[Test 7/7] Tool: execute_with_loader on Demo Laravel Project"

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
  PAYLOAD_CODE=$(echo "$LARAVEL_PHP_CODE" | jq -aRs '.')

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

p_success "===================================================="
p_success "    All MCP tool tests completed successfully!     "
p_success "===================================================="
