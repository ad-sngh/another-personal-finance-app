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

The application is organized into separate frontend and backend repositories:

```
finance/
├── backend/                 # FastAPI backend with versioning
│   ├── main.py             # Main FastAPI application
│   ├── database.py         # Database operations and versioning
│   ├── requirements.txt    # Python dependencies
│   ├── start.sh           # Startup script
│   └── README.md          # Backend documentation
├── frontend/               # Modern Alpine.js frontend
│   ├── static/
│   │   └── script.js      # Main application logic
│   ├── templates/
│   │   ├── index.html     # Main portfolio view
│   │   └── edit.html      # Edit form
│   ├── package.json       # Frontend metadata
│   └── README.md          # Frontend documentation
├── README.md              # This file
└── UV_COMMANDS.md         # Development commands
```

## Quick Start

### Prerequisites
- Python 3.8+ (for backend)
- Node.js 16+ (optional, for frontend development)
- SQLite (included with Python)

### 1. Start the Backend

```bash
cd backend
chmod +x start.sh
./start.sh --reload --port 5001
```

The backend will be available at:
- **API**: http://localhost:5001
- **Documentation**: http://localhost:5001/docs
- **Portfolio View**: http://localhost:5001

### 2. Start the Frontend (Optional)

If you want to run the frontend separately:

```bash
cd frontend
python -m http.server 3000
```

Then visit http://localhost:3000

### 3. Add Sample Data

```bash
cd backend
python add_sample_data.py
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

### Price Fetching Issues

- Some tickers may not be available or may have delays
- Canadian stocks often need `.TO` suffix
- Crypto tickers use `-USD` suffix
- Manual entry always works as a fallback

### Database Issues

- The database file (`portfolio.db`) is created automatically
- If you encounter issues, delete the database file and restart
- Sample data can be added with `uv run python add_sample_data.py`

### uv Issues

- Make sure uv is installed: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Sync dependencies: `uv sync`
- Run commands with uv: `uv run python app.py`
- uv automatically manages virtual environments

### Performance

- The application is designed for personal use with hundreds of holdings
- For very large portfolios, consider adding indexes to the database
- Price fetching is cached per request to avoid rate limits

## Learning Goals

This project is designed to help you learn:

- **Flask**: Basic web framework concepts
- **SQLite**: Database operations and schema design
- **API Design**: RESTful endpoints and JSON responses
- **Frontend**: Modern HTML/CSS with Alpine.js for interactivity
- **Financial Calculations**: Portfolio metrics and percentages
- **Data Integration**: Working with external APIs (Yahoo Finance)
