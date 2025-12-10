from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import yfinance as yf
import argparse
from typing import Optional, List, Literal, Dict
from database import (
    get_db,
    init_db,
    get_all_holdings,
    get_all_holdings_for_user,
    get_holding_by_id,
    create_holding,
    update_holding,
    delete_holding,
    get_holding_history,
    add_price_history,
    add_price_history_hourly,
    get_price_history,
    get_portfolio_history,
    get_account_type_history,
    get_portfolio_history_hourly,
    get_account_type_history_hourly,
    add_portfolio_snapshot,
    get_portfolio_snapshots_since,
    get_portfolio_snapshot_before,
    get_latest_portfolio_snapshot,
    get_all_users,
    get_user_by_id,
    create_user,
)
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from datetime import datetime, time, timedelta, timezone

MARKET_INDEXES: List[Dict[str, str]] = [
    {"id": "sp500", "symbol": "^GSPC", "name": "S&P 500"},
    {"id": "dow", "symbol": "^DJI", "name": "Dow Jones"},
    {"id": "nasdaq", "symbol": "^IXIC", "name": "Nasdaq"},
]

DEFAULT_USER_ID = 'default'

app = FastAPI(title="Portfolio Tracker", description="A simple web application to track investment holdings")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup templates
templates = Jinja2Templates(directory="templates")

# Initialize scheduler
scheduler = BackgroundScheduler()
scheduler.start()

# Pydantic models for API
class HoldingCreate(BaseModel):
    account_type: str
    account: str
    ticker: str = ""
    name: str
    category: str
    lookup: str = ""
    shares: float
    cost: float
    current_price: float
    contribution: Optional[float] = None  # Allow manual overrides
    track_price: bool = True
    track_insights: bool = False
    manual_price_override: bool = False
    value_override: Optional[float] = None

class HoldingUpdate(BaseModel):
    account_type: str
    account: str
    ticker: str = ""
    name: str
    category: str
    lookup: str = ""
    shares: float
    cost: float
    current_price: float
    contribution: Optional[float] = None  # Allow manual overrides
    track_price: bool = True
    manual_price_override: bool = False
    value_override: Optional[float] = None

class PriceRequest(BaseModel):
    ticker: str

def is_market_open() -> bool:
    """Check if market is open (weekdays 9AM-5PM EST)"""
    est = pytz.timezone('US/Eastern')
    now = datetime.now(est)
    
    # Check if it's a weekday (0=Monday, 6=Sunday)
    if now.weekday() >= 5:  # Saturday or Sunday
        return False
    
    # Check if time is between 9AM and 5PM EST
    market_open = time(9, 0)  # 9:00 AM
    market_close = time(17, 0)  # 5:00 PM
    current_time = now.time()
    
    return market_open <= current_time <= market_close

def capture_portfolio_prices():
    """Capture prices for all holdings and store in history"""
    if not is_market_open():
        print(f"[{datetime.now()}] Market is closed, skipping price capture")
        return
    
    print(f"[{datetime.now()}] Starting portfolio price capture...")
    
    try:
        holdings = [dict(row) for row in get_all_holdings()]
        captured_count = 0
        
        for holding in holdings:
            if holding['lookup'] and holding['lookup'].strip():
                price, name = fetch_price(holding['lookup'])
                if price is not None:
                    captured_at = datetime.utcnow()
                    add_price_history(holding['lookup'], price, captured_at=captured_at)
                    add_price_history_hourly(holding['lookup'], price, timestamp=captured_at)
                    captured_count += 1
                    print(f"Captured {holding['lookup']}: ${price}")
                else:
                    print(f"Failed to fetch price for {holding['ticker']}")
        
        latest_holdings = [dict(row) for row in get_all_holdings()]
        _, portfolio_stats = enrich_holdings_with_calculations(latest_holdings)
        add_portfolio_snapshot(portfolio_stats, captured_at=datetime.utcnow(), user_id=DEFAULT_USER_ID)

        print(f"Price capture completed. Captured {captured_count} prices.")
        
    except Exception as e:
        print(f"Error during price capture: {e}")

def setup_scheduler():
    """Setup the scheduled job for price capture"""
    # Schedule job to run at 5 minutes past every hour, Monday-Friday
    scheduler.add_job(
        capture_portfolio_prices,
        CronTrigger(
            minute="5",  # 5th minute of the hour
            hour="9-17",  # 9 AM to 5 PM
            day_of_week="mon-fri"  # Monday to Friday
        ),
        id="portfolio_price_capture",
        name="Portfolio Price Capture",
        replace_existing=True
    )
    print("Scheduler setup complete. Price capture scheduled for weekdays 9:05 AM - 5:05 PM EST")

def fetch_price(ticker: str) -> tuple[Optional[float], Optional[str]]:
    """Fetch current price and name for ticker using yfinance"""
    if not ticker or ticker.strip() == '-':
        return None, None
    
    try:
        stock = yf.Ticker(ticker)
        ticker_info = stock.info
        
        # Try different price fields
        price = ticker_info.get('currentPrice')
        if price is None:
            price = ticker_info.get('regularMarketPrice')
        if price is None:
            price = ticker_info.get('previousClose')
        
        # Get the company name
        name = ticker_info.get('longName') or ticker_info.get('shortName')
        
        return float(price) if price else None, name
    except Exception as e:
        print(f"Error fetching price for {ticker}: {e}")
        return None, None

def calculate_portfolio_stats(holdings: List[dict]) -> dict:
    """Calculate portfolio statistics"""
    if not holdings:
        return {
            'total_value': 0,
            'total_cost': 0,
            'total_gain': 0,
            'total_gain_percent': 0,
            'holdings_count': 0
        }
    
    total_value = 0
    total_contribution = 0
    
    for holding in holdings:
        value = holding['shares'] * holding['current_price']
        total_value += value
        total_contribution += holding['contribution']
    
    total_gain = total_value - total_contribution
    total_gain_percent = (total_gain / total_contribution * 100) if total_contribution > 0 else 0
    
    return {
        'total_value': total_value,
        'total_cost': total_contribution,  # Keep for compatibility but use contribution
        'total_gain': total_gain,
        'total_gain_percent': total_gain_percent,
        'holdings_count': len(holdings)
    }

def _is_cash_holding(holding: dict) -> bool:
    category = holding.get('category', '') or ''
    ticker = holding.get('ticker', '') or ''
    lookup = holding.get('lookup', '') or ''
    return category.strip().lower() == 'cash' or (not ticker and not lookup)


def enrich_holdings_with_calculations(holdings: List[dict]) -> tuple[List[dict], dict]:
    """Add calculated fields to holdings"""
    enriched_holdings = []

    for holding in holdings:
        shares = holding['shares']

        latest_price = holding.get('latest_price')
        manual_override = bool(holding.get('manual_price_override'))
        use_price_history = (not manual_override) and (not _is_cash_holding(holding)) and latest_price is not None
        current_price = latest_price if use_price_history else holding['current_price']
        cost_per_share = holding['cost']
        contribution = holding['contribution']
        
        # Calculated fields
        value_override = holding.get('value_override')
        value = value_override if value_override is not None else shares * current_price
        absolute_gain = value - contribution  # Current value - total contribution
        relative_gain = (absolute_gain / contribution * 100) if contribution > 0 else 0
        
        # Percent change based on share price
        percent_change = ((current_price - cost_per_share) / cost_per_share * 100) if cost_per_share > 0 else 0
        dollar_change = absolute_gain
        
        enriched_holding = dict(holding)
        enriched_holding.update({
            'current_price': current_price,
            'value': value,
            'absolute_gain': absolute_gain,
            'relative_gain': relative_gain,
            'percent_change': percent_change,
            'dollar_change': dollar_change,
            'price_source': 'price_history' if use_price_history else 'holdings_table'
        })
        
        enriched_holdings.append(enriched_holding)
    
    portfolio_stats = calculate_portfolio_stats(enriched_holdings)
    total_value = portfolio_stats['total_value']

    # Update portfolio percentage now that totals are based on refreshed prices
    for holding in enriched_holdings:
        value = holding['value']
        holding['portfolio_percentage'] = (value / total_value * 100) if total_value > 0 else 0
    
    return enriched_holdings, portfolio_stats

# Web Routes
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Main holdings view"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/edit", response_class=HTMLResponse)
async def edit_new(request: Request):
    """Add new holding form"""
    return templates.TemplateResponse("edit.html", {"request": request, "holding": None})

@app.get("/edit/{holding_id}", response_class=HTMLResponse)
async def edit_existing(request: Request, holding_id: int):
    """Edit existing holding form"""
    holding = get_holding_by_id(holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    return templates.TemplateResponse("edit.html", {"request": request, "holding": dict(holding)})

# API Routes
@app.get("/api/holdings")
async def api_get_holdings(user_id: Optional[str] = None):
    """Get all holdings with calculations, optionally scoped to a user."""
    if user_id is None:
        user_id = DEFAULT_USER_ID
    holdings = [dict(row) for row in get_all_holdings_for_user(user_id)]
    enriched_holdings, portfolio_stats = enrich_holdings_with_calculations(holdings)
    
    return {
        "holdings": enriched_holdings,
        "stats": portfolio_stats,
        "user_id": user_id,
    }

@app.get("/api/users")
async def api_get_users():
    """List all available users for switching."""
    users = get_all_users()
    return {"users": users}

@app.post("/api/holdings")
async def api_create_holding(holding: HoldingCreate):
    """Create new holding"""
    try:
        holding_id = create_holding(holding.model_dump())
        return {"id": holding_id, "message": "Holding created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/holdings/{holding_id}")
async def api_update_holding(holding_id: int, holding: HoldingUpdate):
    """Update existing holding by creating new version"""
    try:
        new_holding_id = update_holding(holding_id, holding.model_dump())
        return {"id": new_holding_id, "message": "Holding updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/holdings/{holding_id}")
async def api_delete_holding(holding_id: int):
    """Delete holding"""
    try:
        delete_holding(holding_id)
        return {"message": "Holding deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/holdings/{holding_id}/history")
async def api_get_holding_history(holding_id: int):
    """Get version history of a holding"""
    try:
        # First get the holding to find its holding_id
        holding = get_holding_by_id(holding_id)
        if not holding:
            raise HTTPException(status_code=404, detail="Holding not found")
        
        # Get all versions of this holding
        history = get_holding_history(holding['holding_id'])
        history_dicts = [dict(row) for row in history]
        
        return {"history": history_dicts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/fetch-price")
async def api_fetch_price(payload: PriceRequest):
    ticker = payload.ticker
    price, name = fetch_price(ticker)
    if price is None:
        raise HTTPException(status_code=404, detail="Price not found")
    
    if price is not None:
        # Store price history
        add_price_history(ticker, price)
        return {"ticker": ticker, "price": price, "name": name}
    else:
        raise HTTPException(status_code=404, detail=f"Could not fetch price for {ticker}")

@app.get("/api/price-history/{ticker}")
async def api_get_price_history(ticker: str, days: int = 30):
    """Get price history for a ticker"""
    try:
        history = get_price_history(ticker, days)
        history_dicts = [dict(row) for row in history]
        return {"ticker": ticker, "history": history_dicts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio-history")
async def api_get_portfolio_history(
    days: int = 30,
    hours: int = 168,
    granularity: Literal['day', 'hour'] = 'day',
    user_id: Optional[str] = None,
):
    """Get portfolio value history"""
    if user_id is None:
        user_id = DEFAULT_USER_ID
    try:
        if granularity == 'hour':
            history = get_portfolio_history_hourly(hours, user_id)
            account_history = get_account_type_history_hourly(hours, user_id)
        else:
            history = get_portfolio_history(days, user_id)
            account_history = get_account_type_history(days, user_id)
        return {
            "history": history,
            "account_type_history": account_history,
            "granularity": granularity,
            "window": hours if granularity == 'hour' else days,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/portfolio-by-account-type")
async def api_get_portfolio_by_account_type():
    """Get portfolio data grouped by account type for visualization"""
    try:
        holdings = get_all_holdings()
        enriched_holdings, _ = enrich_holdings_with_calculations(holdings)
        
        # Group by account_type
        account_data = {}
        for holding in enriched_holdings:
            account_type = holding['account_type']
            if account_type not in account_data:
                account_data[account_type] = {
                    'account_type': account_type,
                    'contribution': 0,
                    'value': 0,
                    'count': 0
                }
            
            account_data[account_type]['contribution'] += holding['contribution']
            account_data[account_type]['value'] += holding['value']
            account_data[account_type]['count'] += 1
        
        return {"account_types": list(account_data.values())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/capture-prices")
async def api_capture_prices():
    capture_portfolio_prices()
    return {"message": "Price capture triggered"}

@app.get("/api/market-summary")
async def api_market_summary():
    summary = []
    for index in MARKET_INDEXES:
        price, name = fetch_price(index['symbol'])
        if price is None:
            summary.append({
                "id": index['id'],
                "name": name or index['name'],
                "symbol": index['symbol'],
                "price": None,
                "change": None,
                "change_percent": None,
            })
            continue

        ticker = yf.Ticker(index['symbol'])
        hist = ticker.history(period="2d", interval="1d")
        change = None
        change_percent = None
        if not hist.empty and len(hist['Close']) >= 2:
            latest = hist['Close'].iloc[-1]
            previous = hist['Close'].iloc[-2]
            change = float(latest - previous)
            if previous != 0:
                change_percent = float((change / previous) * 100)

        summary.append({
            "id": index['id'],
            "name": name or index['name'],
            "symbol": index['symbol'],
            "price": price,
            "change": change,
            "change_percent": change_percent,
        })

    return {"indexes": summary}

MOVEMENT_RANGE_WINDOWS = {
    '7d': timedelta(days=7),
    '1m': timedelta(days=30),
    '3m': timedelta(days=90),
}


def _resolve_range_start(range_key: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    key = range_key.lower()
    if key in MOVEMENT_RANGE_WINDOWS:
        return now - MOVEMENT_RANGE_WINDOWS[key]
    if key == 'ytd':
        return datetime(now.year, 1, 1, tzinfo=timezone.utc)
    if key == 'all':
        return None
    return now - MOVEMENT_RANGE_WINDOWS['7d']


@app.get("/api/portfolio-movement")
async def api_portfolio_movement(range: str = '7d', user_id: Optional[str] = None):
    if user_id is None:
        user_id = DEFAULT_USER_ID
    range_key = (range or '7d').lower()
    start_time = _resolve_range_start(range_key)
    snapshots = get_portfolio_snapshots_since(start_time, user_id)

    if not snapshots:
        latest_snapshot = get_latest_portfolio_snapshot(user_id)
        if latest_snapshot:
            snapshots = [latest_snapshot]

    holdings_rows = [dict(row) for row in get_all_holdings_for_user(user_id)]
    _, current_stats = enrich_holdings_with_calculations(holdings_rows)
    current_value = float(current_stats.get('total_value', 0))
    now_utc = datetime.utcnow().replace(tzinfo=timezone.utc, microsecond=0)
    current_point = {
        'captured_at': now_utc.isoformat(),
        'total_value': current_value,
    }

    snapshots_for_points = list(snapshots)
    if not snapshots_for_points:
        snapshots_for_points.append(current_point)

    baseline_snapshot = snapshots_for_points[0]
    if start_time:
        first_snapshot_time = datetime.fromisoformat(baseline_snapshot['captured_at'])
        if first_snapshot_time.tzinfo is None:
            first_snapshot_time = first_snapshot_time.replace(tzinfo=timezone.utc)
        if first_snapshot_time > start_time:
            prior_snapshot = get_portfolio_snapshot_before(start_time, user_id)
            if prior_snapshot:
                baseline_snapshot = prior_snapshot
                snapshots_for_points.insert(0, prior_snapshot)

    latest_snapshot = snapshots_for_points[-1]
    snapshot_last_updated_at = latest_snapshot['captured_at'] if snapshots else current_point['captured_at']

    if not snapshots_for_points or snapshots_for_points[-1]['captured_at'] != current_point['captured_at']:
        snapshots_for_points.append(current_point)

    contribution_value = float(current_stats.get('total_cost', 0))
    previous_value = contribution_value
    change = current_value - contribution_value
    change_percent = (change / contribution_value * 100) if contribution_value else None

    return {
        "current_value": current_value,
        "previous_value": previous_value,
        "change": change,
        "change_percent": change_percent,
        "points": [
            {"timestamp": snap['captured_at'], "value": float(snap['total_value'])}
            for snap in snapshots_for_points
        ],
        "last_updated_at": snapshot_last_updated_at,
        "user_id": user_id,
        "range": range_key,
    }

@app.get("/api/scheduler-status")
async def get_scheduler_status():
    """Get scheduler status and next run time"""
    try:
        job = scheduler.get_job("portfolio_price_capture")
        if job:
            return {
                "scheduler_running": scheduler.running,
                "job_id": job.id,
                "job_name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "market_open": is_market_open()
            }
        else:
            return {"scheduler_running": scheduler.running, "job_id": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Portfolio Tracker FastAPI Application')
    parser.add_argument('--port', type=int, default=5001, help='Port to run the FastAPI application on (default: 5001)')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to bind the FastAPI application to (default: 0.0.0.0)')
    parser.add_argument('--reload', action='store_true', help='Enable auto-reload for development')
    
    args = parser.parse_args()
    
    # Initialize database on startup
    init_db()
    
    # Setup the scheduler for price capture
    setup_scheduler()
    
    print(f"🚀 Starting Portfolio Tracker on http://{args.host}:{args.port}")
    print(f"📱 Auto-reload: {'enabled' if args.reload else 'disabled'}")
    print(f"⏰ Price capture scheduler: Active (weekdays 9:05 AM - 5:05 PM EST)")
    
    import uvicorn
    if args.reload:
        uvicorn.run("main:app", host=args.host, port=args.port, reload=True)
    else:
        uvicorn.run(app, host=args.host, port=args.port, reload=False)
