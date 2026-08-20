# 📝 Deployment Quick Checklist

Use this checklist to track your deployment progress.

---

## 🔧 Backend Deployment (Railway)

### Setup
- [ ] Created Railway account
- [ ] Connected GitHub repository to Railway
- [ ] Created new project in Railway

### Configuration
- [ ] Set Root Directory: `artifacts/api-server`
- [ ] Set Build Command: `pnpm install && pnpm run build`
- [ ] Set Start Command: `node --enable-source-maps ./dist/index.mjs`

### Environment Variables
- [ ] Added `NODE_ENV=production`
- [ ] Added `PORT=3000`
- [ ] Added `ALLOWED_ORIGINS` (will update later with Vercel URL)
- [ ] (Optional) Added `BINGX_API_KEY`
- [ ] (Optional) Added `BINGX_API_SECRET`

### Deployment
- [ ] Triggered first deployment
- [ ] Build completed successfully
- [ ] Generated Railway domain
- [ ] Copied backend URL: `_______________________________`
- [ ] Tested health endpoint: `https://your-url.up.railway.app/api/health`

---

## 🎨 Frontend Deployment (Vercel)

### Setup
- [ ] Created Vercel account
- [ ] Imported GitHub repository
- [ ] Selected `marketai-pro1` repository

### Configuration
- [ ] Set Framework Preset: `Vite`
- [ ] Set Root Directory: `artifacts/marketpulse-ai`
- [ ] Set Build Command: `pnpm install && pnpm run build`
- [ ] Set Output Directory: `dist`
- [ ] Set Install Command: `pnpm install --no-frozen-lockfile`

### Environment Variables
- [ ] Added `VITE_API_BASE_URL` with Railway backend URL
- [ ] Added `VITE_ENABLE_CHART_ANALYSIS=true`

### Deployment
- [ ] Triggered first deployment
- [ ] Build completed successfully
- [ ] Copied frontend URL: `_______________________________`
- [ ] Visited the live site

---

## 🔄 Post-Deployment Configuration

### Update Backend CORS
- [ ] Went back to Railway
- [ ] Updated `ALLOWED_ORIGINS` with Vercel frontend URL
- [ ] Saved and redeployed

### Testing
- [ ] Frontend loads without errors
- [ ] Dashboard displays correctly
- [ ] Market data loads
- [ ] Predictions page works
- [ ] Analytics page works
- [ ] No CORS errors in browser console (F12)
- [ ] Mobile responsive view works

---

## 📝 URLs to Remember

```
Backend (Railway):  https://________________________________
Frontend (Vercel):  https://________________________________
GitHub Repo:        https://github.com/meer4545ahmed/marketai-pro1
```

---

## ⚠️ If Something Goes Wrong

### Backend Issues
1. Check Railway deployment logs
2. Verify all environment variables are set
3. Test health endpoint directly
4. Check start command is correct

### Frontend Issues
1. Check Vercel deployment logs
2. Verify `VITE_API_BASE_URL` is correct
3. Check browser console for errors (F12)
4. Verify build completed successfully

### CORS Issues
1. Ensure `ALLOWED_ORIGINS` matches Vercel URL exactly
2. Include `https://` in the URL
3. No trailing slash
4. Redeploy backend after changing variables

---

## 🎉 Success Criteria

Your deployment is successful when:
- ✅ Backend health check returns JSON response
- ✅ Frontend loads without errors
- ✅ Data flows from backend to frontend
- ✅ All pages are accessible
- ✅ No console errors
- ✅ Application is responsive on mobile

---

**Estimated Total Time**: 30-45 minutes

**Start Time**: _______________
**Completion Time**: _______________

Good luck! 🚀
