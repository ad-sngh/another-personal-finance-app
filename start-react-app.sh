#!/bin/bash

# Portfolio Tracker - React Frontend Startup Script
# This script starts both the FastAPI backend and React frontend

echo "🚀 Starting Portfolio Tracker (React Version)..."
echo ""

# Kill any existing processes on ports 3000 and 8081
echo "📋 Cleaning up existing processes..."
lsof -ti:3000,8081 | xargs kill -9 2>/dev/null || true
sleep 1

# Start FastAPI backend
echo "🔧 Starting FastAPI backend on port 8081..."
cd backend
./start.sh --port 8081 --reload &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 3

# Start React frontend
echo "⚛️  Starting React frontend on port 3000..."
cd frontend-react
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Portfolio Tracker is starting!"
echo ""
echo "📊 Backend API: http://localhost:8081"
echo "🎨 React Frontend: http://localhost:3000"
echo "📖 API Docs: http://localhost:8081/docs"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for user to stop
wait
