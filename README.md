# Portfolio Tracker

A modern, full-stack portfolio tracking application with sophisticated versioning and a beautiful UI.

## Overview

Portfolio Tracker is a comprehensive investment portfolio management system that allows you to:
- Track all your investment holdings across multiple accounts
- Monitor real-time portfolio value and performance
- Add, edit, and delete holdings with a modern UI
- Maintain complete version history of all changes
- Fetch current prices from Yahoo Finance
- View detailed portfolio analytics

## Architecture

The application is organized into separate frontend and backend directories:

```
finance/
├── backend/                 # FastAPI backend with AI insights
│   ├── main.py             # Main FastAPI application
│   ├── database.py         # Database operations and versioning
│   ├── pyproject.toml      # Python dependencies (UV-managed)
│   ├── uv.lock            # Reproducible build lockfile
│   ├── agent_*.py         # AI agents for insights
│   └── README.md          # Backend documentation
├── frontend-react/         # Modern React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── api/          # API client
│   │   └── utils/        # Utility functions
│   ├── package.json       # Node.js dependencies
│   ├── package-lock.json  # Reproducible build lockfile
│   └── README.md          # Frontend documentation
├── README.md              # This file
└── .gitignore             # Git ignore rules
```

## Quick Start

### Prerequisites
- Python 3.9+ (for backend)
- UV (recommended Python package manager) - Install with: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Node.js 16+ (for frontend development)
- Ollama (optional, for AI insights) - Install from https://ollama.ai

### 1. Backend Setup with UV

```bash
cd backend
# Install dependencies and create virtual environment
uv sync

# Start the backend server
uv run python main.py
```

The backend will be available at:
- **API**: http://localhost:8000
- **Documentation**: http://localhost:8000/docs
- **Portfolio View**: http://localhost:8000

### 2. Frontend Setup (React)

```bash
cd frontend-react
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at http://localhost:5173

### 3. AI Insights Setup (Optional)

```bash
# Pull the AI model for insights
ollama pull gemma3:4b-it-qat

# Start Ollama server
ollama serve
```

### 4. Add Sample Data

```bash
cd backend
uv run python add_sample_data.py
```

## Key Features

### Modern UI
- **Geist Sans Font**: Clean, modern typography
- **Material Design**: Inspired by Google's design principles
- **Responsive Layout**: Works on desktop and mobile
- **Smooth Animations**: Hover effects and transitions
- **Real-time Calculations**: Live portfolio updates

### Portfolio Management
- **Multi-Account Support**: RRSP, TFSA, Cash, Crypto, Non-registered
- **Categorization**: ETFs, Stocks, Crypto, Cash
- **Search & Filter**: Find holdings quickly
- **Performance Metrics**: Gain/loss, percentages, portfolio allocation

### Versioning System
- **Complete Audit Trail**: Every change is preserved
- **Soft Delete**: Holdings are marked as deleted but never lost
- **Version History**: Access any previous version via API
- **Clean UI**: Only latest versions shown to users

### API Features
- **RESTful Design**: Clean, predictable endpoints
- **Real-time Prices**: Yahoo Finance integration
- **Data Validation**: Pydantic models for type safety
- **Error Handling**: Comprehensive error responses

## API Endpoints

### Holdings
- `GET /api/holdings` - Get all holdings (latest versions)
- `POST /api/holdings` - Create new holding
- `PUT /api/holdings/{id}` - Update holding (creates new version)
- `DELETE /api/holdings/{id}` - Soft delete holding
- `GET /api/holdings/{id}/history` - Get version history

### Price Fetching
- `POST /api/fetch-price` - Fetch current price for ticker

### Web Pages
- `GET /` - Main portfolio view
- `GET /edit` - Add new holding form
- `GET /edit/{id}` - Edit existing holding form

## Development

## Cost

- **Hosting**: $0 (localhost) or free tier options
- **Database**: $0 (SQLite file)
- **API**: $0 (yfinance is free)
- **Total Cost**: $0

## Future Enhancements (V2)

- Portfolio value over time chart
- CSV export functionality
- Bulk price update
- Portfolio allocation pie chart
- Dark mode toggle

## Troubleshooting

### Environment Setup Issues

**UV Installation**:
- Install UV: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Verify installation: `uv --version`
- Sync dependencies: `uv sync`
- Run commands: `uv run python main.py`

**Python Version**:
- Requires Python 3.9+ for AI agents compatibility
- Check version: `python --version`
- UV automatically manages virtual environments

**Frontend Issues**:
- Install Node.js dependencies: `npm install`
- Start dev server: `npm run dev`
- Clear cache if needed: `rm -rf node_modules package-lock.json && npm install`

### Price Fetching Issues

- Some tickers may not be available or may have delays
- Canadian stocks often need `.TO` suffix
- Crypto tickers use `-USD` suffix
- Manual entry always works as a fallback

### Database Issues

- The database file (`portfolio.db`) is created automatically
- If you encounter issues, delete the database file and restart
- Sample data can be added with `uv run python add_sample_data.py`
- Database is ignored by git (see `.gitignore`)

### AI Insights Issues

- Ensure Ollama is running: `ollama serve`
- Pull required model: `ollama pull gemma3:4b-it-qat`
- Check Ollama status: `ollama list`
- Insights are optional - app works without AI features

### Performance

- The application is designed for personal use with hundreds of holdings
- For very large portfolios, consider adding indexes to the database
- Price fetching is cached per request to avoid rate limits
- UV provides 10-100x faster dependency resolution than pip

## Learning Goals

This project is designed to help you learn:

- **Flask**: Basic web framework concepts
- **SQLite**: Database operations and schema design
- **API Design**: RESTful endpoints and JSON responses
- **Frontend**: Modern HTML/CSS with Alpine.js for interactivity
- **Financial Calculations**: Portfolio metrics and percentages
- **Data Integration**: Working with external APIs (Yahoo Finance)
