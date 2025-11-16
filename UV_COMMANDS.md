# UV Commands Cheat Sheet

## Essential uv Commands for Portfolio Tracker

### Setup
```bash
# Install dependencies and create virtual environment
uv sync

# Install with development dependencies
uv sync --dev
```

### Running the Application
```bash
# Run the FastAPI app (default port 5001)
uv run python main.py

# Run with custom port
uv run python main.py --port 8080

# Run with custom host and port
uv run python main.py --host 127.0.0.1 --port 3000

# Run with auto-reload for development
uv run python main.py --reload

# Run with startup script
./start.sh

# Run with startup script and custom port
./start.sh --port 8080

# App will be available at http://localhost:5001 (or your custom port)

# Add sample data
uv run python add_sample_data.py
```

### Development
```bash
# Run code formatting
uv run black .

# Run linting
uv run flake8

# Run tests (when available)
uv run pytest
```

### Environment Management
```bash
# Check which Python is being used
uv run python --version

# Show installed packages
uv pip list

# Add a new dependency
uv add requests

# Add development dependency
uv add --dev pytest
```

### Benefits of uv

- **Fast**: Much faster than pip for dependency resolution and installation
- **Reliable**: Deterministic dependency resolution
- **Simple**: Single command for environment and dependency management
- **Modern**: Built with Rust for performance and reliability
- **Compatible**: Drop-in replacement for pip/venv workflows
- **Auto-reload**: Works seamlessly with FastAPI/uvicorn for development

### Migration from pip/venv

| Old Command | New uv Command |
|-------------|----------------|
| `python -m venv venv` | `uv sync` (automatic) |
| `source venv/bin/activate` | Not needed (uv handles it) |
| `pip install -r requirements.txt` | `uv sync` |
| `pip install package` | `uv add package` |
| `python script.py` | `uv run python script.py` |
