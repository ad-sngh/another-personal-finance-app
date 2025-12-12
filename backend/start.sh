#!/bin/bash

# Portfolio Tracker Backend Startup Script

set -e

# Default values
PORT=""
HOST=""
DEBUG=""
RELOAD=""

# Function to show help
show_help() {
    echo "Portfolio Tracker Backend Startup Script"
    echo ""
    echo "Usage: $0 [--port PORT] [--host HOST] [--debug] [--reload] [--help]"
    echo "  or: $0 [-p PORT] [-h HOST] [-d] [-r]"
    echo ""
    echo "Options:"
    echo "  --port PORT, -p PORT    Set custom port (default: 5001)"
    echo "  --host HOST, -h HOST    Set custom host (default: 0.0.0.0)"
    echo "  --debug, -d            Enable debug mode"
    echo "  --reload, -r            Enable auto-reload for development"
    echo "  --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                      # Run with defaults"
    echo "  $0 --port 8080         # Run on port 8080"
    echo "  $0 -p 3000 -d          # Run on port 3000 with debug"
    echo "  $0 --host 127.0.0.1    # Run on localhost only"
    echo "  $0 --reload            # Run with auto-reload"
    echo ""
    echo "Dependencies:"
    echo "  - Python 3.8+"
    echo "  - pip or uv package manager"
    echo "  - See requirements.txt for package list"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --debug)
            DEBUG="--debug"
            shift
            ;;
        --reload)
            RELOAD="--reload"
            shift
            ;;
        -p)
            PORT="$2"
            shift 2
            ;;
        -h)
            HOST="$2"
            shift 2
            ;;
        -d)
            DEBUG="--debug"
            shift
            ;;
        -r)
            RELOAD="--reload"
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--port PORT] [--host HOST] [--debug] [--reload] [--help]"
            echo "Run '$0 --help' for more information."
            exit 1
            ;;
    esac
done

# Check if Python is available
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "Error: Python is not installed or not in PATH"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

# Determine Python command
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

# Check if uv is available (preferred)
UV_CMD=""
if command -v uv &> /dev/null; then
    UV_CMD="uv run"
fi

# Check if requirements are installed
if [ -n "$UV_CMD" ]; then
    echo "Using uv package manager..."
    if [ ! -f "uv.lock" ]; then
        echo "Installing dependencies with uv..."
        $UV_CMD pip install -r requirements.txt
    fi
else
    echo "Using pip package manager..."
    if ! $PYTHON_CMD -c "import fastapi" &> /dev/null; then
        echo "Installing dependencies..."
        $PYTHON_CMD -m pip install -r requirements.txt
    fi
fi

# Build the command
if [ -n "$UV_CMD" ]; then
    CMD="$UV_CMD $PYTHON_CMD main.py"
else
    CMD="$PYTHON_CMD main.py"
fi

if [ -n "$PORT" ]; then
    CMD="$CMD --port $PORT"
fi
if [ -n "$HOST" ]; then
    CMD="$CMD --host $HOST"
fi
if [ -n "$DEBUG" ]; then
    CMD="$CMD $DEBUG"
fi
if [ -n "$RELOAD" ]; then
    CMD="$CMD $RELOAD"
fi

# Initialize database if it doesn't exist
if [ ! -f "${PORTFOLIO_DB_PATH:-/Users/adityabhushansingh/Documents/Personal/learn/portfolio.db}" ]; then
    echo "Initializing database..."
    if [ -n "$UV_CMD" ]; then
        $UV_CMD $PYTHON_CMD -c "from dotenv import load_dotenv; load_dotenv(); from database import init_db; init_db()"
    else
        $PYTHON_CMD -c "from dotenv import load_dotenv; load_dotenv(); from database import init_db; init_db()"
    fi
fi

# Start the FastAPI application
echo "Starting Portfolio Tracker Backend..."
if [ -n "$PORT" ]; then
    echo "🚀 Backend will be available at: http://localhost:$PORT"
else
    echo "🚀 Backend will be available at: http://localhost:5001"
fi
echo "📊 API Documentation: http://localhost:${PORT:-5001}/docs"
echo "Press Ctrl+C to stop the server"
echo ""

# Execute the command
exec $CMD
