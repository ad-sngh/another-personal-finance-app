#!/usr/bin/env python3
"""
Add sample data to the portfolio tracker database
"""

from database import init_db, create_holding

def add_sample_data():
    """Add sample holdings to test the application"""
    
    # Initialize database
    init_db()
    
    sample_holdings = [
        {
            'account_type': 'RRSP',
            'account': 'Questrade',
            'ticker': 'VEQT',
            'name': 'Vanguard All-Equity ETF Portfolio',
            'category': 'ETFs',
            'lookup': 'VEQT.TO',
            'shares': 100,
            'cost': 7310.00,
            'current_price': 84.50,
            'contribution': 7500.00
        },
        {
            'account_type': 'Cash',
            'account': 'Simplii Financial',
            'ticker': '',
            'name': 'High Interest Savings Account',
            'category': 'Cash',
            'lookup': '',
            'shares': 1,
            'cost': 7000.00,
            'current_price': 7000.00,
            'contribution': 7000.00
        },
        {
            'account_type': 'Crypto',
            'account': 'Coinbase',
            'ticker': 'BTC-USD',
            'name': 'Bitcoin',
            'category': 'Crypto',
            'lookup': 'BTC-USD',
            'shares': 0.05,
            'cost': 214.00,
            'current_price': 30000.00,
            'contribution': 250.00
        },
        {
            'account_type': 'TFSA',
            'account': 'Questrade',
            'ticker': 'VEQT',
            'name': 'Vanguard All-Equity ETF Portfolio',
            'category': 'ETFs',
            'lookup': 'VEQT.TO',
            'shares': 120,
            'cost': 7680.00,
            'current_price': 84.50,
            'contribution': 8000.00
        },
        {
            'account_type': 'Non-registered',
            'account': 'CIBC',
            'ticker': 'AAPL',
            'name': 'Apple Inc.',
            'category': 'Stocks',
            'lookup': 'AAPL',
            'shares': 50,
            'cost': 8500.00,
            'current_price': 195.00,
            'contribution': 9000.00
        }
    ]
    
    print("Adding sample data to portfolio tracker...")
    
    for holding_data in sample_holdings:
        try:
            holding_id = create_holding(holding_data)
            print(f"✅ Added: {holding_data['name']} ({holding_data['account_type']})")
        except Exception as e:
            print(f"❌ Error adding {holding_data['name']}: {e}")
    
    print("\nSample data added successfully!")
    print("You can now run the application with: python app.py")

if __name__ == '__main__':
    add_sample_data()
