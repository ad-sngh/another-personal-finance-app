# 🆓 Zero-Cost Self-Hosting Setup Guide

## 🎯 **Recommended Architecture: GitHub Actions + GitHub Pages**

### **What You Get:**
- ✅ **Free scheduled price capture** (GitHub Actions)
- ✅ **Free frontend hosting** (GitHub Pages)
- ✅ **Free data storage** (Git repository)
- ✅ **Free CI/CD** (Automated deployments)
- ✅ **No credit card required**

---

## 🚀 **Setup Instructions**

### **Step 1: Create GitHub Repository**
```bash
# If not already done
git init
git add .
git commit -m "Initial portfolio tracker"
git branch -M main
git remote add origin https://github.com/yourusername/finance-tracker.git
git push -u origin main
```

### **Step 2: Enable GitHub Pages**
1. Go to your repository on GitHub
2. Settings → Pages
3. Source: Deploy from a branch
4. Branch: main, folder: /root
5. Save

### **Step 3: Enable GitHub Actions**
1. Settings → Actions → General
2. Actions permissions: "Allow all actions"
3. Workflow permissions: "Read and write permissions"
4. Save

### **Step 4: Configure API Endpoint**
Update your frontend to use a production API:
```javascript
// In frontend/static/script.js
// Change from localhost to your API endpoint
const API_BASE = 'https://your-api-endpoint.com'; // We'll set this up
```

---

## 🏗️ **Two Deployment Options**

### **Option A: Full GitHub Actions (Recommended)**
**Price capture via Actions, API via separate service**

**Pros:**
- Completely free
- Reliable scheduling
- No server management

**Cons:**
- Need separate API hosting
- Limited to 2000 minutes/month Actions

### **Option B: Oracle Cloud Free Tier**
**Always-on VM for complete solution**

**Pros:**
- Full control
- Always running
- No time limits

**Cons:**
- Requires credit card (no charges)
- More complex setup

---

## 🎯 **Option A: GitHub Actions Setup (Detailed)**

### **1. Price Capture Automation**
The `.github/workflows/price-capture.yml` file I created will:
- ✅ Run weekdays 9:05 AM - 5:05 PM EST
- ✅ Capture prices for all your holdings
- ✅ Commit price history to repository
- ✅ Manual trigger available for testing

### **2. API Hosting Options**

#### **Option A1: Vercel Functions (Free)**
```bash
# Create api/price-history.js
export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Read from your database file
    const data = await getPriceHistory(req.query.ticker);
    res.json(data);
  }
}
```

#### **Option A2: Render.com (Free Tier)**
- Deploy your FastAPI backend
- Free tier: 750 hours/month
- Sleeps after 15 minutes inactivity (wakes on request)

#### **Option A3: Railway.app (Free Tier)**
- Similar to Render
- $5 credit each month
- Auto-sleeps, wakes on traffic

---

## 🎯 **Option B: Oracle Cloud Free Tier Setup**

### **1. Create Account**
- Sign up at oracle.com/cloud/free
- No charges for free tier resources
- Credit card required for verification only

### **2. Create Compute Instance**
```bash
# Instance specs (FREE):
- Shape: VM.Standard.A1.Flex
- vCPUs: 1 (can use up to 4)
- RAM: 1 GB (can use up to 24 GB)
- Storage: 2 x 100 GB
- Bandwidth: 10 TB/month
```

### **3. Deploy Your App**
```bash
# SSH into your Oracle VM
ssh -i ~/.ssh/your-key opc@your-ip

# Setup your app
sudo apt update
git clone https://github.com/yourusername/finance-tracker.git
cd finance-tracker/backend
pip install -r requirements.txt

# Create systemd service
sudo nano /etc/systemd/system/finance-tracker.service
```

**Service file:**
```ini
[Unit]
Description=Finance Tracker
After=network.target

[Service]
User=opc
WorkingDirectory=/home/opc/finance-tracker/backend
ExecStart=/home/opc/finance-tracker/backend/.venv/bin/python main.py --port 8081
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Start service
sudo systemctl enable finance-tracker
sudo systemctl start finance-tracker

# Setup nginx reverse proxy
sudo apt install nginx
sudo nano /etc/nginx/sites-available/finance-tracker
```

---

## 📊 **Data Storage Options**

### **Option 1: SQLite in Git (Simple)**
- Store `portfolio.db` in repository
- GitHub Actions commits price updates
- Pros: Simple, free, versioned
- Cons: Limited size, public if repo is public

### **Option 2: Free Cloud Database**
- **Supabase**: PostgreSQL, free tier
- **PlanetScale**: MySQL, free tier
- **Railway**: PostgreSQL, $5 credit/month

---

## 🎯 **My Recommendation: Start with GitHub Actions**

### **Why Start Here:**
1. **Zero cost, no credit card**
2. **Perfect for testing** the scheduler
3. **Easy to migrate** later if needed
4. **Learn the workflow** before complex setup

### **Migration Path:**
1. **Start**: GitHub Actions + GitHub Pages
2. **Add**: Free database (Supabase)
3. **Upgrade**: Oracle Cloud if needed

---

## 🚀 **Next Steps**

1. **Push to GitHub**: `git push origin main`
2. **Enable Actions & Pages** in repository settings
3. **Test workflow**: Go to Actions → "Run workflow"
4. **Monitor**: Check Actions tab for price capture runs
5. **Deploy frontend**: Enable GitHub Pages

This gives you a **complete, free, production-ready** portfolio tracker! 🎉
