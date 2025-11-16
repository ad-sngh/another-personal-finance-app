#!/bin/bash

# Portfolio Tracker Startup Script

echo "🚀 Starting Portfolio Tracker..."

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed. Please install uv first:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    echo "   or visit: https://github.com/astral-sh/uv"
    exit 1
fi

# Parse command line arguments
PORT=""
HOST=""
DEBUG=""
RELOAD=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --help)
            echo "Portfolio Tracker Startup Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
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
            exit 0
            ;;
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
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--port PORT] [--host HOST] [--debug] [--reload] [--help]"
            echo "  or: $0 [-p PORT] [-h HOST] [-d] [-r]"
            echo "Run '$0 --help' for more information."
            exit 1
            ;;
    esac
done

# Sync dependencies (uv will create virtual environment if needed)
echo "Installing dependencies with uv..."
uv sync

# Initialize database if it doesn't exist
if [ ! -f "portfolio.db" ]; then
    echo "Initializing database..."
    uv run python add_sample_data.py
fi

# Build the command with arguments
CMD="uv run python main.py"
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

# Start the FastAPI application
echo "Starting FastAPI application..."
if [ -n "$PORT" ]; then
    echo "📊 Portfolio Tracker will be available at: http://localhost:$PORT"
else
    echo "📊 Portfolio Tracker will be available at: http://localhost:5001"
fi
echo "Press Ctrl+C to stop the server"
echo ""

eval $CMD
