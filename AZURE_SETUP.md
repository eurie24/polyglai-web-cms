# Azure Services Setup Guide

This guide explains how to configure Azure Speech Service and Azure Translator Service for the web application.

## 🚀 Quick Setup

### 1. Create Environment File

Create a `.env.local` file in the root of your `web-cms` project:

```bash
# Navigate to web-cms directory
cd web-cms

# Create .env.local file
touch .env.local
```

### 2. Add Your Azure Credentials

Edit `.env.local` and add your Azure credentials:

```env
# Azure Speech Service
NEXT_PUBLIC_AZURE_SPEECH_SUBSCRIPTION_KEY=your_actual_speech_subscription_key_here
NEXT_PUBLIC_AZURE_SPEECH_REGION=southeastasia
NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT=https://southeastasia.cognitiveservices.azure.com

# Azure Translator Service
NEXT_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY=your_actual_translator_subscription_key_here
NEXT_PUBLIC_AZURE_TRANSLATOR_REGION=southeastasia
NEXT_PUBLIC_AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
```

### 3. Get Your Azure Credentials

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your **Speech Service** resource
3. Go to **Keys and Endpoint** section
4. Copy **Key 1** or **Key 2**
5. Copy your **Region** (e.g., `southeastasia`)
6. Copy your **Endpoint** URL

## 🔧 Configuration Details

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_AZURE_SPEECH_SUBSCRIPTION_KEY` | Your Azure Speech Service subscription key | `your_azure_speech_subscription_key_here` |
| `NEXT_PUBLIC_AZURE_SPEECH_REGION` | Azure region for Speech Service | `southeastasia` |
| `NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT` | Full endpoint URL for Speech Service | `https://southeastasia.cognitiveservices.azure.com` |
| `NEXT_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY` | Your Azure Translator subscription key | `your_azure_translator_subscription_key_here` |
| `NEXT_PUBLIC_AZURE_TRANSLATOR_REGION` | Azure region for Translator Service | `southeastasia` |
| `NEXT_PUBLIC_AZURE_TRANSLATOR_ENDPOINT` | Full endpoint URL for Translator Service | `https://api.cognitive.microsofttranslator.com` |

### Why `NEXT_PUBLIC_` Prefix?

The `NEXT_PUBLIC_` prefix is required for Next.js to expose environment variables to the client-side code. This is necessary because speech recognition runs in the browser.

## 🧪 Testing Your Configuration

### 1. Test Azure Speech Service

1. Start your development server: `npm run dev`
2. Go to the user dashboard
3. Click the **"Test Azure"** button (blue button)
4. Check the console for configuration status

### 2. Expected Console Output

```
🔍 AZURE SPEECH SERVICE DEBUG:
Service configured: true
Service info: {
  configured: true,
  subscriptionKey: "your_azure_speech_subscription_key_here",
  region: "southeastasia",
  endpoint: "https://southeastasia.cognitiveservices.azure.com",
  availableLanguages: 100
}
Testing Azure Speech Service connection...
Connection test result: true
```

## 🚨 Troubleshooting

### Common Issues

#### 1. "Service configured: false"
- Check that your `.env.local` file exists
- Verify your subscription key is correct
- Ensure the key is at least 32 characters long

#### 2. "Connection test result: false"
- Verify your Azure Speech Service is active
- Check that the region supports Speech Services
- Ensure your subscription has Speech Services enabled

#### 3. "404 Not Found" errors
- The system will automatically try alternative endpoints
- Check that your region supports the Speech Service
- Verify your endpoint URL format

### Alternative Configuration

If you prefer to hardcode credentials (not recommended for production), you can edit `app/config/azure-config.ts`:

```typescript
export const azureConfig = {
  speech: {
    subscriptionKey: 'your_actual_key_here',
    region: 'southeastasia',
    endpoint: 'https://southeastasia.cognitiveservices.azure.com',
  },
  // ... rest of config
};
```

## 🔒 Security Notes

- **Never commit** `.env.local` to version control
- **Never share** your subscription keys publicly
- Use **environment variables** in production deployments
- Consider using **Azure Key Vault** for production environments

## 📚 Additional Resources

- [Azure Speech Service Documentation](https://docs.microsoft.com/azure/cognitive-services/speech-service/)
- [Azure Translator Documentation](https://docs.microsoft.com/azure/cognitive-services/translator/)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Azure Portal](https://portal.azure.com)

## 🆘 Need Help?

If you encounter issues:

1. Check the browser console for error messages
2. Verify your Azure credentials are correct
3. Ensure your Azure services are active and accessible
4. Check that your region supports the required services

The system includes comprehensive error logging and will automatically try alternative configurations to resolve common issues.
