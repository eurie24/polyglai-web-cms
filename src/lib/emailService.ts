// EmailJS configuration
const getEmailJSConfig = () => {
  return {
    serviceId: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '',
    disableTemplateId: process.env.NEXT_PUBLIC_EMAILJS_DISABLE_TEMPLATE_ID || '',
    enableTemplateId: process.env.NEXT_PUBLIC_EMAILJS_ENABLE_TEMPLATE_ID || '',
    publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '',
  };
};

// Check if EmailJS is configured
const isEmailJSConfigured = (): boolean => {
  const config = getEmailJSConfig();
  return !!(config.serviceId && config.disableTemplateId && config.enableTemplateId && config.publicKey);
};

// Send user disable notification email
export const sendUserDisableNotification = async (
  userEmail: string,
  userName: string
): Promise<{ success: boolean; error?: string }> => {
  const config = getEmailJSConfig();
  
  try {
    console.log('EmailJS Config Check:', {
      serviceId: config.serviceId ? 'SET' : 'NOT_SET',
      disableTemplateId: config.disableTemplateId ? 'SET' : 'NOT_SET',
      enableTemplateId: config.enableTemplateId ? 'SET' : 'NOT_SET',
      publicKey: config.publicKey ? 'SET' : 'NOT_SET'
    });
    
    if (!isEmailJSConfigured()) {
      console.warn('EmailJS not configured. Skipping email notification.');
      console.warn('Missing config:', {
        serviceId: !config.serviceId,
        disableTemplateId: !config.disableTemplateId,
        enableTemplateId: !config.enableTemplateId,
        publicKey: !config.publicKey
      });
      return { success: true }; // Don't fail the disable operation if email fails
    }

    // Dynamically import EmailJS to avoid SSR issues
    const emailjs = await import('@emailjs/browser');
    
    // Validate email address
    if (!userEmail || userEmail.trim() === '') {
      console.error('Invalid email address:', userEmail);
      return { 
        success: false, 
        error: 'Invalid email address provided' 
      };
    }
    
    const templateParams = {
      // Try different common EmailJS parameter names
      to_email: userEmail.trim(),
      to_name: userName || 'User',
      user_email: userEmail.trim(),
      user_name: userName || 'User',
      recipient_email: userEmail.trim(),
      recipient_name: userName || 'User',
      email: userEmail.trim(),
      name: userName || 'User',
      subject: 'Account Disabled - PolyglAI',
      message: `
        Hello ${userName || 'User'},

        We are writing to inform you that your PolyglAI account has been disabled by our administrators. 
        This means you will no longer be able to access your account or use our services.

        What this means:
        • You have been logged out of all devices and sessions
        • You cannot access the PolyglAI app or web platform
        • Your account data remains secure but inaccessible

        If you believe this action was taken in error, or if you have any questions about this decision, 
        please contact our support team immediately at polyglAITool@gmail.com.

        Best regards,
        PolyglAI Support Team
      `,
      support_email: 'polyglAITool@gmail.com',
      app_url: process.env.NEXT_PUBLIC_APP_URL || 'https://polyglai.com',
      from_name: 'PolyglAI Support',
      reply_to: 'polyglAITool@gmail.com'
    };

    console.log('Sending email with config:', {
      serviceId: config.serviceId,
      templateId: config.disableTemplateId,
      publicKey: config.publicKey ? 'SET' : 'NOT_SET'
    });
    
    console.log('Template params:', {
      to_email: templateParams.to_email,
      to_name: templateParams.to_name,
      subject: templateParams.subject,
      message: templateParams.message.substring(0, 100) + '...',
      support_email: templateParams.support_email,
      app_url: templateParams.app_url,
      from_name: templateParams.from_name,
      reply_to: templateParams.reply_to
    });
    
    console.log('Full template params object:', JSON.stringify(templateParams, null, 2));
    
    const result = await emailjs.send(
      config.serviceId,
      config.disableTemplateId,
      templateParams,
      config.publicKey
    );
    
    console.log('User disable notification email sent:', result);
    return { success: true };
  } catch (error) {
    console.error('Error sending user disable notification email:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Config used:', {
      serviceId: config.serviceId,
      templateId: config.disableTemplateId,
      publicKey: config.publicKey ? '***' : 'NOT_SET'
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : `Unknown error: ${JSON.stringify(error)}` 
    };
  }
};

// Send user enable notification email
export const sendUserEnableNotification = async (
  userEmail: string,
  userName: string
): Promise<{ success: boolean; error?: string }> => {
  const config = getEmailJSConfig();
  
  try {
    if (!isEmailJSConfigured()) {
      console.warn('EmailJS not configured. Skipping email notification.');
      return { success: true };
    }

    // Dynamically import EmailJS to avoid SSR issues
    const emailjs = await import('@emailjs/browser');
    
    // Validate email address
    if (!userEmail || userEmail.trim() === '') {
      console.error('Invalid email address:', userEmail);
      return { 
        success: false, 
        error: 'Invalid email address provided' 
      };
    }
    
    const templateParams = {
      // Try different common EmailJS parameter names
      to_email: userEmail.trim(),
      to_name: userName || 'User',
      user_email: userEmail.trim(),
      user_name: userName || 'User',
      recipient_email: userEmail.trim(),
      recipient_name: userName || 'User',
      email: userEmail.trim(),
      name: userName || 'User',
      subject: 'Account Re-enabled - PolyglAI',
      message: `
        Hello ${userName || 'User'},

        Great news! Your PolyglAI account has been re-enabled by our administrators. 
        You can now access your account and continue using our services.

        You can now:
        • Access the PolyglAI app and web platform
        • Continue your language learning journey
        • Use all available features and services

        Welcome back! We're excited to have you continue your language learning journey with us.

        Best regards,
        PolyglAI Support Team
      `,
      support_email: 'polyglAITool@gmail.com',
      app_url: process.env.NEXT_PUBLIC_APP_URL || 'https://polyglai.com',
      from_name: 'PolyglAI Support',
      reply_to: 'polyglAITool@gmail.com'
    };

    console.log('Sending email with config:', {
      serviceId: config.serviceId,
      templateId: config.enableTemplateId,
      publicKey: config.publicKey ? 'SET' : 'NOT_SET'
    });
    
    console.log('Template params:', {
      to_email: templateParams.to_email,
      to_name: templateParams.to_name,
      subject: templateParams.subject,
      message: templateParams.message.substring(0, 100) + '...',
      support_email: templateParams.support_email,
      app_url: templateParams.app_url,
      from_name: templateParams.from_name,
      reply_to: templateParams.reply_to
    });
    
    console.log('Full template params object:', JSON.stringify(templateParams, null, 2));

    const result = await emailjs.send(
      config.serviceId,
      config.enableTemplateId,
      templateParams,
      config.publicKey
    );
    
    console.log('User enable notification email sent:', result);
    return { success: true };
  } catch (error) {
    console.error('Error sending user enable notification email:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Config used:', {
      serviceId: config.serviceId,
      templateId: config.enableTemplateId,
      publicKey: config.publicKey ? '***' : 'NOT_SET'
    });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : `Unknown error: ${JSON.stringify(error)}` 
    };
  }
};
