#!/usr/bin/env python3
"""
Portfolio Database CLI Tool
A simple command-line interface to interact with the portfolio database.
"""

import sqlite3
import argparse
import sys
import os
from datetime import datetime, timedelta
from tabulate import tabulate
import pandas as pd
import yfinance as yf

# Add backend to path and import database module explicitly
CURRENT_DIR = os.path.dirname(__file__)
BACKEND_DIR = os.path.join(CURRENT_DIR, 'backend')
sys.path.append(BACKEND_DIR)
from backend.database import add_price_history, get_price_history, get_active_holdings

def get_connection():
    """Get database connection"""
    db_path = os.path.join(os.path.dirname(__file__), 'backend', 'portfolio.db')
    print(f"Using database: {db_path}")
    return sqlite3.connect(db_path)

def show_price_history(args):
    """Show price history for a ticker"""
    conn = get_connection()
    
    if args.ticker:
        query = '''
            SELECT ticker, price, date, created_at 
            FROM price_history 
            WHERE ticker = ? 
            ORDER BY date DESC
        '''
        df = pd.read_sql_query(query, conn, params=[args.ticker])
    else:
        query = '''
            SELECT ticker, price, date, created_at 
            FROM price_history 
            ORDER BY date DESC, ticker
        '''
        df = pd.read_sql_query(query, conn)
    
    if args.limit:
        df = df.head(args.limit)
    
    print(tabulate(df, headers='keys', tablefmt='grid', showindex=False))
    conn.close()

def add_price(args):
    """Add price history entry"""
    try:
        price = float(args.price)
        date = args.date if args.date else datetime.now().strftime('%Y-%m-%d')
        
        add_price_history(args.ticker, price)
        print(f"✅ Added {args.ticker}: ${price} on {date}")
        
    except ValueError:
        print("❌ Invalid price format")
    except Exception as e:
        print(f"❌ Error: {e}")

def show_holdings(args):
    """Show holdings summary"""
    conn = get_connection()
    
    query = '''
        SELECT 
            account_type,
            account, 
            ticker,
            name,
            shares,
            current_price,
            contribution,
            is_deleted
        FROM holdings 
        ORDER BY account_type, account, ticker
    '''
    
    df = pd.read_sql_query(query, conn)
    
    if args.active_only:
        df = df[df['is_deleted'] == False]
    
    print(tabulate(df, headers='keys', tablefmt='grid', showindex=False))
    conn.close()

def show_portfolio_stats(args):
    """Show portfolio statistics"""
    conn = get_connection()
    
    # Holdings by account type
    query = '''
        SELECT 
            account_type,
            COUNT(*) as count,
            SUM(shares * current_price) as total_value,
            SUM(contribution) as total_contribution
        FROM holdings 
        WHERE is_deleted = FALSE AND ticker != ''
        GROUP BY account_type
        ORDER BY total_value DESC
    '''
    
    df = pd.read_sql_query(query, conn)
    print("=== Portfolio by Account Type ===")
    print(tabulate(df, headers='keys', tablefmt='grid', showindex=False))
    
    # Price history coverage
    query = '''
        SELECT 
            ticker,
            COUNT(*) as price_points,
            MIN(date) as first_date,
            MAX(date) as last_date
        FROM price_history
        GROUP BY ticker
        ORDER BY price_points DESC
    '''
    
    df = pd.read_sql_query(query, conn)
    print("\n=== Price History Coverage ===")
    print(tabulate(df, headers='keys', tablefmt='grid', showindex=False))
    
    conn.close()

def delete_price(args):
    """Delete price history entries"""
    conn = get_connection()
    cursor = conn.cursor()
    
    if args.ticker and args.date:
        cursor.execute('DELETE FROM price_history WHERE ticker = ? AND date = ?', (args.ticker, args.date))
        print(f"Deleted {args.ticker} price for {args.date}")
    elif args.ticker:
        cursor.execute('DELETE FROM price_history WHERE ticker = ?', (args.ticker,))
        print(f"Deleted all price history for {args.ticker}")
    else:
        print("❌ Must specify ticker")
        return
    
    conn.commit()
    conn.close()

def bulk_import(args):
    """Bulk import price data from CSV"""
    try:
        df = pd.read_csv(args.file)
        required_cols = ['ticker', 'price', 'date']
        
        if not all(col in df.columns for col in required_cols):
            print(f"❌ CSV must contain columns: {required_cols}")
            return
        
        conn = get_connection()
        cursor = conn.cursor()
        
        for _, row in df.iterrows():
            cursor.execute('''
                INSERT OR REPLACE INTO price_history (ticker, price, date)
                VALUES (?, ?, ?)
            ''', (row['ticker'], row['price'], row['date']))
        
        conn.commit()
        conn.close()
        
        print(f"✅ Imported {len(df)} price records")
        
    except Exception as e:
        print(f"❌ Error importing: {e}")

def backfill_prices(args):
    start_date = datetime.strptime(args.start_date, '%Y-%m-%d')
    end_date = datetime.strptime(args.end_date, '%Y-%m-%d') if args.end_date else datetime.utcnow()
    end_date_inclusive = end_date + timedelta(days=1)

    holdings = get_active_holdings()
    tickers = args.tickers.split(',') if args.tickers else sorted({(h.get('lookup') or '').strip().upper() for h in holdings if (h.get('lookup') or '').strip()})

    if not tickers:
        print('⚠️  No tickers found to backfill. Ensure holdings have lookup symbols and track_price enabled.')
        return

    for symbol in tickers:
        symbol = symbol.strip().upper()
        if not symbol:
            continue
        print(f"→ Backfilling {symbol} from {start_date.date()} to {end_date.date()}...")
        try:
            hist = yf.download(symbol, start=start_date, end=end_date_inclusive, interval='1d', progress=False, threads=False)
            if hist.empty:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(start=start_date, end=end_date_inclusive, interval='1d')
            if hist.empty:
                print(f"   ⚠️  No historical data for {symbol}")
                continue
            rows_added = 0
            for index, row in hist.iterrows():
                price = row.get('Close') or row.get('Adj Close')
                if price is None or pd.isna(price):
                    continue
                entry_dt = index.to_pydatetime()
                add_price_history(symbol, float(price), date_override=entry_dt.strftime('%Y-%m-%d'), captured_at=entry_dt)
                rows_added += 1
            print(f"   ✅ Added {rows_added} prices for {symbol}")
        except Exception as e:
            print(f"   ❌ Error backfilling {symbol}: {e}")

def main():
    parser = argparse.ArgumentParser(description='Portfolio Database CLI Tool')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Price history commands
    ph_parser = subparsers.add_parser('history', help='Show price history')
    ph_parser.add_argument('--ticker', help='Filter by ticker')
    ph_parser.add_argument('--limit', type=int, help='Limit number of records')
    ph_parser.set_defaults(func=show_price_history)
    
    # Add price command
    add_parser = subparsers.add_parser('add-price', help='Add price history entry')
    add_parser.add_argument('ticker', help='Ticker symbol')
    add_parser.add_argument('price', help='Price value')
    add_parser.add_argument('--date', help='Date (YYYY-MM-DD), defaults to today')
    add_parser.set_defaults(func=add_price)
    
    # Holdings command
    holdings_parser = subparsers.add_parser('holdings', help='Show holdings')
    holdings_parser.add_argument('--active-only', action='store_true', help='Show only active holdings')
    holdings_parser.set_defaults(func=show_holdings)
    
    # Stats command
    stats_parser = subparsers.add_parser('stats', help='Show portfolio statistics')
    stats_parser.set_defaults(func=show_portfolio_stats)
    
    # Delete command
    delete_parser = subparsers.add_parser('delete', help='Delete price history')
    delete_parser.add_argument('--ticker', required=True, help='Ticker symbol')
    delete_parser.add_argument('--date', help='Specific date to delete')
    delete_parser.set_defaults(func=delete_price)
    
    # Bulk import command
    import_parser = subparsers.add_parser('import', help='Bulk import from CSV')
    import_parser.add_argument('file', help='CSV file path')
    import_parser.set_defaults(func=bulk_import)

    backfill_parser = subparsers.add_parser('backfill', help='Backfill historical prices from yfinance')
    backfill_parser.add_argument('--start-date', default='2025-11-01', help='Start date (YYYY-MM-DD)')
    backfill_parser.add_argument('--end-date', help='End date (YYYY-MM-DD). Defaults to today.')
    backfill_parser.add_argument('--tickers', help='Comma-separated list of tickers to limit backfill')
    backfill_parser.set_defaults(func=backfill_prices)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    args.func(args)

if __name__ == '__main__':
    main()
