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

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from database import add_price_history, get_price_history

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
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    args.func(args)

if __name__ == '__main__':
    main()
