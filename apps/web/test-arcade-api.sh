#!/bin/bash

echo "=== Arcade Session API Test ==="
echo ""

# Get viewer ID
echo "1. Getting viewer ID..."
VIEWER_ID=$(curl -s http://localhost:3000/api/viewer | jq -r '.viewerId')
echo "   Viewer ID: $VIEWER_ID"
echo ""

# Create user if doesn't exist
echo "2. Creating user in database..."
sqlite3 data/sqlite.db "INSERT OR IGNORE INTO users (id, guest_id, created_at) VALUES ('$VIEWER_ID', '$VIEWER_ID', datetime('now'));"
echo "   User created/exists"
echo ""

# Create arcade session for matching
echo "3. Creating arcade session for matching game..."
curl -s -X POST http://localhost:3000/api/arcade-session \
  -H 'Content-Type: application/json' \
  -d "{
    \"userId\": \"$VIEWER_ID\",
    \"gameName\": \"matching\",
    \"gameUrl\": \"/arcade/matching\",
    \"initialState\": {
      \"gamePhase\": \"playing\",
      \"cards\": [],
      \"gameCards\": [],
      \"flippedCards\": [],
      \"matchedPairs\": 0,
      \"totalPairs\": 6
    },
    \"activePlayers\": [1]
  }" | jq '.'
echo ""

# Get session
echo "4. Getting active session..."
curl -s "http://localhost:3000/api/arcade-session?userId=$VIEWER_ID" | jq '.'
echo ""

echo "=== What should happen now ==="
echo "1. Open http://localhost:3000/arcade/matching in your browser"
echo "2. The guard should NOT redirect (you're already on the active game)"
echo "3. Open http://localhost:3000/arcade/memory-quiz in a NEW TAB"
echo "4. The guard SHOULD redirect you back to /arcade/matching"
echo ""

echo "=== Current Issue ==="
echo "The guard is implemented but NOT integrated with the game."
echo "The game doesn't create sessions when it starts."
echo "You need to manually create the session (as shown above) to test the guard."
echo ""

echo "To clean up:"
echo "  curl -X DELETE \"http://localhost:3000/api/arcade-session?userId=$VIEWER_ID\""
