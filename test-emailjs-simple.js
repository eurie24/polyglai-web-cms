/**
 * Simple EmailJS test for Node.js environment
 * This simulates what happens in the browser
 */

// Simulate the environment variables
process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID = 'service_cchotm9';
process.env.NEXT_PUBLIC_EMAILJS_DISABLE_TEMPLATE_ID = 'template_z3ehh4s';
process.env.NEXT_PUBLIC_EMAILJS_ENABLE_TEMPLATE_ID = 'template_yy9t8df';
process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY = 'PZhOUxSa...'; // Replace with your actual key
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

const testEmailJSImport = async () => {
  console.log('🧪 Testing EmailJS Import...\n');
  
  try {
    console.log('📦 Importing EmailJS...');
    const emailjs = await import('@emailjs/browser');
    console.log('✅ EmailJS imported successfully');
    console.log('EmailJS object:', Object.keys(emailjs));
    
    // Test configuration
    const config = {
      serviceId: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
      disableTemplateId: process.env.NEXT_PUBLIC_EMAILJS_DISABLE_TEMPLATE_ID,
      enableTemplateId: process.env.NEXT_PUBLIC_EMAILJS_ENABLE_TEMPLATE_ID,
      publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY,
    };
    
    console.log('\n📋 Configuration:');
    console.log('Service ID:', config.serviceId);
    console.log('Disable Template ID:', config.disableTemplateId);
    console.log('Enable Template ID:', config.enableTemplateId);
    console.log('Public Key:', config.publicKey ? `${config.publicKey.substring(0, 8)}...` : 'NOT_SET');
    
    // Test template parameters
    const templateParams = {
      to_email: 'test@example.com',
      to_name: 'Test User',
      subject: 'Test Email',
      message: 'This is a test email',
      support_email: 'polyglAITool@gmail.com',
      app_url: process.env.NEXT_PUBLIC_APP_URL
    };
    
    console.log('\n📝 Template Parameters:');
    console.log(JSON.stringify(templateParams, null, 2));
    
    console.log('\n✅ EmailJS setup looks correct!');
    console.log('The issue might be:');
    console.log('1. Gmail service not properly connected');
    console.log('2. Template not found or misconfigured');
    console.log('3. Public key incorrect');
    console.log('4. EmailJS service limits reached');
    
  } catch (error) {
    console.error('❌ Error importing EmailJS:', error);
  }
};

testEmailJSImport();
