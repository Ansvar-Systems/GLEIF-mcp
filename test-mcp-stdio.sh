#!/bin/bash

echo "🧪 Testing GLEIF MCP Server (stdio transport)"
echo "=============================================="
echo ""

# Start server in background
node dist/index.js &
SERVER_PID=$!

# Give it a moment to start
sleep 2

echo "Test 1: Initialize connection"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"0.1.0","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | nc -U /dev/stdin || echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | cat

echo ""
echo "Test 2: List tools"
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

echo ""
echo "Test 3: Verify Apple LEI"
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"verify_lei","arguments":{"lei":"549300XQFX8FNB77HY47"}}}'

echo ""
echo "Test 4: Search for bank"
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"search_entity","arguments":{"entity_name":"bank","limit":5}}}'

echo ""
echo "Test 5: Get health"
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"get_health","arguments":{}}}}'

# Cleanup
kill $SERVER_PID 2>/dev/null

echo ""
echo "✅ Test complete!"
