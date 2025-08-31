'use client';

import { useState } from 'react';
import { azureSpeechService } from '../services/azure-speech-service';

export default function TestAzurePage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTests = async () => {
    setIsTesting(true);
    setTestResults([]);
    
    addResult('🚀 Starting Azure Speech Service tests...');
    
    try {
      // Test 1: Configuration
      addResult('📋 Test 1: Checking configuration...');
      const isConfigured = azureSpeechService.isConfigured();
      addResult(`   Configuration: ${isConfigured ? '✅ OK' : '❌ FAILED'}`);
      
      if (!isConfigured) {
        addResult('   ❌ Azure Speech Service is not configured properly');
        addResult('   💡 Check your .env.local file and restart the server');
        setIsTesting(false);
        return;
      }
      
      // Test 2: Service Info
      addResult('📊 Test 2: Getting service info...');
      const serviceInfo = azureSpeechService.getServiceInfo();
      addResult(`   Service Info: ${JSON.stringify(serviceInfo, null, 2)}`);
      
      // Test 3: Run comprehensive diagnostics
      addResult('🔍 Test 3: Running comprehensive diagnostics...');
      const diagnostics = await azureSpeechService.runDiagnostics();
      
      addResult(`   Configuration: ${diagnostics.configuration ? '✅ OK' : '❌ FAILED'}`);
      addResult(`   Network Access: ${diagnostics.networkAccess ? '✅ OK' : '❌ FAILED'}`);
      addResult(`   Service Availability: ${diagnostics.serviceAvailability ? '✅ OK' : '❌ FAILED'}`);
      
      if (diagnostics.recommendations.length > 0) {
        addResult('💡 Recommendations:');
        diagnostics.recommendations.forEach(rec => addResult(`   • ${rec}`));
      }
      
      if (diagnostics.serviceAvailability) {
        addResult('🎉 All tests passed! Azure Speech Service is working.');
      } else {
        addResult('❌ Azure Speech Service is not accessible. See recommendations above.');
      }
      
    } catch (error) {
      addResult(`❌ Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setIsTesting(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🔍 Azure Speech Service Test Page
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              This page helps you test your Azure Speech Service configuration. 
              Make sure you have created a <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code> file 
              with your Azure credentials.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">📋 Required Environment Variables:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><code>NEXT_PUBLIC_AZURE_SPEECH_SUBSCRIPTION_KEY</code> - Your Azure Speech Service key</li>
                <li><code>NEXT_PUBLIC_AZURE_SPEECH_REGION</code> - Your Azure region (e.g., southeastasia)</li>
                <li><code>NEXT_PUBLIC_AZURE_SPEECH_ENDPOINT</code> - Your Azure endpoint URL</li>
              </ul>
            </div>
          </div>
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={runTests}
              disabled={isTesting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTesting ? '🔄 Testing...' : '🧪 Run Tests'}
            </button>
            
            <button
              onClick={clearResults}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              🗑️ Clear Results
            </button>
          </div>
          
          {testResults.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">📊 Test Results:</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div key={index} className="text-sm font-mono bg-white p-2 rounded border">
                    {result}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-6 text-sm text-gray-500">
            <p>
              💡 <strong>Tip:</strong> If tests fail, check the browser console for detailed error messages.
            </p>
            <p>
              📚 <strong>Need help?</strong> See <code className="bg-gray-100 px-1 rounded">AZURE_SETUP.md</code> for detailed setup instructions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
