# 🚨 URGENT: Fix Deployed Web-CMS Azure Configuration

## Problem
Your deployed application at `polyglai-web-cms.vercel.app` is showing these errors:
- ❌ Microsoft Translator not configured
- ❌ Azure Speech Service 401 authentication errors

## Root Cause
The environment variables for Azure services are missing in your Vercel deployment.

## ✅ Solution: Configure Environment Variables in Vercel

### Step 1: Access Vercel Dashboard
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Sign in to your account
3. Find your `polyglai-web-cms` project
4. Click on the project

### Step 2: Add Environment Variables
1. Click **Settings** (in the top navigation)
2. Click **Environment Variables** (in the left sidebar)
3. Add each of these variables one by one:

#### Required Variables:
```env
NEXT_PUBLIC_AZURE_SPEECH_SUBSCRIPTION_KEY
Value: [Your actual Azure Speech Service key - 32+ characters]
Environment: Production, Preview, Development

NEXT_PUBLIC_AZURE_SPEECH_REGION  
Value: southeastasia
Environment: Production, Preview, Development

NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT
Value: https://southeastasia.cognitiveservices.azure.com
Environment: Production, Preview, Development

NEXT_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY
Value: [Your actual Azure Translator Service key - 32+ characters]
Environment: Production, Preview, Development

NEXT_PUBLIC_AZURE_TRANSLATOR_REGION
Value: southeastasia  
Environment: Production, Preview, Development

NEXT_PUBLIC_AZURE_TRANSLATOR_ENDPOINT
Value: https://api.cognitive.microsofttranslator.com
Environment: Production, Preview, Development
```

### Step 3: Get Your Azure Keys
If you don't have your Azure keys:

1. **Azure Speech Service:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to your Speech Service resource
   - Go to **Keys and Endpoint**
   - Copy **Key 1** or **Key 2**

2. **Azure Translator Service:**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to your Translator Service resource  
   - Go to **Keys and Endpoint**
   - Copy **Key 1** or **Key 2**

### Step 4: Redeploy
After adding all environment variables:
1. Go to **Deployments** tab in Vercel
2. Click **Redeploy** on the latest deployment
3. Wait for deployment to complete (2-3 minutes)

### Step 5: Verify Fix
1. Visit your deployed app: `https://polyglai-web-cms.vercel.app`
2. Check that the error messages are gone
3. Test the speech and translation features

## 🔧 Alternative: Use Vercel CLI

If you prefer command line:

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_AZURE_SPEECH_SUBSCRIPTION_KEY
vercel env add NEXT_PUBLIC_AZURE_SPEECH_REGION  
vercel env add NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT
vercel env add NEXT_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY
vercel env add NEXT_PUBLIC_AZURE_TRANSLATOR_REGION
vercel env add NEXT_PUBLIC_AZURE_TRANSLATOR_ENDPOINT

# Redeploy
vercel --prod
```

## 🔍 Testing the Fix

After deployment, you can test by:

1. **Check Environment Loading:**
   - Visit: `https://polyglai-web-cms.vercel.app/test-azure`
   - You should see ✅ instead of ❌ for configurations

2. **Test Speech Service:**
   - Go to user dashboard 
   - Try the speech recognition features
   - Check browser console for errors

3. **Test Translator:**
   - Try translation features in the app
   - Errors should be resolved

## 🚨 Security Notes

- ✅ Environment variables are secure in Vercel
- ✅ `NEXT_PUBLIC_` prefix is required for client-side access
- ✅ Keys are encrypted and not visible in build logs
- ❌ Never commit `.env.local` to git (it's in .gitignore)

## 📞 Need Help?

If you're still getting errors after following these steps:

1. Check that all 6 environment variables are set in Vercel
2. Verify your Azure keys are valid and active
3. Ensure your Azure services are in the `southeastasia` region
4. Check browser console for specific error messages

The fix should resolve both the translator and speech service issues immediately after redeployment.
