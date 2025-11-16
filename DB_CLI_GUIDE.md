# Portfolio Database CLI Guide

## 🗄️ **Database Interaction Tool**

You now have a powerful CLI tool to interact with your portfolio database directly!

### 🚀 **Quick Start**

```bash
# From backend directory (recommended)
cd backend
uv run python ../db_cli.py --help

# Or from root directory
uv run python db_cli.py --help
```

## 📊 **Available Commands**

### **1. View Price History**
```bash
# All price history
uv run python ../db_cli.py history

# Specific ticker
uv run python ../db_cli.py history --ticker AAPL

# Limit results
uv run python ../db_cli.py history --ticker AAPL --limit 10
```

### **2. Add Price Data**
```bash
# Add today's price
uv run python ../db_cli.py add-price AAPL 275.50

# Add historical price
uv run python ../db_cli.py add-price AAPL 275.50 --date 2025-11-17
```

### **3. View Holdings**
```bash
# All holdings
uv run python ../db_cli.py holdings

# Active holdings only
uv run python ../db_cli.py holdings --active-only
```

### **4. Portfolio Statistics**
```bash
# Summary stats and coverage
uv run python ../db_cli.py stats
```

### **5. Delete Price Data**
```bash
# Delete specific date
uv run python ../db_cli.py delete --ticker AAPL --date 2025-11-17

# Delete all ticker history
uv run python ../db_cli.py delete --ticker AAPL
```

### **6. Bulk Import (CSV)**
```bash
# Create CSV with columns: ticker,price,date
uv run python ../db_cli.py import prices.csv
```

## 🎯 **Use Cases**

### **Testing Price History**
```bash
# Add fake historical data for testing
uv run python ../db_cli.py add-price AAPL 270.00 --date 2025-11-15
uv run python ../db_cli.py add-price AAPL 272.50 --date 2025-11-16
uv run python ../db_cli.py add-price AAPL 275.00 --date 2025-11-17

# Check the results
uv run python ../db_cli.py history --ticker AAPL
```

### **Portfolio Analysis**
```bash
# See portfolio breakdown
uv run python ../db_cli.py stats

# Check which tickers have price history
uv run python ../db_cli.py history
```

### **Data Management**
```bash
# Clean up bad data
uv run python ../db_cli.py delete --ticker BAD-TICKER

# Import from external source
uv run python ../db_cli.py import historical_prices.csv
```

## 📁 **Database Location**

The database file is located at:
```
/Users/adityabhushansingh/Documents/Personal/learn/git-repos/finance/backend/portfolio.db
```

## 🔧 **Direct SQL Access**

You can also query the database directly:

```bash
# Using sqlite3 command line
sqlite3 backend/portfolio.db

# SQLite commands
.tables                    # Show all tables
SELECT * FROM price_history LIMIT 5;
SELECT * FROM holdings WHERE ticker = 'AAPL';
```

## 🌐 **API vs Direct Access**

| Method | Pros | Cons |
|--------|------|------|
| **API** | Safe, validated, always available | Slower, requires backend running |
| **CLI** | Fast, flexible, bulk operations | Direct access, needs file access |
| **SQL** | Maximum control, complex queries | Risky, no validation |

**Recommendation:** Use CLI for data management, API for application usage.

## 📈 **Sample CSV for Bulk Import**

```csv
ticker,price,date
AAPL,270.00,2025-11-15
AAPL,272.50,2025-11-16
AAPL,275.00,2025-11-17
BTC-USD,95000,2025-11-15
BTC-USD,93742,2025-11-16
```

Save as `prices.csv` and import with:
```bash
uv run python ../db_cli.py import prices.csv
```

Now you have full control over your portfolio data! 🎉
