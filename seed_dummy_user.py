#!/usr/bin/env python3
"""
Seed a dummy user and creative holdings for testing multi-user support.
Run this script after initializing the database to add a second user.
"""
import os
import sys
import sqlite3
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from backend.database import get_db, init_db

def seed_portfolio_snapshots_for_dummy_user():
    """Create historical portfolio snapshots for the dummy user."""
    conn = get_db()
    cursor = conn.cursor()
    
    dummy_user_id = 'user_alex'
    
    # Check if user exists and has holdings
    cursor.execute('SELECT COUNT(*) as count FROM holdings WHERE user_id = ? AND is_deleted = FALSE', (dummy_user_id,))
    if cursor.fetchone()['count'] == 0:
        print(f"No holdings found for user '{dummy_user_id}', skipping snapshots.")
        conn.close()
        return
    
    # Calculate ACTUAL portfolio stats for dummy user
    cursor.execute('''
        SELECT SUM(shares * current_price) as total_value,
               SUM(contribution) as total_contribution
        FROM holdings 
        WHERE user_id = ? AND is_deleted = FALSE
    ''', (dummy_user_id,))
    
    result = cursor.fetchone()
    actual_current_value = result['total_value'] or 0
    actual_contribution = result['total_contribution'] or 0
    actual_gain = actual_current_value - actual_contribution
    actual_gain_percent = (actual_gain / actual_contribution * 100) if actual_contribution > 0 else 0
    
    print(f"Actual current portfolio value: \${actual_current_value:,.2f}")
    print(f"Actual contribution: \${actual_contribution:,.2f}")
    print(f"Actual gain: \${actual_gain:,.2f} ({actual_gain_percent:.2f}%)")
    
    # Check if snapshots already exist
    cursor.execute('SELECT COUNT(*) as count FROM portfolio_snapshots WHERE user_id = ?', (dummy_user_id,))
    if cursor.fetchone()['count'] > 0:
        print(f"Portfolio snapshots already exist for user '{dummy_user_id}'.")
        conn.close()
        return
    
    # Create historical snapshots for the past 30 days with realistic market patterns
    from datetime import datetime, timedelta, timezone
    import random
    
    base_date = datetime.now(timezone.utc) - timedelta(days=30)
    
    # Start with a realistic lower value that grows to the ACTUAL current value
    # Use a realistic starting point based on typical market performance
    start_multiple = random.uniform(0.78, 0.87)  # Started 78-87% of current value
    current_snapshot_value = actual_current_value * start_multiple
    
    for i in range(30):
        snapshot_date = base_date + timedelta(days=i)
        
        # More realistic daily changes based on actual market volatility
        if snapshot_date.weekday() == 0:  # Monday - often volatile
            daily_change = random.gauss(0.001, 0.018)
        elif snapshot_date.weekday() >= 4:  # Friday/Saturday/Sunday - often quieter
            daily_change = random.gauss(0.0002, 0.008)
        else:  # Regular weekdays
            daily_change = random.gauss(0.0008, 0.012)
        
        # Add realistic market events
        if i > 0:
            # Occasional bad days (market news, etc.)
            if random.random() < 0.08:  # 8% chance
                daily_change -= random.uniform(0.015, 0.035)
            # Occasional very good days
            elif random.random() < 0.05:  # 5% chance
                daily_change += random.uniform(0.020, 0.040)
            # Minor corrections
            elif random.random() < 0.12:  # 12% chance of small dip
                daily_change -= random.uniform(0.005, 0.012)
        
        # Apply the change with realistic bounds
        current_snapshot_value *= (1 + daily_change)
        current_snapshot_value = max(current_snapshot_value, actual_current_value * 0.70)
        current_snapshot_value = min(current_snapshot_value, actual_current_value * 1.05)
        
        # For the last day, ensure we end up at the actual current value
        if i == 29:  # Last day
            current_snapshot_value = actual_current_value
        
        # Keep contribution constant (you don't change your cost basis)
        # Only the portfolio value changes due to market movements
        historical_gain = current_snapshot_value - actual_contribution
        historical_gain_percent = (historical_gain / actual_contribution * 100) if actual_contribution > 0 else 0
        
        # Add tiny realistic noise to final values (market isn't perfect)
        if i < 29:  # Don't add noise to the final day
            value_noise = current_snapshot_value * random.uniform(0.998, 1.002)
            gain_noise = value_noise - actual_contribution
            gain_percent_noise = (gain_noise / actual_contribution * 100) if actual_contribution > 0 else 0
        else:
            value_noise = current_snapshot_value
            gain_noise = historical_gain
            gain_percent_noise = historical_gain_percent
        
        cursor.execute('INSERT OR IGNORE INTO portfolio_snapshots \
            (user_id, captured_at, total_value, total_contribution, total_gain, total_gain_percent) \
            VALUES (?, ?, ?, ?, ?, ?)', (
            dummy_user_id,
            snapshot_date.isoformat(),
            round(value_noise, 2),
            round(actual_contribution, 2),  # Keep contribution constant
            round(gain_noise, 2),
            round(gain_percent_noise, 3)
        ))
    
    conn.commit()
    conn.close()
    print(f"Created 30 days of realistic portfolio snapshots for user '{dummy_user_id}'.")

def create_dummy_user_and_holdings():
    """Insert a dummy user and 15-20 creative holdings."""
    import random
    init_db()  # Ensure schema is up to date
    
    conn = get_db()
    cursor = conn.cursor()

    # Insert dummy user
    dummy_user_id = 'user_alex'
    cursor.execute('INSERT OR IGNORE INTO user_info (user_id, display_name, email) VALUES (?, ?, ?)',
                   (dummy_user_id, 'Alex Chen', 'alex.chen@example.com'))

    # Creative dummy holdings inspired by typical portfolios but with variety
    dummy_holdings = [
        {
            'holding_id': 'holding_alex_001',
            'account_type': 'TFSA',
            'account': 'Alex TFSA',
            'ticker': 'AAPL',
            'name': 'Apple Inc.',
            'category': 'Tech',
            'lookup': 'AAPL',
            'shares': 50,
            'cost': 14500.00,
            'current_price': 175.50,
            'contribution': 14500.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_002',
            'account_type': 'RRSP',
            'account': 'Alex RRSP',
            'ticker': 'MSFT',
            'name': 'Microsoft Corporation',
            'category': 'Tech',
            'lookup': 'MSFT',
            'shares': 35,
            'cost': 11200.00,
            'current_price': 380.20,
            'contribution': 11200.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_003',
            'account_type': 'Non-Registered',
            'account': 'Alex Taxable',
            'ticker': 'GOOGL',
            'name': 'Alphabet Inc.',
            'category': 'Tech',
            'lookup': 'GOOGL',
            'shares': 20,
            'cost': 2400.00,
            'current_price': 140.85,
            'contribution': 2400.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_004',
            'account_type': 'TFSA',
            'account': 'Alex TFSA',
            'ticker': 'NVDA',
            'name': 'NVIDIA Corporation',
            'category': 'Tech',
            'lookup': 'NVDA',
            'shares': 15,
            'cost': 7200.00,
            'current_price': 875.40,
            'contribution': 7200.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_005',
            'account_type': 'RRSP',
            'account': 'Alex RRSP',
            'ticker': 'AMZN',
            'name': 'Amazon.com, Inc.',
            'category': 'Consumer Discretionary',
            'lookup': 'AMZN',
            'shares': 40,
            'cost': 11200.00,
            'current_price': 155.30,
            'contribution': 11200.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_006',
            'account_type': 'TFSA',
            'account': 'Alex TFSA',
            'ticker': 'TSLA',
            'name': 'Tesla, Inc.',
            'category': 'Consumer Discretionary',
            'lookup': 'TSLA',
            'shares': 25,
            'cost': 5000.00,
            'current_price': 245.60,
            'contribution': 5000.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_007',
            'account_type': 'Non-Registered',
            'account': 'Alex Taxable',
            'ticker': 'BRK.B',
            'name': 'Berkshire Hathaway Inc.',
            'category': 'Financial',
            'lookup': 'BRK.B',
            'shares': 30,
            'cost': 9300.00,
            'current_price': 415.80,
            'contribution': 9300.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_008',
            'account_type': 'RRSP',
            'account': 'Alex RRSP',
            'ticker': 'JNJ',
            'name': 'Johnson & Johnson',
            'category': 'Healthcare',
            'lookup': 'JNJ',
            'shares': 50,
            'cost': 13500.00,
            'current_price': 160.45,
            'contribution': 13500.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_009',
            'account_type': 'TFSA',
            'account': 'Alex TFSA',
            'ticker': 'V',
            'name': 'Visa Inc.',
            'category': 'Financial',
            'lookup': 'V',
            'shares': 35,
            'cost': 8750.00,
            'current_price': 260.10,
            'contribution': 8750.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_010',
            'account_type': 'Non-Registered',
            'account': 'Alex Taxable',
            'ticker': 'UNH',
            'name': 'UnitedHealth Group Incorporated',
            'category': 'Healthcare',
            'lookup': 'UNH',
            'shares': 20,
            'cost': 9400.00,
            'current_price': 525.30,
            'contribution': 9400.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_011',
            'account_type': 'RRSP',
            'account': 'Alex RRSP',
            'ticker': 'MA',
            'name': 'Mastercard Incorporated',
            'category': 'Financial',
            'lookup': 'MA',
            'shares': 25,
            'cost': 11250.00,
            'current_price': 465.80,
            'contribution': 11250.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_012',
            'account_type': 'TFSA',
            'account': 'Alex TFSA',
            'ticker': 'HD',
            'name': 'The Home Depot, Inc.',
            'category': 'Consumer Discretionary',
            'lookup': 'HD',
            'shares': 30,
            'cost': 10500.00,
            'current_price': 345.20,
            'contribution': 10500.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_013',
            'account_type': 'Non-Registered',
            'account': 'Alex Taxable',
            'ticker': 'PG',
            'name': 'Procter & Gamble Co.',
            'category': 'Consumer Staples',
            'lookup': 'PG',
            'shares': 60,
            'cost': 10800.00,
            'current_price': 155.60,
            'contribution': 10800.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_014',
            'account_type': 'RRSP',
            'account': 'Alex RRSP',
            'ticker': 'DIS',
            'name': 'The Walt Disney Company',
            'category': 'Communication Services',
            'lookup': 'DIS',
            'shares': 45,
            'cost': 5850.00,
            'current_price': 112.40,
            'contribution': 5850.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_015',
            'account_type': 'TFSA',
            'account': 'Alex TFSA',
            'ticker': 'ADBE',
            'name': 'Adobe Inc.',
            'category': 'Tech',
            'lookup': 'ADBE',
            'shares': 20,
            'cost': 11000.00,
            'current_price': 580.75,
            'contribution': 11000.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_016',
            'account_type': 'Non-Registered',
            'account': 'Alex Taxable',
            'ticker': 'CRM',
            'name': 'Salesforce, Inc.',
            'category': 'Tech',
            'lookup': 'CRM',
            'shares': 25,
            'cost': 6250.00,
            'current_price': 280.30,
            'contribution': 6250.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_017',
            'account_type': 'RRSP',
            'account': 'Alex RRSP',
            'ticker': 'XOM',
            'name': 'Exxon Mobil Corporation',
            'category': 'Energy',
            'lookup': 'XOM',
            'shares': 80,
            'cost': 7200.00,
            'current_price': 105.85,
            'contribution': 7200.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
        {
            'holding_id': 'holding_alex_018',
            'account_type': 'TFSA',
            'account': 'Alex TFSA',
            'ticker': 'KO',
            'name': 'The Coca-Cola Company',
            'category': 'Consumer Staples',
            'lookup': 'KO',
            'shares': 100,
            'cost': 6000.00,
            'current_price': 63.20,
            'contribution': 6000.00,
            'convert_to_cad': False,
            'cad_conversion_rate': None,
        },
    ]

    # Insert holdings for dummy user
    for h in dummy_holdings:
        # Add small random variations to make values look more realistic
        # But keep the math relationship logical
        shares_variation = h['shares'] * random.uniform(0.98, 1.02)
        cost_per_share = h['cost'] / h['shares']  # Calculate original cost per share
        cost_per_share_variation = cost_per_share * random.uniform(0.98, 1.02)
        
        # Current price should be related to cost but with market movement
        price_variation_factor = random.uniform(0.85, 1.25)  # Realistic price movement
        current_price_variation = cost_per_share_variation * price_variation_factor
        
        # Calculate values based on the logical relationships
        cost_variation = shares_variation * cost_per_share_variation
        contribution_variation = cost_variation  # Contribution equals cost
        current_value = shares_variation * current_price_variation
        
        cursor.execute('INSERT OR IGNORE INTO holdings ( \
                holding_id, account_type, account, ticker, name, category, lookup, \
                shares, cost, current_price, contribution, last_updated, \
                is_deleted, track_price, manual_price_override, value_override, \
                convert_to_cad, cad_conversion_rate, user_id \
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', (
            h['holding_id'], h['account_type'], h['account'], h['ticker'], h['name'],
            h['category'], h['lookup'], round(shares_variation, 3), round(cost_variation, 2),
            round(current_price_variation, 3), round(contribution_variation, 2),
            datetime.now(timezone.utc).isoformat(),
            False, True, False, None,
            h['convert_to_cad'], h['cad_conversion_rate'], dummy_user_id
        ))
        
        # Only seed price history if the holding was actually inserted
        if cursor.rowcount > 0:
            cursor.execute('INSERT OR IGNORE INTO price_history (ticker, price, date, updated_at) VALUES (?, ?, ?, ?)',
                           (h['lookup'], round(current_price_variation, 3), datetime.now(timezone.utc).date().isoformat(),
                            datetime.now(timezone.utc).isoformat()))

    conn.commit()
    conn.close()
    print(f"Created dummy user '{dummy_user_id}' with {len(dummy_holdings)} holdings.")
    
    # Seed portfolio snapshots
    seed_portfolio_snapshots_for_dummy_user()

if __name__ == '__main__':
    create_dummy_user_and_holdings()
