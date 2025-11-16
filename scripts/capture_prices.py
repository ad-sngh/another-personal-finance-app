#!/usr/bin/env python3
"""
Price capture script for GitHub Actions
Captures portfolio prices during market hours and stores in database
"""

import sys
import os
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from main import capture_portfolio_prices, is_market_open

def main():
    """Main price capture function"""
    print(f"Running price capture at {datetime.now()}")
    
    # Check if we're in test mode (from GitHub Actions input)
    # GitHub Actions passes booleans as strings 'true'/'false'
    test_mode_str = os.environ.get('INPUT_TEST_MODE', 'false').lower()
    test_mode = test_mode_str in ['true', '1', 'yes']
    
    print(f"Market open: {is_market_open()}")
    print(f"Test mode: {test_mode}")
    
    if test_mode or is_market_open():
        capture_portfolio_prices()
    else:
        print("Market is closed, skipping price capture")

if __name__ == "__main__":
    main()
