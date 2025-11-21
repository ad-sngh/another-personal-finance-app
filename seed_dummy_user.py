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

def create_dummy_user_and_holdings():
    """Insert a dummy user and 15-20 creative holdings."""
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
        cursor.execute('''
            INSERT INTO holdings (
                holding_id, account_type, account, ticker, name, category, lookup,
                shares, cost, current_price, contribution, last_updated,
                is_deleted, track_price, manual_price_override, value_override,
                convert_to_cad, cad_conversion_rate, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            h['holding_id'], h['account_type'], h['account'], h['ticker'], h['name'],
            h['category'], h['lookup'], h['shares'], h['cost'], h['current_price'],
            h['contribution'], datetime.now(timezone.utc).isoformat(),
            False, True, False, None,
            h['convert_to_cad'], h['cad_conversion_rate'], dummy_user_id
        ))
        # Seed price history entry so charts work
        cursor.execute('INSERT OR IGNORE INTO price_history (ticker, price, date, updated_at) VALUES (?, ?, ?, ?)',
                       (h['lookup'], h['current_price'], datetime.now(timezone.utc).date().isoformat(),
                        datetime.now(timezone.utc).isoformat()))

    conn.commit()
    conn.close()
    print(f"Created dummy user '{dummy_user_id}' with {len(dummy_holdings)} holdings.")

if __name__ == '__main__':
    create_dummy_user_and_holdings()
