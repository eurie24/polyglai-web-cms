// Simple test script to verify export API functionality
const fetch = require('node-fetch');

async function testExport() {
  try {
    console.log('Testing export API...');
    
    // Test CSV export
    console.log('Testing CSV export...');
    const csvResponse = await fetch('http://localhost:3000/api/export-data?format=csv&type=users');
    console.log('CSV Response status:', csvResponse.status);
    console.log('CSV Content-Type:', csvResponse.headers.get('content-type'));
    console.log('CSV Content-Disposition:', csvResponse.headers.get('content-disposition'));
    
    if (csvResponse.ok) {
      const csvData = await csvResponse.text();
      console.log('CSV Data preview (first 500 chars):');
      console.log(csvData.substring(0, 500));
      
      // Check that email is not in the data
      if (csvData.includes('@')) {
        console.log('❌ WARNING: Email found in CSV data!');
      } else {
        console.log('✅ No email addresses found in CSV data');
      }
    }
    
    // Test Excel export
    console.log('\nTesting Excel export...');
    const excelResponse = await fetch('http://localhost:3000/api/export-data?format=excel&type=users');
    console.log('Excel Response status:', excelResponse.status);
    console.log('Excel Content-Type:', excelResponse.headers.get('content-type'));
    console.log('Excel Content-Disposition:', excelResponse.headers.get('content-disposition'));
    
    if (excelResponse.ok) {
      const excelData = await excelResponse.buffer();
      console.log('Excel file size:', excelData.length, 'bytes');
      console.log('✅ Excel export successful');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testExport();
