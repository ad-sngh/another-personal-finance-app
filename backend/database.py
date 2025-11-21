import sqlite3
import os
from datetime import datetime, timedelta, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, 'portfolio.db')

CATEGORY_NORMALIZATION = {
    'etf': 'ETF',
    'etfs': 'ETF',
}


def normalize_category_name(category: str | None) -> str:
    if not category:
        return ''
    cleaned = category.strip()
    return CATEGORY_NORMALIZATION.get(cleaned.lower(), cleaned)

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
        CREATE TABLE IF NOT EXISTS user_info (
            user_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
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
            is_deleted BOOLEAN DEFAULT FALSE,  -- Soft delete support
            track_price BOOLEAN DEFAULT TRUE,
            manual_price_override BOOLEAN DEFAULT FALSE,
            value_override REAL,
            convert_to_cad BOOLEAN DEFAULT FALSE,
            cad_conversion_rate REAL,
            user_id TEXT NOT NULL DEFAULT 'default',
            FOREIGN KEY (user_id) REFERENCES user_info(user_id)
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
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(ticker, date)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS price_history_hourly (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker TEXT NOT NULL,
            price REAL NOT NULL,
            timestamp DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(ticker, timestamp)
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
    if 'track_price' not in columns:
        cursor.execute('ALTER TABLE holdings ADD COLUMN track_price BOOLEAN DEFAULT TRUE')
        cursor.execute('UPDATE holdings SET track_price = TRUE WHERE track_price IS NULL')
    if 'manual_price_override' not in columns:
        cursor.execute('ALTER TABLE holdings ADD COLUMN manual_price_override BOOLEAN DEFAULT FALSE')
        cursor.execute('UPDATE holdings SET manual_price_override = FALSE WHERE manual_price_override IS NULL')
    if 'value_override' not in columns:
        cursor.execute('ALTER TABLE holdings ADD COLUMN value_override REAL')
    if 'convert_to_cad' not in columns:
        cursor.execute('ALTER TABLE holdings ADD COLUMN convert_to_cad BOOLEAN DEFAULT FALSE')
    if 'cad_conversion_rate' not in columns:
        cursor.execute('ALTER TABLE holdings ADD COLUMN cad_conversion_rate REAL')

    # Normalize legacy categories (e.g., ETFs -> ETF)
    cursor.execute("UPDATE holdings SET category = 'ETF' WHERE LOWER(TRIM(category)) IN ('etf', 'etfs')")

    # Ensure price_history has updated_at column (for existing databases)
    cursor.execute('PRAGMA table_info(price_history)')
    price_columns = [column[1] for column in cursor.fetchall()]
    if 'updated_at' not in price_columns:
        cursor.execute('ALTER TABLE price_history ADD COLUMN updated_at TIMESTAMP')
        cursor.execute('UPDATE price_history SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)')

    # Insert primary user if not exists
    cursor.execute('INSERT OR IGNORE INTO user_info (user_id, display_name, email) VALUES (?, ?, ?)', ('default', 'Primary User', 'primary@example.com'))

    # Migrate existing rows to 'default' if user_id column was just added
    cursor.execute('PRAGMA table_info(holdings)')
    holdings_columns = [column[1] for column in cursor.fetchall()]
    if 'user_id' not in holdings_columns:
        cursor.execute('ALTER TABLE holdings ADD COLUMN user_id TEXT NOT NULL DEFAULT "default"')
        cursor.execute('UPDATE holdings SET user_id = "default" WHERE user_id IS NULL')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_holdings_user_id
            ON holdings(user_id)
        ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS portfolio_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL DEFAULT 'default',
            captured_at TIMESTAMP NOT NULL,
            total_value REAL NOT NULL,
            total_contribution REAL NOT NULL,
            total_gain REAL NOT NULL,
            total_gain_percent REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES user_info(user_id)
        )
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_time
        ON portfolio_snapshots(user_id, captured_at)
    ''')

    conn.commit()
    conn.close()


def ensure_price_history_seed(
    ticker: str | None,
    price: float | None,
    track_price: bool = True,
    manual_price_override: bool = False,
):
    """Ensure a ticker exists in price history if tracking is enabled."""
    if not track_price or manual_price_override:
        return
    ticker = (ticker or '').strip()
    if not ticker:
        return
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT 1 FROM price_history WHERE ticker = ? LIMIT 1', (ticker,))
    exists = cursor.fetchone()
    conn.close()
    if exists:
        return
    if price is None:
        price = 0
    add_price_history(ticker, price)

def get_all_holdings(user_id: str | None = None):
    """Get all holdings from database (only latest versions, not deleted)"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get only the latest version of each holding that is not deleted
    query = '''
        SELECT h.*, ph.price AS latest_price, ph.updated_at AS price_updated_at
        FROM holdings h
        LEFT JOIN price_history ph
            ON ph.ticker = h.lookup
            AND ph.updated_at = (
                SELECT MAX(ph2.updated_at)
                FROM price_history ph2
                WHERE ph2.ticker = h.lookup
            )
        INNER JOIN (
            SELECT holding_id, MAX(id) as max_id
            FROM holdings 
            WHERE is_deleted = FALSE
            GROUP BY holding_id
        ) latest ON h.id = latest.max_id
        WHERE h.is_deleted = FALSE
    '''
    params = []
    if user_id is not None:
        query += ' AND h.user_id = ?'
        params.append(user_id)
    query += ' ORDER BY h.account_type, h.account, h.name'
    
    cursor.execute(query, params)
    holdings = cursor.fetchall()
    conn.close()
    return holdings

def get_all_holdings_for_user(user_id: str):
    """Convenient wrapper to get holdings for a specific user."""
    return get_all_holdings(user_id=user_id)


def _get_holdings_snapshot(cursor, user_id: str | None = None):
    query = '''
        SELECT h.*
        FROM holdings h
        INNER JOIN (
            SELECT holding_id, MAX(id) as max_id
            FROM holdings
            WHERE is_deleted = FALSE
            GROUP BY holding_id
        ) latest ON h.id = latest.max_id
        WHERE h.is_deleted = FALSE
    '''
    params = []
    if user_id is not None:
        query += ' AND h.user_id = ?'
        params.append(user_id)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    return [dict(row) for row in rows]


def get_active_holdings(user_id: str | None = None):
    conn = get_db()
    cursor = conn.cursor()
    query = '''
        SELECT h.* FROM holdings h
        INNER JOIN (
            SELECT holding_id, MAX(id) as max_id
            FROM holdings
            WHERE is_deleted = FALSE
            GROUP BY holding_id
        ) latest ON h.id = latest.max_id
        WHERE h.is_deleted = FALSE
          AND h.track_price = TRUE
          AND h.lookup IS NOT NULL
          AND TRIM(h.lookup) != ''
    '''
    params = []
    if user_id is not None:
        query += ' AND h.user_id = ?'
        params.append(user_id)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def _normalize_symbol(value: str | None) -> str:
    return (value or '').strip().upper()


def _is_cash_holding(holding: dict) -> bool:
    category = (holding.get('category') or '').strip().lower()
    ticker = (holding.get('ticker') or '').strip()
    lookup = (holding.get('lookup') or '').strip()
    return category == 'cash' or (not ticker and not lookup)


def _get_price_rows(cursor, days):
    cursor.execute('''
        SELECT ticker,
               price,
               DATE(updated_at) AS price_date,
               updated_at
        FROM price_history
        WHERE updated_at >= DATE('now', ?)
        ORDER BY price_date ASC, updated_at DESC
    ''', (f'-{days} days',))
    return cursor.fetchall()


def _build_price_map(price_rows):
    price_map = {}
    unique_dates = set()
    for row in price_rows:
        ticker = _normalize_symbol(row['ticker'])
        date_key = row['price_date']
        unique_dates.add(date_key)
        key = (ticker, date_key)
        existing = price_map.get(key)
        if not existing or row['updated_at'] > existing['updated_at']:
            price_map[key] = {'price': row['price'], 'updated_at': row['updated_at']}
    return price_map, sorted(unique_dates)


def _calculate_holding_value(holding: dict, historical_price: float | None) -> float:
    value_override = holding.get('value_override')
    if value_override is not None:
        return float(value_override)

    shares = holding.get('shares') or 0
    manual_price_override = bool(holding.get('manual_price_override'))
    use_history_price = (not manual_price_override) and (not _is_cash_holding(holding))
    effective_price = historical_price if (use_history_price and historical_price is not None) else holding.get('current_price') or 0
    return shares * effective_price

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
    
    # Allow manual contribution override; default to shares × cost
    provided_contribution = data.get('contribution')
    contribution = provided_contribution if provided_contribution is not None else data['shares'] * data['cost']
    
    track_price = data.get('track_price', True)
    manual_price_override = data.get('manual_price_override', False)

    category = normalize_category_name(data.get('category'))

    cursor.execute('''
        INSERT INTO holdings (holding_id, account_type, account, ticker, name, category, 
                            lookup, shares, cost, current_price, contribution, track_price, manual_price_override, value_override, convert_to_cad, cad_conversion_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        holding_id,
        data['account_type'],
        data['account'],
        data['ticker'],
        data['name'],
        category,
        data['lookup'],
        data['shares'],
        data['cost'],
        data['current_price'],
        contribution,
        track_price,
        manual_price_override,
        data.get('value_override'),
        bool(data.get('convert_to_cad', False)),
        data.get('cad_conversion_rate'),
    ))

    conn.commit()
    holding_db_id = cursor.lastrowid
    conn.close()

    ensure_price_history_seed(
        data.get('lookup') or data.get('ticker'),
        data['current_price'],
        track_price,
        manual_price_override,
    )
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
    
    # Allow manual override for contribution when supplied
    provided_contribution = data.get('contribution')
    contribution = provided_contribution if provided_contribution is not None else data['shares'] * data['cost']
    
    # Create a new version with the updated data
    track_price = data.get('track_price', True)
    manual_price_override = data.get('manual_price_override', False)

    category = normalize_category_name(data.get('category'))

    cursor.execute('''
        INSERT INTO holdings (holding_id, account_type, account, ticker, name, category, 
                            lookup, shares, cost, current_price, contribution, track_price, manual_price_override, value_override, convert_to_cad, cad_conversion_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        holding_id,
        data['account_type'],
        data['account'],
        data['ticker'],
        data['name'],
        category,
        data['lookup'],
        data['shares'],
        data['cost'],
        data['current_price'],
        contribution,
        track_price,
        manual_price_override,
        data.get('value_override'),
        bool(data.get('convert_to_cad', False)),
        data.get('cad_conversion_rate'),
    ))

    conn.commit()
    new_holding_id = cursor.lastrowid
    conn.close()

    ensure_price_history_seed(
        data.get('lookup') or data.get('ticker'),
        data['current_price'],
        track_price,
        manual_price_override,
    )
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

def add_price_history(ticker, price, date_override=None, captured_at=None):
    """Add or update price history for a ticker"""
    conn = get_db()
    cursor = conn.cursor()

    captured_at = captured_at or datetime.utcnow()
    date_str = date_override or captured_at.strftime('%Y-%m-%d')

    cursor.execute('''
        INSERT INTO price_history (ticker, price, date, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(ticker, date) DO UPDATE SET
            price = excluded.price,
            updated_at = excluded.updated_at
    ''', (ticker, price, date_str, captured_at.isoformat()))

    conn.commit()
    conn.close()


def add_price_history_hourly(ticker, price, timestamp=None):
    """Add or update hourly price history for a ticker"""
    conn = get_db()
    cursor = conn.cursor()

    timestamp = timestamp or datetime.utcnow()
    ts = timestamp.replace(microsecond=0).isoformat()

    cursor.execute('''
        INSERT INTO price_history_hourly (ticker, price, timestamp)
        VALUES (?, ?, ?)
        ON CONFLICT(ticker, timestamp) DO UPDATE SET
            price = excluded.price
    ''', (ticker, price, ts))

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
    """Get portfolio value history for the last N days using price history snapshots"""
    conn = get_db()
    cursor = conn.cursor()

    holdings = _get_holdings_snapshot(cursor)
    price_rows = _get_price_rows(cursor, days)
    conn.close()

    if not price_rows:
        return []

    price_map, sorted_dates = _build_price_map(price_rows)

    history = []
    for date_key in sorted_dates:
        total_value = 0
        for holding in holdings:
            symbol = _normalize_symbol(holding.get('lookup'))
            price_entry = price_map.get((symbol, date_key)) if symbol else None
            historical_price = price_entry['price'] if price_entry else None
            total_value += _calculate_holding_value(holding, historical_price)
        history.append({'date': date_key, 'value': total_value})

    if len(history) > days:
        history = history[-days:]

    return history


def get_account_type_history(days=30):
    """Get per-account-type value history for sparklines"""
    conn = get_db()
    cursor = conn.cursor()

    holdings = _get_holdings_snapshot(cursor)
    price_rows = _get_price_rows(cursor, days)
    conn.close()

    if not price_rows:
        return {}

    price_map, sorted_dates = _build_price_map(price_rows)

    history_by_account = {}
    for date_key in sorted_dates:
        daily_totals = {}
        for holding in holdings:
            symbol = _normalize_symbol(holding.get('lookup'))
            price_entry = price_map.get((symbol, date_key)) if symbol else None
            historical_price = price_entry['price'] if price_entry else None
            value = _calculate_holding_value(holding, historical_price)
            account_type = holding['account_type']
            daily_totals[account_type] = daily_totals.get(account_type, 0) + value

        for account_type, value in daily_totals.items():
            history_by_account.setdefault(account_type, []).append({'date': date_key, 'value': value})

    # Ensure histories are limited to requested days
    for account_type, history in history_by_account.items():
        if len(history) > days:
            history_by_account[account_type] = history[-days:]

    return history_by_account


def _get_price_rows_hourly(cursor, hours):
    cursor.execute('''
        SELECT ticker,
               price,
               timestamp
        FROM price_history_hourly
        WHERE timestamp >= DATETIME('now', ?)
        ORDER BY timestamp ASC
    ''', (f'-{hours} hours',))
    return cursor.fetchall()


def get_portfolio_history_hourly(hours=168):
    """Get portfolio value history for the last N hours using hourly snapshots"""
    conn = get_db()
    cursor = conn.cursor()

    holdings = _get_holdings_snapshot(cursor)
    price_rows = _get_price_rows_hourly(cursor, hours)
    conn.close()

    if not price_rows:
        return []

    price_map = {}
    unique_timestamps = []
    for row in price_rows:
        ticker = _normalize_symbol(row['ticker'])
        timestamp = row['timestamp']
        price_map[(ticker, timestamp)] = row['price']
        if not unique_timestamps or unique_timestamps[-1] != timestamp:
            unique_timestamps.append(timestamp)

    history = []
    for ts in unique_timestamps:
        total_value = 0
        for holding in holdings:
            symbol = _normalize_symbol(holding.get('lookup'))
            price = price_map.get((symbol, ts)) if symbol else None
            historical_price = price if price is not None else None
            total_value += _calculate_holding_value(holding, historical_price)
        history.append({'timestamp': ts, 'value': total_value})

    if len(history) > hours:
        history = history[-hours:]

    return history


def get_account_type_history_hourly(hours=168):
    """Get per-account-type hourly value history"""
    conn = get_db()
    cursor = conn.cursor()

    holdings = _get_holdings_snapshot(cursor)
    price_rows = _get_price_rows_hourly(cursor, hours)
    conn.close()

    if not price_rows:
        return {}

    price_map = {}
    unique_timestamps = []
    for row in price_rows:
        ticker = row['ticker']
        timestamp = row['timestamp']
        price_map[(ticker, timestamp)] = row['price']
        if not unique_timestamps or unique_timestamps[-1] != timestamp:
            unique_timestamps.append(timestamp)

    history_by_account = {}
    for ts in unique_timestamps:
        daily_totals = {}
        for holding in holdings:
            symbol = _normalize_symbol(holding.get('lookup'))
            price = price_map.get((symbol, ts)) if symbol else None
            historical_price = price if price is not None else None
            value = _calculate_holding_value(holding, historical_price)
            account_type = holding['account_type']
            daily_totals[account_type] = daily_totals.get(account_type, 0) + value

        for account_type, value in daily_totals.items():
            history_by_account.setdefault(account_type, []).append({'timestamp': ts, 'value': value})

    for account_type, history in history_by_account.items():
        if len(history) > hours:
            history_by_account[account_type] = history[-hours:]

    return history_by_account


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def add_portfolio_snapshot(stats: dict, captured_at: datetime | None = None, user_id: str = 'default'):
    """Persist a portfolio-level aggregate snapshot for later movement calculations."""
    captured_at = _ensure_utc(captured_at or datetime.utcnow())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO portfolio_snapshots (user_id, captured_at, total_value, total_contribution, total_gain, total_gain_percent)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        user_id,
        captured_at.replace(microsecond=0).isoformat(),
        float(stats.get('total_value', 0)),
        float(stats.get('total_cost') if stats.get('total_cost') is not None else stats.get('total_contribution', 0)),
        float(stats.get('total_gain', 0)),
        float(stats.get('total_gain_percent', 0)),
    ))
    conn.commit()
    conn.close()


def get_portfolio_snapshots_since(start_time: datetime | None = None, user_id: str = 'default') -> list[dict]:
    """Get all portfolio snapshots since a given datetime for a specific user"""
    conn = get_db()
    cursor = conn.cursor()
    if start_time:
        cursor.execute('''
            SELECT * FROM portfolio_snapshots
            WHERE user_id = ? AND captured_at >= ?
            ORDER BY captured_at ASC
        ''', (user_id, start_time.isoformat()))
    else:
        cursor.execute('''
            SELECT * FROM portfolio_snapshots
            WHERE user_id = ?
            ORDER BY captured_at ASC
        ''', (user_id,))
    snapshots = cursor.fetchall()
    conn.close()
    return snapshots


def get_portfolio_snapshot_before(before: datetime, user_id: str = 'default'):
    """Get the latest portfolio snapshot before a given datetime for a specific user"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM portfolio_snapshots
        WHERE user_id = ? AND captured_at <= ?
        ORDER BY captured_at DESC
        LIMIT 1
    ''', (user_id, before.isoformat()))
    snapshot = cursor.fetchone()
    conn.close()
    return snapshot


def get_latest_portfolio_snapshot(user_id: str = 'default'):
    """Get the latest portfolio snapshot for a specific user"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM portfolio_snapshots
        WHERE user_id = ?
        ORDER BY captured_at DESC
        LIMIT 1
    ''', (user_id,))
    snapshot = cursor.fetchone()
    conn.close()
    return dict(snapshot) if snapshot else None


def get_price_history(ticker: str, days: int = 30):
    """Get price history for a specific ticker (shared across users)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT date, price
        FROM price_history
        WHERE ticker = ?
        ORDER BY date DESC
        LIMIT ?
    ''', (ticker, days))
    history = cursor.fetchall()
    conn.close()
    return history


def get_price_history_hourly(ticker: str, hours: int = 168):
    """Get hourly price history for a specific ticker (shared across users)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT timestamp, price
        FROM price_history_hourly
        WHERE ticker = ?
        ORDER BY timestamp ASC
        LIMIT ?
    ''', (ticker, hours))
    history = cursor.fetchall()
    conn.close()
    return history


# User info CRUD
def get_all_users():
    """Get all users from the user_info table."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM user_info ORDER BY created_at ASC')
    users = cursor.fetchall()
    conn.close()
    return [dict(u) for u in users]

def get_user_by_id(user_id: str):
    """Get a user by user_id."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM user_info WHERE user_id = ?', (user_id,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def create_user(user_id: str, display_name: str, email: str | None = None):
    """Create a new user."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO user_info (user_id, display_name, email) VALUES (?, ?, ?)',
                   (user_id, display_name, email))
    conn.commit()
    conn.close()
    return get_user_by_id(user_id)

if __name__ == '__main__':
    # Initialize database if run directly
    init_db()
    print("Database initialized successfully!")
