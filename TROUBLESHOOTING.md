# 🔧 Azure Speech Service Troubleshooting Guide

If you're still getting 404 errors after setting up your environment variables, follow this troubleshooting guide.

## 🚨 Quick Diagnostic Steps

### 1. **Check Your Environment Variables**
```bash
# In your web-cms directory, run:
node test-env.js
```

**Expected Output:**
```
✅ .env.local file loaded
📋 Environment Variables Status:
🎤 Azure Speech Service:
   Subscription Key: ✅ Set
   Key Preview: N3I3OyBI8...SpWh
   Key Length: 64 characters
   Region: ✅ southeastasia
   Endpoint: ✅ https://southeastasia.cognitiveservices.azure.com
```

### 2. **Use the Test Page**
1. Go to: `http://localhost:3000/test-azure`
2. Click "Run Tests"
3. Check the results and recommendations

### 3. **Check Browser Console**
1. Open Developer Tools (F12)
2. Go to Console tab
3. Click "Run Diagnostics" button in dashboard
4. Look for detailed error messages

## 🔍 Common Issues & Solutions

### **Issue 1: All API Paths Return 404**

**Symptoms:**
- Console shows "API path not found" for all paths
- All endpoints fail with 404 errors

**Possible Causes:**
1. **Azure Speech Service not enabled** in your subscription
2. **Wrong region** - region doesn't support Speech Services
3. **Invalid subscription key** - key doesn't have Speech Services permissions
4. **Service resource not created** - you need to create a Speech Service resource

**Solutions:**

#### **A. Verify Azure Speech Service is Created**
1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "Speech Services" in the search bar
3. Check if you have any Speech Service resources
4. If none exist, create one:
   - Click "Create"
   - Choose "Speech Services"
   - Select your subscription and region
   - Give it a name
   - Click "Review + Create"

#### **B. Check Region Support**
Not all Azure regions support Speech Services. Try these regions:
- `eastus` (East US)
- `westus2` (West US 2)
- `southeastasia` (Southeast Asia) - **Your current region**
- `westeurope` (West Europe)
- `eastasia` (East Asia)

#### **C. Verify Subscription Key Permissions**
1. Go to your Speech Service resource in Azure Portal
2. Click "Keys and Endpoint" in the left menu
3. Copy "Key 1" or "Key 2"
4. Make sure you're using the correct key

### **Issue 2: Network/Firewall Blocking**

**Symptoms:**
- All requests fail with network errors
- CORS errors in console
- "Failed to fetch" errors

**Solutions:**
1. **Check your internet connection**
2. **Disable VPN** if you're using one
3. **Check firewall settings** - ensure Azure domains are allowed
4. **Try from a different network** (mobile hotspot, different WiFi)

### **Issue 3: Invalid Endpoint Format**

**Symptoms:**
- Configuration looks correct but still fails
- Endpoint URL format issues

**Correct Endpoint Formats:**
```env
# For Azure Cognitive Services (most common)
NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT=https://southeastasia.cognitiveservices.azure.com

# Alternative formats to try:
NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT=https://southeastasia.api.cognitive.microsoft.com
NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT=https://southeastasia.stt.speech.microsoft.com
```

## 🧪 Advanced Testing

### **Test Network Connectivity**
```bash
# Test if you can reach Azure services
curl -I https://southeastasia.cognitiveservices.azure.com
curl -I https://api.cognitive.microsoft.com
```

### **Test with Azure CLI**
```bash
# Install Azure CLI if you haven't
az login
az cognitiveservices account list --resource-group YOUR_RESOURCE_GROUP
```

### **Test with Postman/Insomnia**
1. Create a POST request to: `https://southeastasia.cognitiveservices.azure.com/speechtotext/v3.1/recognize`
2. Add header: `Ocp-Apim-Subscription-Key: YOUR_KEY`
3. Add header: `Content-Type: audio/wav`
4. Send a small audio file as body
5. Check response status

## 🆘 Still Having Issues?

### **Step 1: Check Azure Service Status**
- Go to [Azure Status](https://status.azure.com/)
- Check if Speech Services are having issues

### **Step 2: Create New Speech Service**
1. Delete existing Speech Service resource
2. Create a new one in a different region
3. Use the new credentials

### **Step 3: Check Azure Support**
- Go to [Azure Support](https://azure.microsoft.com/support/)
- Create a support ticket for Speech Services

### **Step 4: Alternative Solutions**
If Azure Speech Service continues to fail, consider:
1. **Google Speech-to-Text API**
2. **Amazon Transcribe**
3. **Browser Web Speech API** (fallback)

## 📋 Checklist

- [ ] `.env.local` file created with correct credentials
- [ ] Development server restarted after adding environment variables
- [ ] Azure Speech Service resource exists in Azure Portal
- [ ] Subscription key copied from correct resource
- [ ] Region supports Speech Services
- [ ] No firewall/proxy blocking Azure services
- [ ] Test page shows configuration is correct
- [ ] Diagnostics provide specific recommendations

## 🔗 Useful Links

- [Azure Speech Service Documentation](https://docs.microsoft.com/azure/cognitive-services/speech-service/)
- [Azure Portal](https://portal.azure.com)
- [Azure Status](https://status.azure.com/)
- [Azure Support](https://azure.microsoft.com/support/)

## 💡 Pro Tips

1. **Always restart your dev server** after changing environment variables
2. **Check the browser console** for detailed error messages
3. **Use the test page** (`/test-azure`) for comprehensive diagnostics
4. **Verify in Azure Portal** that your Speech Service is running
5. **Try different regions** if your current region has issues

---

**Need more help?** Run the diagnostics in the test page and share the console output with detailed error messages.
