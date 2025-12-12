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
    upsert_current_insight,
    get_current_insights,
)
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from datetime import datetime, time, timedelta, timezone
import json

from agent_runner import run_insights_pipeline
from agent_tools import get_stock_price_info
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

class InsightRunRequest(BaseModel):
    symbol: str
    current_price: Optional[float] = None
    previous_close: Optional[float] = None
    user_id: Optional[str] = None

class InsightRefreshRequest(BaseModel):
    user_id: Optional[str] = None

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

    # Schedule daily insights refresh (default 7:30 AM EST, every day)
    scheduler.add_job(
        refresh_tracked_insights_job,
        CronTrigger(
            hour="7",
            minute="30",
            day_of_week="mon-sun",
        ),
        id="daily_insights_refresh",
        name="Daily Insights Refresh",
        replace_existing=True,
    )
    print("Scheduler setup complete. Insights refresh scheduled daily at 7:30 AM EST")


def refresh_tracked_insights_for_user(user_id: str) -> dict:
    """Run the insights pipeline for all holdings that track insights.
    
    If Ollama server is unavailable, preserves existing insights instead of failing.
    Only tries once per ticker with proper timeout handling.
    """
    holdings = [dict(row) for row in get_all_holdings_for_user(user_id)]
    refreshed: list[str] = []
    errors: list[dict[str, str]] = []
    ollama_unavailable = False

    for holding in holdings:
        if not holding.get("track_insights"):
            continue
        symbol = (holding.get("lookup") or holding.get("ticker") or "").strip()
        if not symbol:
            continue
        
        # If Ollama was previously detected as unavailable, skip further attempts
        if ollama_unavailable:
            errors.append({
                "symbol": symbol, 
                "error": "Skipped: Ollama server unavailable, preserving existing insight"
            })
            continue
            
        print(f"[{datetime.utcnow().isoformat()}] Processing insights for {symbol}...")
        
        try:
            # Add timeout handling for price fetching
            import signal
            
            def timeout_handler(signum, frame):
                raise TimeoutError("Price fetch timeout")
            
            # Set a 30-second timeout for price fetching
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(30)
            
            try:
                quote = get_stock_price_info(symbol)
                print(f"[{datetime.utcnow().isoformat()}] {symbol}: Price fetched - Current: {quote.current_price}, Previous: {quote.previous_close}")
            finally:
                signal.alarm(0)  # Cancel the alarm
            
            # Run insights pipeline with timeout
            signal.alarm(60)  # 60-second timeout for AI processing
            
            try:
                result = run_insights_pipeline(symbol, quote.current_price, quote.previous_close or quote.current_price)
                print(f"[{datetime.utcnow().isoformat()}] {symbol}: AI analysis completed")
                print(f"[{datetime.utcnow().isoformat()}] {symbol}: Summary - {result['summary'][:100]}...")
                _save_insight(user_id, symbol, result["summary"], result["analysis"])
                refreshed.append(symbol.upper())
                print(f"[{datetime.utcnow().isoformat()}] {symbol}: ✓ Insight saved successfully")
            finally:
                signal.alarm(0)  # Cancel the alarm
                
        except TimeoutError as exc:
            print(f"[{datetime.utcnow().isoformat()}] {symbol}: ✗ Timeout - {str(exc)}")
            errors.append({"symbol": symbol, "error": f"Timeout: {str(exc)}"})
        except Exception as exc:
            error_str = str(exc).lower()
            print(f"[{datetime.utcnow().isoformat()}] {symbol}: ✗ Error - {str(exc)}")
            
            # Check for Ollama-specific connection errors
            if any(keyword in error_str for keyword in [
                "connection refused", 
                "ollama", 
                "127.0.0.1:11434",
                "connection error",
                "timeout",
                "unreachable"
            ]):
                ollama_unavailable = True
                errors.append({
                    "symbol": symbol, 
                    "error": "Ollama server unavailable - preserving existing insights for all remaining tickers"
                })
                print(f"[{datetime.utcnow().isoformat()}] Ollama server unavailable during insights refresh for {symbol}. Preserving existing insights.")
            elif any(keyword in error_str for keyword in [
                "delisted",
                "no data found",
                "no price data",
                "symbol may be delisted"
            ]):
                errors.append({
                    "symbol": symbol, 
                    "error": "Ticker appears delisted or no data available"
                })
                print(f"[{datetime.utcnow().isoformat()}] {symbol}: Ticker appears delisted, skipping.")
            else:
                errors.append({"symbol": symbol, "error": str(exc)})

    return {"user_id": user_id, "refreshed": refreshed, "errors": errors}


def refresh_tracked_insights_job():
    """Scheduler job to refresh insights daily.
    
    Includes fallback logic to preserve existing insights if Ollama is unavailable.
    """
    print(f"[{datetime.utcnow().isoformat()}] Starting scheduled insights refresh...")
    try:
        users = get_all_users()
    except Exception as exc:
        print(f"Failed to load users for insights refresh: {exc}")
        return

    if not users:
        users = [{"user_id": DEFAULT_USER_ID}]

    for user in users:
        user_id = user.get("user_id") or DEFAULT_USER_ID
        try:
            result = refresh_tracked_insights_for_user(user_id)
            refreshed = result.get("refreshed", [])
            errors = result.get("errors", [])
            
            # Log summary
            if refreshed:
                print(f"Insights refresh for user {user_id}: {len(refreshed)} tickers updated successfully")
            
            if errors:
                ollama_errors = [e for e in errors if "ollama" in e["error"].lower() or "preserving" in e["error"].lower()]
                other_errors = [e for e in errors if e not in ollama_errors]
                
                if ollama_errors:
                    print(f"Insights refresh for user {user_id}: Ollama server unavailable, preserved existing insights for {len(ollama_errors)} tickers")
                
                if other_errors:
                    print(f"Insights refresh for user {user_id}: {len(other_errors)} other errors occurred")
                    for error in other_errors[:3]:  # Log first 3 non-Ollama errors
                        print(f"  - {error['symbol']}: {error['error']}")
                    if len(other_errors) > 3:
                        print(f"  ... and {len(other_errors) - 3} more errors")
                        
            if not refreshed and not errors:
                print(f"Insights refresh for user {user_id}: No holdings with insight tracking found")
                
        except Exception as exc:
            print(f"Failed to refresh insights for user {user_id}: {exc}")

def fetch_price(ticker: str) -> tuple[Optional[float], Optional[str]]:
    """Fetch current price and name for ticker using yfinance with fast_info fallback."""
    if not ticker or ticker.strip() == "-":
        return None, None

    try:
        stock = yf.Ticker(ticker)
        price: Optional[float] = None
        name: Optional[str] = None

        fast_info = getattr(stock, "fast_info", {}) or {}
        for key in (
            "last_price",
            "lastClose",
            "regular_market_price",
            "regularMarketPrice",
            "previous_close",
        ):
            value = fast_info.get(key)
            if value is not None:
                price = float(value)
                break

        if not name:
            name = fast_info.get("longName") or fast_info.get("shortName")

        if price is None or price <= 0:
            ticker_info = stock.info or {}
            for key in ("currentPrice", "regularMarketPrice", "previousClose"):
                value = ticker_info.get(key)
                if value is not None:
                    price = float(value)
                    break
            if not name:
                name = ticker_info.get("longName") or ticker_info.get("shortName")

        if price is None or price <= 0:
            hist = stock.history(period="2d", interval="1d")
            if not hist.empty and "Close" in hist:
                closes = hist["Close"].dropna().tolist()
                if closes:
                    price = float(closes[-1])
                    if not name:
                        name = ticker

        return price, name
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

def _save_insight(user_id: str, symbol: str, summary: str, analysis: dict):
    move_percent = analysis.get("move_percent")
    move_text = None
    if move_percent is not None:
        move_text = f"{move_percent}%" if isinstance(move_percent, (int, float)) else str(move_percent)
    sentiment = analysis.get("confidence")
    analysis_json = json.dumps(analysis, ensure_ascii=False)
    upsert_current_insight(user_id, symbol.upper(), summary, move_text, sentiment, analysis_json)


@app.post("/api/insights/run")
async def api_run_insight(payload: InsightRunRequest):
    user_id = payload.user_id or DEFAULT_USER_ID
    symbol = payload.symbol.upper().strip()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")

    current_price = payload.current_price
    previous_close = payload.previous_close

    # Treat missing or zero / negative values as "fetch automatically"
    if (current_price is None or current_price <= 0) or (previous_close is None or previous_close <= 0):
        quote = get_stock_price_info(symbol)
        if current_price is None or current_price <= 0:
            current_price = quote.current_price
        if previous_close is None or previous_close <= 0:
            previous_close = quote.previous_close

    if previous_close in (None, 0):
        raise HTTPException(status_code=400, detail="Previous close price is required and must be non-zero")
    if current_price is None:
        raise HTTPException(status_code=400, detail="Current price is required")

    try:
        result = run_insights_pipeline(symbol, current_price, previous_close)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to run insights pipeline: {exc}") from exc

    _save_insight(user_id, symbol, result["summary"], result["analysis"])
    return {
        "symbol": symbol,
        "summary": result["summary"],
        "analysis": result["analysis"],
        "stored_for_user": user_id,
    }


@app.post("/api/insights/refresh")
async def api_refresh_insights(payload: InsightRefreshRequest):
    user_id = payload.user_id or DEFAULT_USER_ID
    holdings = [dict(row) for row in get_all_holdings_for_user(user_id)]
    refreshed = []
    errors: list[dict[str, str]] = []

    for holding in holdings:
        if not holding.get("track_insights"):
            continue
        symbol = (holding.get("lookup") or holding.get("ticker") or "").strip()
        if not symbol:
            continue
        try:
            quote = get_stock_price_info(symbol)
            result = run_insights_pipeline(symbol, quote.current_price, quote.previous_close or quote.current_price)
            _save_insight(user_id, symbol, result["summary"], result["analysis"])
            refreshed.append(symbol.upper())
        except Exception as exc:
            errors.append({"symbol": symbol, "error": str(exc)})

    return {"user_id": user_id, "refreshed": refreshed, "errors": errors}


@app.get("/api/insights")
async def api_get_insights(user_id: Optional[str] = None):
    resolved_user = user_id or DEFAULT_USER_ID
    insights = get_current_insights(resolved_user)
    return {"user_id": resolved_user, "insights": insights}


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
    parser.add_argument('--port', type=int, default=8081, help='Port to run the FastAPI application on (default: 8081)')
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
