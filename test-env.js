// Test script to verify environment variables are loaded
// Run this with: node test-env.js

console.log('🔍 Testing Environment Variables...\n');

// Check if .env.local exists and is loaded
try {
  require('dotenv').config({ path: '.env.local' });
  console.log('✅ .env.local file loaded');
} catch (error) {
  console.log('❌ .env.local file not found or could not be loaded');
  console.log('   Make sure you have created .env.local in the web-cms directory');
}

console.log('\n📋 Environment Variables Status:');

// Check Azure Speech Service variables
const speechKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_SUBSCRIPTION_KEY;
const speechRegion = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;
const speechEndpoint = process.env.NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT;

console.log('\n🎤 Azure Speech Service:');
console.log(`   Subscription Key: ${speechKey ? '✅ Set' : '❌ Missing'}`);
if (speechKey) {
  console.log(`   Key Preview: ${speechKey.substring(0, 8)}...${speechKey.substring(speechKey.length - 4)}`);
  console.log(`   Key Length: ${speechKey.length} characters`);
}
console.log(`   Region: ${speechRegion ? `✅ ${speechRegion}` : '❌ Missing'}`);
console.log(`   Endpoint: ${speechEndpoint ? `✅ ${speechEndpoint}` : '❌ Missing'}`);

// Check Azure Translator Service variables
const translatorKey = process.env.NEXT_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY;
const translatorRegion = process.env.NEXT_PUBLIC_AZURE_TRANSLATOR_REGION;
const translatorEndpoint = process.env.NEXT_PUBLIC_AZURE_TRANSLATOR_ENDPOINT;

console.log('\n🌐 Azure Translator Service:');
console.log(`   Subscription Key: ${translatorKey ? '✅ Set' : '❌ Missing'}`);
if (translatorKey) {
  console.log(`   Key Preview: ${translatorKey.substring(0, 8)}...${translatorKey.substring(translatorKey.length - 4)}`);
  console.log(`   Key Length: ${translatorKey.length} characters`);
}
console.log(`   Region: ${translatorRegion ? `✅ ${translatorRegion}` : '❌ Missing'}`);
console.log(`   Endpoint: ${translatorEndpoint ? `✅ ${translatorEndpoint}` : '❌ Missing'}`);

// Summary
console.log('\n📊 Summary:');
const speechConfigured = speechKey && speechRegion && speechEndpoint;
const translatorConfigured = translatorKey && translatorRegion && translatorEndpoint;

console.log(`   Speech Service: ${speechConfigured ? '✅ Ready' : '❌ Not Ready'}`);
console.log(`   Translator Service: ${translatorConfigured ? '✅ Ready' : '❌ Not Ready'}`);

if (!speechConfigured || !translatorConfigured) {
  console.log('\n🚨 To fix missing configuration:');
  console.log('   1. Create .env.local file in web-cms directory');
  console.log('   2. Add your Azure credentials (see .env.example)');
  console.log('   3. Restart your development server');
  console.log('   4. Run this test again');
} else {
  console.log('\n🎉 All services are configured!');
  console.log('   You can now test the Azure Speech Service in your app.');
}

console.log('\n📚 For detailed setup instructions, see: AZURE_SETUP.md');
