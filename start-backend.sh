#!/bin/bash

echo "Starting Kids Camp Tracker Backend Server..."
cd backend
npm start &
BACKEND_PID=$!
echo "Backend server started with PID: $BACKEND_PID"
echo "Server running at http://localhost:3000"
echo ""
echo "To stop the server, run: kill $BACKEND_PID"