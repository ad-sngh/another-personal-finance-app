# Portfolio Price Capture Scheduler

## 🏗 **Architecture Overview**

The price capture system is now implemented using **APScheduler** within your FastAPI backend.

### ✅ **Current Implementation**

**What's Working:**
- ✅ **Scheduler**: Runs every hour at 5 minutes past the hour
- ✅ **Market Hours**: Only runs weekdays 9AM-5PM EST
- ✅ **Price Storage**: Automatically stores in `price_history` table
- ✅ **API Endpoints**: Manual trigger and status checking
- ✅ **Error Handling**: Graceful failure handling

### 📅 **Schedule Details**

```python
# Runs at these times (EST):
Monday-Friday: 9:05 AM, 10:05 AM, 11:05 AM, 12:05 PM, 1:05 PM, 2:05 PM, 3:05 PM, 4:05 PM, 5:05 PM
```

## 🌐 **Hosting Options**

### **Option 1: Local/Development (Current)**
```bash
# Start backend with scheduler
cd backend
./start.sh --port 8081 --reload
```

**Pros:** Simple, no additional cost
**Cons:** Must keep your computer running 24/7

### **Option 2: Cloud Hosting (Recommended for Production)**

#### **A. VPS Hosting ($5-20/month)**
- **DigitalOcean**, **Linode**, **Vultr**
- Deploy FastAPI + run as systemd service
- Full control, reliable

#### **B. Platform as a Service**
- **Render.com**: Free tier available, easy deployment
- **Railway.app**: Simple FastAPI deployment
- **Fly.io**: Global deployment

#### **C. Serverless + Cron**
- **AWS Lambda** + **EventBridge**
- **Google Cloud Functions** + **Cloud Scheduler**
- **GitHub Actions** (free, runs on schedule)

## 🚀 **Production Deployment Example**

### **Simple VPS Setup:**

```bash
# 1. Get a VPS (DigitalOcean $6/month)
# 2. Install dependencies
sudo apt update
sudo apt install python3-pip nginx

# 3. Deploy your code
git clone your-repo
cd finance/backend
pip install -r requirements.txt

# 4. Create systemd service
sudo nano /etc/systemd/system/finance-tracker.service
```

**Service file:**
```ini
[Unit]
Description=Finance Tracker
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/finance/backend
ExecStart=/home/ubuntu/finance/backend/.venv/bin/python main.py --port 8081
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# 5. Start service
sudo systemctl enable finance-tracker
sudo systemctl start finance-tracker

# 6. Setup nginx reverse proxy
# 7. Add SSL certificate
```

## 📊 **Monitoring & Testing**

### **API Endpoints:**
```bash
# Check scheduler status
curl http://localhost:8081/api/scheduler-status

# Manual trigger (for testing)
curl -X POST http://localhost:8081/api/capture-prices

# Check price history
curl http://localhost:8081/api/price-history/AAPL
```

### **Log Monitoring:**
```bash
# View logs
tail -f /var/log/finance-tracker.log

# Check systemd service
sudo systemctl status finance-tracker
```

## 🎯 **Next Steps**

### **For Development:**
1. ✅ **Scheduler is working** - test with manual trigger
2. ✅ **Prices are being captured** - check price history table
3. ✅ **Sparklines will update** - as more data accumulates

### **For Production:**
1. **Choose hosting option** (VPS recommended for full control)
2. **Set up monitoring** (logs, alerts, health checks)
3. **Configure backup** (database backups)
4. **Add error notifications** (email/Slack on failures)

## 💡 **Features You Now Have**

- ✅ **Automatic price tracking** during market hours
- ✅ **Historical data storage** for trend analysis
- ✅ **Sparkline visualization** of price trends
- ✅ **Portfolio value history** tracking
- ✅ **Manual override** for testing
- ✅ **Market hours awareness** (no weekend runs)

The system is ready to run 24/7 and will build a comprehensive price history for your portfolio!
