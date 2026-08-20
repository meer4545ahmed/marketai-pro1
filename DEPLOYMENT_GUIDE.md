# 🚀 MarketPulse AI - Complete Deployment Guide

This guide will walk you through deploying your MarketPulse AI application with:
- **Frontend**: Vercel
- **Backend API**: Railway

---

## 📋 Prerequisites

Before starting, make sure you have:
- ✅ GitHub account with your repository: https://github.com/meer4545ahmed/marketai-pro1
- ✅ Vercel account (sign up at https://vercel.com)
- ✅ Railway account (sign up at https://railway.app)
- ✅ (Optional) BingX API credentials for live market data

---

## 🎯 Part 1: Deploy Backend to Railway

### Step 1: Connect Railway to Your GitHub Repository

1. **Go to Railway**: https://railway.app
2. **Click "Start a New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Authorize GitHub** if prompted
5. **Select your repository**: `meer4545ahmed/marketai-pro1`

### Step 2: Configure Backend Service

1. After selecting the repository, Railway will detect it
2. **Click "Add variables"** to configure environment variables
3. **Add the following environment variables**:

```env
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

**Optional (for live market data)**:
```env
BINGX_API_KEY=your_api_key_here
BINGX_API_SECRET=your_api_secret_here
```

### Step 3: Configure Build Settings

1. **Click on your service** in Railway dashboard
2. **Go to Settings tab**
3. **Configure these settings**:
   - **Root Directory**: `artifacts/api-server`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `node --enable-source-maps ./dist/index.mjs`
   - **Watch Paths**: `artifacts/api-server/**`

### Step 4: Set Up Custom Domain (Optional but Recommended)

1. In Railway, go to **Settings → Networking**
2. Click **"Generate Domain"** to get a free Railway domain
3. **Copy your backend URL** (e.g., `https://your-app.up.railway.app`)
4. **Save this URL** - you'll need it for the frontend deployment

### Step 5: Deploy Backend

1. **Click "Deploy"** in Railway
2. Wait for the build to complete (2-5 minutes)
3. Check the **"Deployments"** tab for build logs
4. Once deployed, test your API:
   - Visit: `https://your-railway-url.up.railway.app/api/health`
   - You should see: `{"status":"healthy","timestamp":"..."}`

---

## 🎨 Part 2: Deploy Frontend to Vercel

### Step 1: Connect Vercel to Your GitHub Repository

1. **Go to Vercel**: https://vercel.com
2. **Click "Add New..." → Project**
3. **Import your repository**: `meer4545ahmed/marketai-pro1`
4. **Click "Import"**

### Step 2: Configure Frontend Project

1. **Configure Build Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `artifacts/marketpulse-ai`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install --no-frozen-lockfile`

2. **Add Environment Variables** (click "Environment Variables"):

```env
VITE_API_BASE_URL=https://your-railway-backend.up.railway.app
VITE_ENABLE_CHART_ANALYSIS=true
```

**Important**: Replace `https://your-railway-backend.up.railway.app` with your actual Railway backend URL from Part 1, Step 4.

### Step 3: Deploy Frontend

1. **Click "Deploy"**
2. Wait for the build to complete (3-7 minutes)
3. Once deployed, Vercel will give you a URL like: `https://your-app.vercel.app`

### Step 4: Update Backend CORS Settings

Now that you have your frontend URL, you need to update the backend to allow requests from it:

1. **Go back to Railway**
2. **Open your backend service**
3. **Go to Variables tab**
4. **Update the `ALLOWED_ORIGINS` variable**:
   ```
   ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   ```
   (Replace with your actual Vercel URL)
5. **Save** - Railway will automatically redeploy

### Step 5: Test Your Deployment

1. **Visit your Vercel frontend URL**
2. You should see the MarketPulse AI dashboard
3. Test the following features:
   - ✅ Dashboard loads
   - ✅ Market data displays
   - ✅ Predictions work
   - ✅ Analytics show correctly

---

## 🔧 Part 3: Optional - Deploy Python Chart Analysis Service

If you want to deploy the chart analysis service (Python/FastAPI):

### Option A: Deploy to Railway (Recommended)

1. **Create a new service** in Railway
2. **Connect to same GitHub repository**
3. **Configure settings**:
   - **Root Directory**: `chart-analysis-service`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**:
     ```env
     PORT=8000
     PYTHONUNBUFFERED=1
     ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
     ```

### Option B: Skip for Now

The chart analysis service is optional. The main application will work without it.

---

## ✅ Verification Checklist

After deployment, verify everything works:

- [ ] Backend API is accessible at Railway URL
- [ ] Backend health check returns: `https://your-railway-url.up.railway.app/api/health`
- [ ] Frontend loads at Vercel URL
- [ ] Frontend can fetch data from backend
- [ ] Dashboard displays market data
- [ ] Predictions page works
- [ ] Analytics page loads
- [ ] No CORS errors in browser console (F12)

---

## 🐛 Common Issues & Solutions

### Issue 1: CORS Errors
**Problem**: Frontend can't connect to backend
**Solution**: 
1. Check `ALLOWED_ORIGINS` in Railway matches your Vercel URL exactly
2. Include `https://` prefix
3. No trailing slash

### Issue 2: Build Fails on Vercel
**Problem**: "pnpm: command not found"
**Solution**:
1. Go to Vercel project settings
2. Under "Build & Development Settings"
3. Set Install Command: `npm install -g pnpm && pnpm install`

### Issue 3: Backend Build Fails on Railway
**Problem**: "Cannot find workspace dependencies"
**Solution**:
1. Make sure Root Directory is set to `artifacts/api-server`
2. Check that build command includes `pnpm install`

### Issue 4: Environment Variables Not Working
**Problem**: App doesn't read env variables
**Solution**:
1. For Vercel: Variables must start with `VITE_`
2. For Railway: Redeploy after adding variables
3. Check for typos in variable names

### Issue 5: API Returns 404
**Problem**: API endpoints return 404
**Solution**:
1. Check Railway logs for errors
2. Verify backend is running on correct PORT
3. Ensure start command is correct

---

## 📊 Monitoring Your Deployment

### Railway (Backend)
- **Logs**: Click on service → "Deployments" tab
- **Metrics**: "Metrics" tab shows CPU/RAM usage
- **Health**: Visit `/api/health` endpoint

### Vercel (Frontend)
- **Analytics**: Dashboard shows page views
- **Logs**: "Functions" tab (if using serverless functions)
- **Performance**: "Speed Insights" shows load times

---

## 🔄 Continuous Deployment

Both Railway and Vercel are configured for continuous deployment:

1. **Push changes** to your GitHub repository
2. **Automatic builds** trigger on both platforms
3. **Deployments** happen automatically

To disable auto-deploy:
- **Railway**: Settings → Triggers → Disable automatic deploys
- **Vercel**: Settings → Git → Pause

---

## 🎉 Next Steps

After successful deployment:

1. ✅ **Test all features** thoroughly
2. ✅ **Set up custom domains** (optional)
3. ✅ **Configure monitoring** and alerts
4. ✅ **Enable analytics** (Vercel Analytics/Google Analytics)
5. ✅ **Set up database** if needed (Railway PostgreSQL)
6. ✅ **Add SSL certificates** (automatic on both platforms)

---

## 💡 Tips for Success

1. **Start with Backend First**: Deploy Railway before Vercel
2. **Test Each Step**: Verify backend works before deploying frontend
3. **Save URLs**: Keep track of your Railway and Vercel URLs
4. **Check Logs**: Always check deployment logs if something fails
5. **Environment Variables**: Double-check spelling and values
6. **CORS Settings**: Must match exactly (including https://)

---

## 📞 Support & Resources

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **GitHub Repository**: https://github.com/meer4545ahmed/marketai-pro1

---

## 🚨 Important Security Notes

1. **Never commit** `.env` files to GitHub
2. **Use environment variables** for all secrets
3. **Rotate API keys** regularly
4. **Enable HTTPS** only (both platforms do this automatically)
5. **Limit CORS** to your specific frontend domain

---

Good luck with your deployment! 🚀
