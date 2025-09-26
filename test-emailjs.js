/**
 * Test script for EmailJS configuration
 * Run with: node test-emailjs.js
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const testEmailJSConfig = () => {
  console.log('🧪 Testing EmailJS Configuration...\n');
  
  const config = {
    serviceId: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
    disableTemplateId: process.env.NEXT_PUBLIC_EMAILJS_DISABLE_TEMPLATE_ID,
    enableTemplateId: process.env.NEXT_PUBLIC_EMAILJS_ENABLE_TEMPLATE_ID,
    publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY,
    appUrl: process.env.NEXT_PUBLIC_APP_URL
  };
  
  console.log('📋 Configuration Status:');
  console.log('Service ID:', config.serviceId ? '✅ SET' : '❌ NOT SET');
  console.log('Disable Template ID:', config.disableTemplateId ? '✅ SET' : '❌ NOT SET');
  console.log('Enable Template ID:', config.enableTemplateId ? '✅ SET' : '❌ NOT SET');
  console.log('Public Key:', config.publicKey ? '✅ SET' : '❌ NOT SET');
  console.log('App URL:', config.appUrl ? '✅ SET' : '❌ NOT SET');
  
  console.log('\n📝 Current Values:');
  console.log('Service ID:', config.serviceId || 'NOT_SET');
  console.log('Disable Template ID:', config.disableTemplateId || 'NOT_SET');
  console.log('Enable Template ID:', config.enableTemplateId || 'NOT_SET');
  console.log('Public Key:', config.publicKey ? `${config.publicKey.substring(0, 8)}...` : 'NOT_SET');
  console.log('App URL:', config.appUrl || 'NOT_SET');
  
  const allConfigured = config.serviceId && config.disableTemplateId && config.enableTemplateId && config.publicKey;
  
  console.log('\n🎯 Configuration Status:', allConfigured ? '✅ READY' : '❌ INCOMPLETE');
  
  if (!allConfigured) {
    console.log('\n⚠️  Missing Configuration:');
    if (!config.serviceId) console.log('- NEXT_PUBLIC_EMAILJS_SERVICE_ID');
    if (!config.disableTemplateId) console.log('- NEXT_PUBLIC_EMAILJS_DISABLE_TEMPLATE_ID');
    if (!config.enableTemplateId) console.log('- NEXT_PUBLIC_EMAILJS_ENABLE_TEMPLATE_ID');
    if (!config.publicKey) console.log('- NEXT_PUBLIC_EMAILJS_PUBLIC_KEY');
    
    console.log('\n📖 Next Steps:');
    console.log('1. Create templates in EmailJS dashboard');
    console.log('2. Get template IDs from EmailJS');
    console.log('3. Update .env.local with the correct values');
    console.log('4. Restart your development server');
  } else {
    console.log('\n✅ All configuration is set! You can now test the email functionality.');
  }
};

testEmailJSConfig();
