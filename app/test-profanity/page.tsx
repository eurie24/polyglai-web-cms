'use client';

import { useState } from 'react';
import { ProfanityFilterService } from '../../src/services/profanityFilterService';

export default function TestProfanityPage() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const testProfanity = async () => {
    if (!inputText.trim()) {
      setResult('Please enter some text to test.');
      return;
    }

    setIsLoading(true);
    setResult('Testing profanity detection and recording...');

    try {
      const validation = ProfanityFilterService.validateContent(inputText, {
        context: 'web_test',
        language: 'en',
        recordProfanity: true
      });

      if (!validation.isValid) {
        setResult(`✅ Profanity detected and recorded!\n\n` +
                 `Detected words: ${validation.detectedWords?.join(', ') || 'None'}\n` +
                 `Error message: ${validation.errorMessage}\n\n` +
                 `Check the browser console and Firestore for recording details.`);
      } else {
        setResult('❌ No profanity detected in the text.');
      }
    } catch (error) {
      setResult(`Error testing profanity: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testCleanText = () => {
    const testCases = [
      'Hello, how are you today?',
      'I would like to learn Spanish',
      'Can you help me with my homework?',
      'Good morning, have a nice day!',
      'Thank you for your assistance'
    ];
    
    let results = [];
    testCases.forEach(text => {
      const validation = ProfanityFilterService.validateContent(text, { recordProfanity: false });
      results.push(`"${text}": ${validation.isValid ? 'ALLOWED' : 'BLOCKED'}`);
    });
    
    setResult('Clean text test completed. All should be allowed.\n\n' + results.join('\n'));
  };

  const testProfanityWords = () => {
    const testCases = [
      'This is a fucking test',
      'What the hell are you doing?',
      'You are such a stupid person',
      'Go to hell you bastard'
    ];
    
    let results = [];
    testCases.forEach(text => {
      const validation = ProfanityFilterService.validateContent(text, { 
        recordProfanity: true, 
        context: 'web_test', 
        language: 'en' 
      });
      results.push(`"${text}": ${validation.isValid ? 'ALLOWED' : 'BLOCKED'}`);
    });
    
    setResult('Profanity test completed. All should be blocked.\n\n' + results.join('\n'));
  };

  const clearResults = () => {
    setResult('');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Profanity Counter Test (Web-CMS)</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Test Profanity Detection & Recording</h2>
          
          <div className="mb-4">
            <label htmlFor="testInput" className="block text-sm font-medium text-gray-700 mb-2">
              Enter text with profanity to test:
            </label>
            <textarea
              id="testInput"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Try: 'This is a fucking test'"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={testProfanity}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
            >
              {isLoading ? 'Testing...' : 'Test Recording'}
            </button>
            <button
              onClick={testCleanText}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Test Clean Text
            </button>
            <button
              onClick={testProfanityWords}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Test Profanity
            </button>
            <button
              onClick={clearResults}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Clear Results
            </button>
          </div>
          
          {result && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-300 rounded-md">
              <pre className="whitespace-pre-wrap text-sm font-mono">{result}</pre>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Instructions</h2>
          <div className="space-y-2 text-gray-600">
            <p>1. <strong>Test Recording:</strong> Enter text with profanity and click "Test Recording" to see if it's detected and recorded to Firestore.</p>
            <p>2. <strong>Test Clean Text:</strong> Click to test that clean text is allowed through.</p>
            <p>3. <strong>Test Profanity:</strong> Click to test that profanity is blocked and recorded.</p>
            <p>4. <strong>Check Console:</strong> Open browser developer tools to see detailed logging.</p>
            <p>5. <strong>Check Firestore:</strong> Look in the Firebase console to see if records are being saved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
