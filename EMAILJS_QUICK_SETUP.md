# EmailJS Quick Setup Guide

## 🚀 **Step-by-Step Setup**

### **1. Create Email Templates in EmailJS**

#### **Template 1: User Account Disabled**
- **Name**: `User Account Disabled`
- **Subject**: `Account Disabled - PolyglAI`
- **Content**: Use the HTML template provided in the main setup guide
- **Template Variables**: `{{to_email}}`, `{{to_name}}`, `{{subject}}`, `{{message}}`, `{{support_email}}`, `{{app_url}}`

#### **Template 2: User Account Enabled**
- **Name**: `User Account Enabled`
- **Subject**: `Account Re-enabled - PolyglAI`
- **Content**: Use the HTML template provided in the main setup guide
- **Template Variables**: `{{to_email}}`, `{{to_name}}`, `{{subject}}`, `{{message}}`, `{{support_email}}`, `{{app_url}}`

### **2. Get Your Credentials**

After creating both templates, note down:
- **Service ID**: `service_cchotm9` (from your Gmail service)
- **Disable Template ID**: From the "User Account Disabled" template
- **Enable Template ID**: From the "User Account Enabled" template
- **Public Key**: From Account → API Keys

### **3. Update Environment Variables**

Create or update your `.env.local` file:

```bash
# EmailJS Configuration
NEXT_PUBLIC_EMAILJS_SERVICE_ID=service_cchotm9
NEXT_PUBLIC_EMAILJS_DISABLE_TEMPLATE_ID=your-disable-template-id-here
NEXT_PUBLIC_EMAILJS_ENABLE_TEMPLATE_ID=your-enable-template-id-here
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your-public-key-here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### **4. Test the Implementation**

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Test the functionality**:
   - Go to Admin → Users
   - Try disabling a user
   - Check browser console for email sending status
   - Verify the user receives the email

### **5. Troubleshooting**

- **Email not sending**: Check that all environment variables are set correctly
- **Template not found**: Verify template IDs are correct
- **Gmail issues**: Make sure Gmail service is properly connected
- **Console errors**: Check browser console for detailed error messages

## ✅ **You're All Set!**

Once you've completed these steps, the user disable/enable functionality will work with EmailJS, sending professional email notifications to users when their accounts are disabled or enabled.
