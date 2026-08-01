#!/usr/bin/env node

/**
 * Test script for MCP Server connection
 * This demonstrates how to test the MCP server once it's fully implemented
 */

const http = require('http')

const testConnection = () => {
  console.log('Testing MCP Server connection on localhost:3000...\n')

  // Test 1: Check if server is listening
  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/health',
    method: 'GET',
    timeout: 5000,
  }

  const req = http.request(options, res => {
    console.log('✅ Server is responding!')
    console.log(`Status Code: ${res.statusCode}`)
    console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`)

    let data = ''
    res.on('data', chunk => {
      data += chunk
    })

    res.on('end', () => {
      console.log('\nResponse Body:', data)
      testMCPTool()
    })
  })

  req.on('error', error => {
    console.log('❌ Server is not running or not accessible')
    console.log(`Error: ${error.message}`)
    console.log('\nTo start the MCP server:')
    console.log('1. Restart TweakPHP application (to load the new HTTP server code)')
    console.log('2. Go to Settings → MCP Server')
    console.log('3. Toggle "Enable MCP Server" to ON')
    console.log('4. Click "Save Settings"')
    console.log('5. Run this test again: node test-mcp-connection.js')
  })

  req.on('timeout', () => {
    console.log('❌ Connection timeout')
    req.destroy()
  })

  req.end()
}

const testMCPTool = () => {
  console.log('\n\nTesting MCP Tool: execute_php...\n')

  const postData = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'execute_php',
      arguments: {
        code: '<?php echo "Hello from TweakPHP MCP Server!";',
      },
    },
  })

  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/mcp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Content-Length': Buffer.byteLength(postData),
    },
    timeout: 5000,
  }

  const req = http.request(options, res => {
    console.log(`Status Code: ${res.statusCode}`)

    let data = ''
    res.on('data', chunk => {
      data += chunk
    })

    res.on('end', () => {
      try {
        const response = JSON.parse(data)
        console.log('\n✅ MCP Tool Response:')
        console.log(JSON.stringify(response, null, 2))
      } catch (e) {
        console.log('\nRaw Response:', data)
      }
    })
  })

  req.on('error', error => {
    console.log(`❌ Error: ${error.message}`)
  })

  req.on('timeout', () => {
    console.log('❌ Request timeout')
    req.destroy()
  })

  req.write(postData)
  req.end()
}

// Run the test
testConnection()
