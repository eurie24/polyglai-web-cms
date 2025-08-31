// Test script to verify delete user functionality
const fetch = require('node-fetch');

async function testDeleteUser() {
  const baseUrl = 'http://localhost:3000';
  
  // Test with a fake user ID to see the response structure
  const testUserId = 'test-user-123';
  
  try {
    console.log('🧪 Testing delete user API...');
    
    const response = await fetch(`${baseUrl}/api/delete-user?userId=${testUserId}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ Delete API is working');
    } else {
      console.log('⚠️ Delete API returned unsuccessful response (expected for test user)');
    }
    
  } catch (error) {
    console.error('❌ Error testing delete API:', error);
  }
}

// Run the test
testDeleteUser(); 