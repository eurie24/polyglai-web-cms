# Speech-to-Text Setup Guide

## How to Use Speech Recognition

### 1. **Browser Requirements**
- ✅ **Chrome/Chromium** (Recommended)
- ✅ **Microsoft Edge**
- ✅ **Safari** (iOS/macOS)
- ❌ **Firefox** (Not supported)

### 2. **Permissions Required**
- **Microphone Access**: The app will request microphone permission
- **HTTPS**: Speech recognition requires secure connection

### 3. **How to Use**
1. Click the microphone button (blue circular button)
2. Allow microphone permission when prompted
3. Start speaking in the selected source language
4. The button will turn red and pulse while listening
5. Speech will be converted to text automatically
6. Click the button again to stop recording

### 4. **Language Support**
- **English**: en-US
- **Español**: es-ES
- **Mandarin**: zh-CN
- **Nihongo**: ja-JP
- **Hangugeo**: ko-KR

### 5. **Features**
- ✅ Automatic language detection based on source language selection
- ✅ Character limit enforcement (100 characters)
- ✅ Real-time visual feedback (button color/animation)
- ✅ Error handling with user-friendly messages
- ✅ Permission management
- ✅ Click to stop recording

### 6. **Troubleshooting**

#### "Browser not supported"
- Use Chrome, Edge, or Safari
- Firefox doesn't support Web Speech API

#### "Microphone permission denied"
- Click the lock icon in browser address bar
- Allow microphone access
- Refresh the page

#### "No speech detected"
- Speak clearly and loudly
- Check microphone is working
- Try in quieter environment

#### "Network error occurred"
**Most common issue** - Speech recognition uses Google's servers
- **Check internet connection**: Ensure you're connected to the internet
- **Try different network**: Switch to different WiFi or use mobile data
- **Firewall/VPN issues**: Disable VPN or check firewall settings
- **Corporate networks**: May block Google services
- **Use text input**: The app will offer to focus on manual text input as fallback
- **Refresh and retry**: Sometimes helps with connection issues

### 7. **Visual Indicators**
- 🟦 **Blue Button**: Ready to start recording
- 🔴 **Red Pulsing**: Currently recording
- ⏸️ **Stop Icon**: Click to stop recording
- 📊 **Character Counter**: Shows current/max characters
- 🔴 **"Listening..."**: Text indicator when active

The speech recognition will automatically stop after detecting speech or you can manually stop it by clicking the button again.