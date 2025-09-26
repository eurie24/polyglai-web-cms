/**
 * Test script for the disable user API endpoint with EmailJS
 * Run with: node test-disable-user.js
 * 
 * Note: This tests the API endpoint only. Email sending is handled on the client side.
 */

const testDisableUserAPI = async () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  console.log('🧪 Testing Disable User API...');
  console.log('Base URL:', baseUrl);
  
  // Test data - replace with actual user data from your system
  const testUser = {
    userId: 'test-user-id', // Replace with actual user ID
    action: 'disable',
    userEmail: 'test@example.com', // Replace with actual email
    userName: 'Test User'
  };
  
  try {
    console.log('\n📤 Sending disable request...');
    console.log('Test data:', testUser);
    
    const response = await fetch(`${baseUrl}/api/disable-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });
    
    const data = await response.json();
    
    console.log('\n📥 Response received:');
    console.log('Status:', response.status);
    console.log('Success:', data.success);
    console.log('Message:', data.message);
    console.log('Details:', JSON.stringify(data.details, null, 2));
    
    if (data.success) {
      console.log('\n✅ Test passed! User disable functionality is working.');
    } else {
      console.log('\n❌ Test failed:', data.error);
    }
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  }
};

// Test enable user as well
const testEnableUserAPI = async () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  console.log('\n🧪 Testing Enable User API...');
  
  const testUser = {
    userId: 'test-user-id', // Replace with actual user ID
    action: 'enable',
    userEmail: 'test@example.com', // Replace with actual email
    userName: 'Test User'
  };
  
  try {
    console.log('\n📤 Sending enable request...');
    console.log('Test data:', testUser);
    
    const response = await fetch(`${baseUrl}/api/disable-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });
    
    const data = await response.json();
    
    console.log('\n📥 Response received:');
    console.log('Status:', response.status);
    console.log('Success:', data.success);
    console.log('Message:', data.message);
    console.log('Details:', JSON.stringify(data.details, null, 2));
    
    if (data.success) {
      console.log('\n✅ Test passed! User enable functionality is working.');
    } else {
      console.log('\n❌ Test failed:', data.error);
    }
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  }
};

// Run tests
const runTests = async () => {
  console.log('🚀 Starting Disable User API Tests...\n');
  
  await testDisableUserAPI();
  await testEnableUserAPI();
  
  console.log('\n🏁 Tests completed!');
  console.log('\n📝 Note: Make sure to:');
  console.log('1. Set up email environment variables (see EMAIL_SETUP.md)');
  console.log('2. Replace test user data with actual user IDs and emails');
  console.log('3. Run the web-cms server (npm run dev)');
};

runTests().catch(console.error);
