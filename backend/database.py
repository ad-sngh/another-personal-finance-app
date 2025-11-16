import sqlite3
import os
from datetime import datetime

DATABASE = 'portfolio.db'

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with holdings table"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            holding_id TEXT NOT NULL,  -- UUID to group versions of the same holding
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
        )
    ''')
    
    # Create price history table for sparklines
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            price REAL NOT NULL,
            date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(ticker, date)
        )
    ''')
    
    # Add holding_id column to existing table if it doesn't exist
    cursor.execute('PRAGMA table_info(holdings)')
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'holding_id' not in columns:
        cursor.execute('ALTER TABLE holdings ADD COLUMN holding_id TEXT')
        # Generate holding_id for existing records
        cursor.execute('UPDATE holdings SET holding_id = hex(randomblob(16)) WHERE holding_id IS NULL')
    
    if 'is_deleted' not in columns:
        cursor.execute('ALTER TABLE holdings ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE')
    
    conn.commit()
    conn.close()

def get_all_holdings():
    """Get all holdings from database (only latest versions, not deleted)"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get only the latest version of each holding that is not deleted
    cursor.execute('''
        SELECT h.* FROM holdings h
        INNER JOIN (
            SELECT holding_id, MAX(id) as max_id
            FROM holdings 
            WHERE is_deleted = FALSE
            GROUP BY holding_id
        ) latest ON h.id = latest.max_id
        WHERE h.is_deleted = FALSE
        ORDER BY h.account_type, h.account, h.name
    ''')
    holdings = cursor.fetchall()
    conn.close()
    return holdings

def get_holding_by_id(id):
    """Get a single holding by ID"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM holdings WHERE id = ?', (id,))
    holding = cursor.fetchone()
    conn.close()
    return holding

def create_holding(data):
    """Create a new holding"""
    conn = get_db()
    cursor = conn.cursor()
    
    import uuid
    holding_id = str(uuid.uuid4())
    
    # Auto-calculate contribution as shares × cost (cost is now per share)
    contribution = data['shares'] * data['cost']
    
    cursor.execute('''
        INSERT INTO holdings (holding_id, account_type, account, ticker, name, category, 
                            lookup, shares, cost, current_price, contribution)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (holding_id, data['account_type'], data['account'], data['ticker'], data['name'],
          data['category'], data['lookup'], data['shares'], data['cost'],
          data['current_price'], contribution))
    
    conn.commit()
    holding_db_id = cursor.lastrowid
    conn.close()
    return holding_db_id

def update_holding(id, data):
    """Update an existing holding by creating a new version"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get the holding_id of the existing record
    cursor.execute('SELECT holding_id FROM holdings WHERE id = ?', (id,))
    result = cursor.fetchone()
    
    if not result:
        conn.close()
        raise ValueError("Holding not found")
    
    holding_id = result['holding_id']
    
    # Auto-calculate contribution as shares × cost (cost is now per share)
    contribution = data['shares'] * data['cost']
    
    # Create a new version with the updated data
    cursor.execute('''
        INSERT INTO holdings (holding_id, account_type, account, ticker, name, category, 
                            lookup, shares, cost, current_price, contribution)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (holding_id, data['account_type'], data['account'], data['ticker'], data['name'],
          data['category'], data['lookup'], data['shares'], data['cost'],
          data['current_price'], contribution))
    
    conn.commit()
    new_holding_id = cursor.lastrowid
    conn.close()
    return new_holding_id

def delete_holding(id):
    """Soft delete a holding by marking it as deleted"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get the holding_id of the existing record
    cursor.execute('SELECT holding_id FROM holdings WHERE id = ?', (id,))
    result = cursor.fetchone()
    
    if not result:
        conn.close()
        raise ValueError("Holding not found")
    
    holding_id = result['holding_id']
    
    # Mark all versions of this holding as deleted
    cursor.execute('UPDATE holdings SET is_deleted = TRUE WHERE holding_id = ?', (holding_id,))
    
    conn.commit()
    conn.close()

def get_holding_history(holding_id):
    """Get all versions of a holding (including deleted ones)"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM holdings 
        WHERE holding_id = ? 
        ORDER BY last_updated DESC
    ''', (holding_id,))
    
    history = cursor.fetchall()
    conn.close()
    return history

def add_price_history(ticker, price):
    """Add or update price history for a ticker"""
    conn = get_db()
    cursor = conn.cursor()
    
    from datetime import datetime
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Insert or replace today's price
    cursor.execute('''
        INSERT OR REPLACE INTO price_history (ticker, price, date)
        VALUES (?, ?, ?)
    ''', (ticker, price, today))
    
    conn.commit()
    conn.close()

def get_price_history(ticker, days=30):
    """Get price history for a ticker for the last N days"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT date, price FROM price_history 
        WHERE ticker = ? 
        ORDER BY date DESC 
        LIMIT ?
    ''', (ticker, days))
    
    history = cursor.fetchall()
    conn.close()
    return history

def get_portfolio_history(days=30):
    """Get portfolio value history for the last N days"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT h.last_updated::date as date, 
               SUM(h.shares * h.current_price) as value
        FROM holdings h
        WHERE h.is_deleted = FALSE
        AND h.last_updated >= date('now', '-{} days')
        GROUP BY h.last_updated::date
        ORDER BY date DESC
        LIMIT ?
    '''.format(days), (days,))
    
    history = cursor.fetchall()
    conn.close()
    return history

if __name__ == '__main__':
    # Initialize database if run directly
    init_db()
    print("Database initialized successfully!")
