# Vercel Deployment Checklist

## ✅ Completed Changes

### 1. Removed Deprecated Supabase Package
- ✅ Removed `@supabase/auth-helpers-nextjs` (deprecated)
- ✅ Installed `@supabase/ssr` for better Next.js 16 compatibility
- ✅ Updated client-side Supabase client to use `createBrowserClient` from `@supabase/ssr`

### 2. Added Node.js Version Requirement
- ✅ Added `"engines": { "node": ">=20.0.0" }` to `package.json`
- This ensures Vercel uses Node.js 20.x or higher

### 3. Fixed All TypeScript Errors
- ✅ Fixed route handler params to use `context` parameter pattern
- ✅ Fixed all implicit `any` type errors
- ✅ Fixed React Query `onSuccess` callback (replaced with `useEffect`)

## 🔧 Vercel Configuration Steps

### 1. Verify Node.js Version
1. Go to your Vercel Dashboard → Project Settings → General
2. Ensure **Node.js Version** is set to **20.x** or **22.x**
3. The `package.json` now specifies `>=20.0.0`, but verify in Vercel settings

### 2. Verify Environment Variables
Ensure these environment variables are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (should be your production URL)
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `NEXT_PUBLIC_TMDB_API_KEY` (if used)
- `NEXT_PUBLIC_OMDB_API_KEY` (if used)
- `NEXT_PUBLIC_YOUTUBE_API_KEY` (if used)
- `API_KEY` (for Google GenAI, if used)

**To add/verify:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add any missing variables
3. Ensure they're available for **Production**, **Preview**, and **Development** environments

### 3. Optional: Memory Optimization
If you encounter memory issues during build, you can:
1. Go to Vercel Dashboard → Project Settings → General
2. Change the build command to:
   ```
   NODE_OPTIONS='--max-old-space-size=4096' next build
   ```

### 4. Clear Build Cache (if needed)
If you're still seeing old build errors:
1. Go to Vercel Dashboard → Deployments
2. Click on the three dots (⋯) next to a deployment
3. Select "Redeploy" and check "Use existing Build Cache" to **OFF**

## 📝 Next Steps

1. **Commit and push all changes:**
   ```bash
   git add .
   git commit -m "Upgrade Supabase, add Node.js requirement, fix TypeScript errors"
   git push
   ```

2. **Monitor the deployment** in Vercel Dashboard

3. **Check build logs** if any errors occur

## 🎯 Expected Results

After these changes:
- ✅ No more deprecation warnings for `@supabase/auth-helpers-nextjs`
- ✅ Build should complete successfully
- ✅ All route handlers use correct Next.js 16 patterns
- ✅ TypeScript compilation should pass
- ✅ Node.js 20.x will be used on Vercel

## ⚠️ Notes

- The `node-domexception` warning is harmless and can be ignored
- The build should now work with Next.js 16.1.1
- All route handlers are properly typed for Next.js 16's Promise-based params

