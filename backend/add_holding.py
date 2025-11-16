#!/usr/bin/env python3
"""
Command-line interface for adding holdings to the portfolio tracker database
"""

import argparse
import sys
from database import init_db, create_holding

def add_holding_interactive():
    """Interactive mode for adding a holding"""
    print("📊 Add New Holding - Interactive Mode")
    print("=" * 40)
    
    # Initialize database
    init_db()
    
    # Collect holding data
    holding_data = {}
    
    # Account Type
    print("\nAccount Types: RRSP, TFSA, Cash, Crypto, Non-registered")
    while True:
        account_type = input("Account Type: ").strip()
        if account_type in ['RRSP', 'TFSA', 'Cash', 'Crypto', 'Non-registered']:
            holding_data['account_type'] = account_type
            break
        print("❌ Invalid account type. Please choose from the list above.")
    
    # Account
    holding_data['account'] = input("Account Name (e.g., Questrade, CIBC): ").strip()
    
    # Ticker
    ticker = input("Ticker (optional, press Enter for cash): ").strip()
    holding_data['ticker'] = ticker
    
    # Name
    holding_data['name'] = input("Holding Name: ").strip()
    
    # Category
    print("\nCategories: ETFs, Stocks, Crypto, Cash")
    while True:
        category = input("Category: ").strip()
        if category in ['ETFs', 'Stocks', 'Crypto', 'Cash']:
            holding_data['category'] = category
            break
        print("❌ Invalid category. Please choose from the list above.")
    
    # Lookup ticker
    lookup = input("Lookup ticker for price fetching (optional): ").strip()
    holding_data['lookup'] = lookup
    
    # Financial data
    holding_data['shares'] = float(input("Number of shares: "))
    holding_data['cost'] = float(input("Total cost: "))
    holding_data['current_price'] = float(input("Current price per share: "))
    holding_data['contribution'] = float(input("Contribution amount: "))
    
    return holding_data

def add_holding_cli(args):
    """Command-line mode for adding a holding"""
    holding_data = {
        'account_type': args.account_type,
        'account': args.account,
        'ticker': args.ticker or '',
        'name': args.name,
        'category': args.category,
        'lookup': args.lookup or '',
        'shares': args.shares,
        'cost': args.cost,
        'current_price': args.current_price,
        'contribution': args.contribution
    }
    return holding_data

def main():
    parser = argparse.ArgumentParser(description='Add a holding to the portfolio tracker')
    parser.add_argument('--interactive', '-i', action='store_true', 
                       help='Run in interactive mode')
    parser.add_argument('--account-type', required=False, 
                       choices=['RRSP', 'TFSA', 'Cash', 'Crypto', 'Non-registered'],
                       help='Account type')
    parser.add_argument('--account', required=False, help='Account name')
    parser.add_argument('--ticker', required=False, help='Ticker symbol')
    parser.add_argument('--name', required=False, help='Holding name')
    parser.add_argument('--category', required=False,
                       choices=['ETFs', 'Stocks', 'Crypto', 'Cash'],
                       help='Category')
    parser.add_argument('--lookup', required=False, help='Lookup ticker for price fetching')
    parser.add_argument('--shares', type=float, required=False, help='Number of shares')
    parser.add_argument('--cost', type=float, required=False, help='Total cost')
    parser.add_argument('--current-price', type=float, required=False, help='Current price per share')
    parser.add_argument('--contribution', type=float, required=False, help='Contribution amount')
    
    args = parser.parse_args()
    
    # Initialize database
    init_db()
    
    # Get holding data
    if args.interactive or not all([args.account_type, args.account, args.name, 
                                   args.category, args.shares is not None, 
                                   args.cost is not None, args.current_price is not None,
                                   args.contribution is not None]):
        holding_data = add_holding_interactive()
    else:
        holding_data = add_holding_cli(args)
    
    # Create the holding
    try:
        holding_id = create_holding(holding_data)
        print(f"\n✅ Successfully added holding!")
        print(f"📝 ID: {holding_id}")
        print(f"💼 {holding_data['name']} ({holding_data['account_type']})")
        print(f"📈 Shares: {holding_data['shares']} @ ${holding_data['current_price']:.2f}")
        print(f"💰 Total Value: ${holding_data['shares'] * holding_data['current_price']:.2f}")
    except Exception as e:
        print(f"\n❌ Error adding holding: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
