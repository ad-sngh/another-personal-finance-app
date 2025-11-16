from flask import Flask, render_template, jsonify, request
import sqlite3
import yfinance as yf
import argparse
from database import get_db, init_db, get_all_holdings, get_holding_by_id, create_holding, update_holding, delete_holding

app = Flask(__name__)

def fetch_price(ticker):
    """Fetch current price for ticker using yfinance"""
    if not ticker or ticker.strip() == '-':
        return None
    
    try:
        stock = yf.Ticker(ticker)
        ticker_info = stock.info
        
        # Try different price fields
        price = ticker_info.get('currentPrice')
        if price is None:
            price = ticker_info.get('regularMarketPrice')
        if price is None:
            price = ticker_info.get('previousClose')
            
        return float(price) if price else None
    except Exception as e:
        print(f"Error fetching price for {ticker}: {e}")
        return None

def calculate_portfolio_stats(holdings):
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
    total_cost = 0
    
    for holding in holdings:
        value = holding['shares'] * holding['current_price']
        total_value += value
        total_cost += holding['cost']
    
    total_gain = total_value - total_cost
    total_gain_percent = (total_gain / total_cost * 100) if total_cost > 0 else 0
    
    return {
        'total_value': total_value,
        'total_cost': total_cost,
        'total_gain': total_gain,
        'total_gain_percent': total_gain_percent,
        'holdings_count': len(holdings)
    }

def enrich_holdings_with_calculations(holdings):
    """Add calculated fields to holdings"""
    portfolio_stats = calculate_portfolio_stats(holdings)
    total_value = portfolio_stats['total_value']
    
    enriched_holdings = []
    for holding in holdings:
        shares = holding['shares']
        current_price = holding['current_price']
        cost = holding['cost']
        
        # Calculated fields
        value = shares * current_price
        portfolio_percentage = (value / total_value * 100) if total_value > 0 else 0
        absolute_gain = value - cost
        relative_gain = (absolute_gain / cost * 100) if cost > 0 else 0
        
        # Cost per share for percent change calculation
        cost_per_share = cost / shares if shares > 0 else 0
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

@app.route('/')
def index():
    """Main holdings view"""
    return render_template('index.html')

@app.route('/edit')
def edit_new():
    """Add new holding form"""
    return render_template('edit.html', holding=None)

@app.route('/edit/<int:id>')
def edit_existing(id):
    """Edit existing holding form"""
    holding = get_holding_by_id(id)
    if not holding:
        return "Holding not found", 404
    return render_template('edit.html', holding=dict(holding))

# API Routes
@app.route('/api/holdings')
def api_get_holdings():
    """Get all holdings with calculations"""
    holdings = [dict(row) for row in get_all_holdings()]
    enriched_holdings, portfolio_stats = enrich_holdings_with_calculations(holdings)
    
    return jsonify({
        'holdings': enriched_holdings,
        'stats': portfolio_stats
    })

@app.route('/api/holdings', methods=['POST'])
def api_create_holding():
    """Create new holding"""
    data = request.get_json()
    
    # Validation
    required_fields = ['account_type', 'account', 'name', 'category', 'shares', 'cost', 'current_price', 'contribution']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Set ticker to empty string if not provided
    if 'ticker' not in data:
        data['ticker'] = ''
    if 'lookup' not in data:
        data['lookup'] = ''
    
    try:
        holding_id = create_holding(data)
        return jsonify({'id': holding_id, 'message': 'Holding created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/holdings/<int:id>', methods=['PUT'])
def api_update_holding(id):
    """Update existing holding"""
    data = request.get_json()
    
    # Validation
    required_fields = ['account_type', 'account', 'name', 'category', 'shares', 'cost', 'current_price', 'contribution']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Set optional fields if not provided
    if 'ticker' not in data:
        data['ticker'] = ''
    if 'lookup' not in data:
        data['lookup'] = ''
    
    try:
        update_holding(id, data)
        return jsonify({'message': 'Holding updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/holdings/<int:id>', methods=['DELETE'])
def api_delete_holding(id):
    """Delete holding"""
    try:
        delete_holding(id)
        return jsonify({'message': 'Holding deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/fetch-price', methods=['POST'])
def api_fetch_price():
    """Fetch current price for a ticker"""
    data = request.get_json()
    ticker = data.get('ticker', '')
    
    if not ticker:
        return jsonify({'error': 'Ticker is required'}), 400
    
    price = fetch_price(ticker)
    if price is not None:
        return jsonify({'ticker': ticker, 'price': price})
    else:
        return jsonify({'error': f'Could not fetch price for {ticker}'}), 404

if __name__ == '__main__':
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Portfolio Tracker Flask Application')
    parser.add_argument('--port', type=int, default=5001, help='Port to run the Flask application on (default: 5001)')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to bind the Flask application to (default: 0.0.0.0)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    args = parser.parse_args()
    
    # Initialize database on startup
    init_db()
    
    print(f"🚀 Starting Portfolio Tracker on http://{args.host}:{args.port}")
    
    app.run(debug=args.debug, host=args.host, port=args.port)
