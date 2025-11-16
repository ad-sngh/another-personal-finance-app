# Portfolio Tracker Backend

FastAPI backend for managing investment holdings with complete versioning system.

## Features

- **CRUD Operations**: Create, read, update, delete holdings
- **Versioning System**: Every edit creates a new record, preserving full history
- **Soft Delete**: Holdings are marked as deleted but preserved in database
- **Price Fetching**: Real-time price data from Yahoo Finance
- **RESTful API**: Clean JSON API with proper error handling
- **Data Validation**: Pydantic models for request/response validation

## Tech Stack

- **FastAPI**: Modern, fast web framework for building APIs
- **Uvicorn**: ASGI server for FastAPI
- **SQLite**: Lightweight database for data storage
- **Pydantic**: Data validation using Python type annotations
- **yfinance**: Yahoo Finance API for price data
- **Jinja2**: Template engine for serving HTML

## Database Schema

```sql
CREATE TABLE holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    holding_id TEXT NOT NULL,  -- UUID to group versions of same holding
    account_type TEXT NOT NULL,
    account TEXT NOT NULL,
    ticker TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    lookup TEXT,
    shares REAL NOT NULL,
    cost REAL NOT NULL,
    current_price REAL NOT NULL,
    contribution REAL NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE  -- Soft delete support
);
```

## API Endpoints

### Holdings
- `GET /api/holdings` - Get all holdings (latest versions only)
- `POST /api/holdings` - Create new holding
- `PUT /api/holdings/{id}` - Update holding (creates new version)
- `DELETE /api/holdings/{id}` - Soft delete holding
- `GET /api/holdings/{id}/history` - Get version history of holding

### Price Fetching
- `POST /api/fetch-price` - Fetch current price for ticker

### Web Pages
- `GET /` - Main portfolio view
- `GET /edit` - Add new holding form
- `GET /edit/{id}` - Edit existing holding form

## Installation & Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   # or with uv
   uv sync
   ```

2. **Initialize database**:
   ```bash
   python -c "from database import init_db; init_db()"
   ```

3. **Run the server**:
   ```bash
   python main.py --port 5001
   # or with uv
   uv run python main.py --port 5001
   ```

## Development

### Auto-reload
```bash
python main.py --reload --port 5001
```

### Adding Sample Data
```bash
python add_sample_data.py
```

### Adding a Single Holding
```bash
python add_holding.py --interactive
```

## Versioning System

The backend implements a sophisticated versioning system:

1. **Create**: New holding gets a unique `holding_id` UUID
2. **Update**: Creates new record with same `holding_id` but new data
3. **Read**: Only returns latest version of each holding (not deleted)
4. **Delete**: Soft deletes all versions with same `holding_id`
5. **History**: Full version history available via API

This ensures:
- **Complete audit trail**: Every change is preserved
- **No data loss**: Original data always accessible
- **Clean UI**: Frontend only shows current data
- **Rollback capability**: Can restore any previous version

## Configuration

The application can be configured via command-line arguments:

```bash
python main.py --help
```

- `--port PORT`: Set custom port (default: 5001)
- `--host HOST`: Set custom host (default: 0.0.0.0)
- `--reload`: Enable auto-reload for development
- `--debug`: Enable debug mode

## Environment Variables

- `DATABASE_URL`: SQLite database path (default: portfolio.db)
- `YFINANCE_TIMEOUT`: Timeout for Yahoo Finance requests (default: 10s)

## License

MIT License
