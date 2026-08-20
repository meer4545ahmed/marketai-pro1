# ⚡ Quick Start - Deploy in 15 Minutes

Follow these steps exactly to deploy MarketPulse AI.

---

## 🎯 Part 1: Backend (Railway) - 7 minutes

### Step 1: Create Railway Project (2 min)
1. Go to **https://railway.app**
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose **`meer4545ahmed/marketai-pro1`**

### Step 2: Configure Service (3 min)
1. Click **Settings** → **Build & Deploy**
2. Set these values:
   ```
   Root Directory: artifacts/api-server
   Build Command: pnpm install && pnpm run build
   Start Command: node --enable-source-maps ./dist/index.mjs
   ```

### Step 3: Add Environment Variables (2 min)
Click **Variables** tab and add:
```env
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=temporary
```

### Step 4: Deploy & Get URL
1. Click **Deploy**
2. Wait for build to complete
3. Go to **Settings → Networking → Generate Domain**
4. **Copy your URL**: `https://_____.up.railway.app`
5. Test: Visit `https://your-url.up.railway.app/api/health`

✅ **Backend is live!**

---

## 🎨 Part 2: Frontend (Vercel) - 5 minutes

### Step 1: Import Project (1 min)
1. Go to **https://vercel.com**
2. Click **"Add New..." → Project**
3. Select **`meer4545ahmed/marketai-pro1`**
4. Click **Import**

### Step 2: Configure Build (2 min)
1. Set **Root Directory**: `artifacts/marketpulse-ai`
2. Keep **Framework Preset**: `Vite`
3. Build settings (should auto-detect):
   ```
   Build Command: pnpm install && pnpm run build
   Output Directory: dist
   Install Command: pnpm install --no-frozen-lockfile
   ```

### Step 3: Add Environment Variables (1 min)
Click **Environment Variables** and add:
```env
VITE_API_BASE_URL=https://your-railway-url.up.railway.app
VITE_ENABLE_CHART_ANALYSIS=true
```
Replace with your actual Railway URL from Part 1!

### Step 4: Deploy (1 min)
1. Click **Deploy**
2. Wait 3-5 minutes
3. **Copy your Vercel URL**: `https://_____.vercel.app`

✅ **Frontend is live!**

---

## 🔄 Part 3: Connect Them (3 minutes)

### Update Backend CORS
1. Go back to **Railway**
2. Click **Variables**
3. Edit **ALLOWED_ORIGINS**:
   ```
   ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
   ```
   (Use your actual Vercel URL)
4. **Save** (Railway auto-redeploys)

### Test Everything
1. Visit your **Vercel URL**
2. Open **Browser Console** (F12)
3. Check for errors
4. Test navigation:
   - Dashboard ✅
   - Predictions ✅
   - Analytics ✅

---

## 🎉 Done!

Your app is now live at:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-app.up.railway.app`

---

## 🐛 Quick Fixes

**Problem**: CORS Error
→ **Fix**: Update `ALLOWED_ORIGINS` in Railway with exact Vercel URL

**Problem**: Build fails
→ **Fix**: Check Root Directory is set correctly

**Problem**: API not responding
→ **Fix**: Check Railway logs in Deployments tab

---

## 📚 Need More Help?

Read the full guide: `DEPLOYMENT_GUIDE.md`

---

**Total Time**: ~15 minutes
**Difficulty**: Easy 😊
