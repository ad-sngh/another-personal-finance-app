from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import yfinance as yf
import argparse
from typing import Optional, List
from database import get_db, init_db, get_all_holdings, get_holding_by_id, create_holding, update_holding, delete_holding, get_holding_history, add_price_history, get_price_history, get_portfolio_history
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from datetime import datetime, time

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
    contribution: Optional[float] = None  # Will be calculated on backend

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
    contribution: Optional[float] = None  # Will be calculated on backend

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
        holdings = get_all_holdings()
        captured_count = 0
        
        for holding in holdings:
            if holding['ticker'] and holding['ticker'].strip():
                price, name = fetch_price(holding['ticker'])
                if price is not None:
                    add_price_history(holding['ticker'], price)
                    captured_count += 1
                    print(f"Captured {holding['ticker']}: ${price}")
                else:
                    print(f"Failed to fetch price for {holding['ticker']}")
        
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

def enrich_holdings_with_calculations(holdings: List[dict]) -> tuple[List[dict], dict]:
    """Add calculated fields to holdings"""
    portfolio_stats = calculate_portfolio_stats(holdings)
    total_value = portfolio_stats['total_value']
    
    enriched_holdings = []
    for holding in holdings:
        shares = holding['shares']
        current_price = holding['current_price']
        cost_per_share = holding['cost']
        contribution = holding['contribution']
        
        # Calculated fields
        value = shares * current_price
        portfolio_percentage = (value / total_value * 100) if total_value > 0 else 0
        absolute_gain = value - contribution  # Current value - total contribution
        relative_gain = (absolute_gain / contribution * 100) if contribution > 0 else 0
        
        # Percent change based on share price
        percent_change = ((current_price - cost_per_share) / cost_per_share * 100) if cost_per_share > 0 else 0
        dollar_change = absolute_gain
        
        enriched_holding = dict(holding)
        enriched_holding.update({
            'value': value,
            'portfolio_percentage': portfolio_percentage,
            'absolute_gain': absolute_gain,
            'relative_gain': relative_gain,
            'percent_change': percent_change,
            'dollar_change': dollar_change
        })
        
        enriched_holdings.append(enriched_holding)
    
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
async def api_get_holdings():
    """Get all holdings with calculations"""
    holdings = [dict(row) for row in get_all_holdings()]
    enriched_holdings, portfolio_stats = enrich_holdings_with_calculations(holdings)
    
    return {
        "holdings": enriched_holdings,
        "stats": portfolio_stats
    }

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
async def api_fetch_price(request: PriceRequest):
    """Fetch current price and name for a ticker"""
    ticker = request.ticker
    
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required")
    
    price, name = fetch_price(ticker)
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
async def api_get_portfolio_history(days: int = 30):
    """Get portfolio value history"""
    try:
        history = get_portfolio_history(days)
        history_dicts = [dict(row) for row in history]
        return {"history": history_dicts}
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
async def manual_price_capture():
    """Manually trigger price capture for testing"""
    try:
        capture_portfolio_prices()
        return {"message": "Price capture triggered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
