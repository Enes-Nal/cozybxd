# Fixing "Invalid OAuth2 redirect_uri" Error on Vercel

This error occurs when the OAuth redirect URI doesn't match between Discord and your Vercel deployment.

## Step 1: Set NEXTAUTH_URL in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add or update the `NEXTAUTH_URL` variable:
   - **Name**: `NEXTAUTH_URL`
   - **Value**: `https://your-app-name.vercel.app` (replace with your actual Vercel URL)
   - **Environment**: Select **Production**, **Preview**, and **Development**
3. Click **Save**

## Step 2: Update Discord OAuth Settings

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to **OAuth2** → **General**
4. In the **Redirects** section, add your Vercel callback URL:
   ```
   https://your-app-name.vercel.app/api/auth/callback/discord
   ```
5. If you're using preview deployments, also add:
   ```
   https://your-preview-branch.vercel.app/api/auth/callback/discord
   ```
6. Click **Save Changes**

## Step 3: Redeploy on Vercel

After updating the environment variables:
1. Go to **Vercel Dashboard** → **Deployments**
2. Click the three dots (⋯) on the latest deployment
3. Select **Redeploy**
4. This will pick up the new `NEXTAUTH_URL` environment variable

## Step 4: Verify the Redirect URI Format

The redirect URI must match exactly:
- ✅ Correct: `https://your-app.vercel.app/api/auth/callback/discord`
- ❌ Wrong: `https://your-app.vercel.app/api/auth/callback/discord/`
- ❌ Wrong: `https://your-app.vercel.app/callback/discord`

## Troubleshooting

### Still getting the error?

1. **Check Vercel Environment Variables**:
   - Ensure `NEXTAUTH_URL` is set correctly
   - Ensure it doesn't have a trailing slash
   - Ensure it matches your actual Vercel domain

2. **Check Discord Redirect URIs**:
   - Must include `https://` (not `http://`)
   - Must end with `/api/auth/callback/discord`
   - No trailing slashes

3. **Clear Browser Cache**:
   - Try in an incognito/private window
   - Clear cookies for your Vercel domain

4. **Check Vercel Domain**:
   - If you have a custom domain, make sure `NEXTAUTH_URL` uses the custom domain
   - Or add both the Vercel domain and custom domain to Discord redirects

## Example Configuration

**Vercel Environment Variable:**
```
NEXTAUTH_URL=https://cozybxd.vercel.app
```

**Discord OAuth Redirect URI:**
```
https://cozybxd.vercel.app/api/auth/callback/discord
```

## Additional Notes

- The code has been updated to explicitly use `NEXTAUTH_URL` in the NextAuth configuration
- After updating environment variables, you must redeploy for changes to take effect
- Preview deployments will use the preview URL, so you may need to add multiple redirect URIs in Discord

