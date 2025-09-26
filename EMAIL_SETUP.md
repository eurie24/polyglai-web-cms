# EmailJS Configuration for User Notifications

This guide explains how to set up EmailJS for sending user account disable/enable notifications.

## EmailJS Setup

1. **Create an EmailJS Account**:
   - Go to [https://www.emailjs.com/](https://www.emailjs.com/)
   - Sign up for a free account
   - Verify your email address

2. **Create an Email Service**:
   - Go to Email Services in your dashboard
   - Click "Add New Service"
   - Choose your email provider (Gmail, Outlook, Yahoo, etc.)
   - Follow the setup instructions for your provider

3. **Create Email Templates**:
   - Go to Email Templates in your dashboard
   - Click "Create New Template"
   - Create a template for user disable notifications
   - Create a template for user enable notifications
   - Use these template variables:
     - `{{to_email}}` - Recipient email
     - `{{to_name}}` - Recipient name
     - `{{subject}}` - Email subject
     - `{{message}}` - Email message content
     - `{{support_email}}` - Support contact email
     - `{{app_url}}` - App URL

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# EmailJS Configuration
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your-service-id
NEXT_PUBLIC_EMAILJS_DISABLE_TEMPLATE_ID=your-disable-template-id
NEXT_PUBLIC_EMAILJS_ENABLE_TEMPLATE_ID=your-enable-template-id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your-public-key

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

## Getting Your EmailJS Credentials

1. **Service ID**: Found in Email Services section
2. **Disable Template ID**: Found in Email Templates section (for user disable notifications)
3. **Enable Template ID**: Found in Email Templates section (for user enable notifications)
4. **Public Key**: Found in Account → API Keys section

## Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password when setting up Gmail service in EmailJS

## Other Email Providers

EmailJS supports many providers:
- Gmail
- Outlook/Hotmail
- Yahoo Mail
- SendGrid
- Mailgun
- And many more...

Choose your provider when creating the email service in EmailJS.

## Features

When a user account is disabled:
- ✅ User is immediately logged out of all devices
- ✅ User status is updated in Firestore
- ✅ User receives a professional email notification
- ✅ Email includes contact information for support

When a user account is re-enabled:
- ✅ User can log back in
- ✅ User status is updated in Firestore
- ✅ User receives a welcome back email notification

## Testing

To test the email functionality:

1. Set up the environment variables
2. Go to Admin → Users
3. Click the disable/enable button on any user
4. Check the console logs for email sending status
5. Verify the user receives the email

## Troubleshooting

- **Email not sending**: Check SMTP credentials and ensure 2FA is enabled for Gmail
- **User not logged out**: Check Firebase Admin SDK configuration
- **Status not updating**: Check Firestore permissions and user document structure
