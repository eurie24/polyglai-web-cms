'use client';

import { useState } from 'react';

export default function DebugSafari() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[${timestamp}] ${message}`);
  };

  const testMimeTypes = () => {
    addLog('🧪 Testing MIME type support...');
    const types = [
      'audio/wav',
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg',
      'audio/ogg;codecs=opus'
    ];

    types.forEach(type => {
      const supported = MediaRecorder.isTypeSupported(type);
      addLog(`${supported ? '✅' : '❌'} ${type}: ${supported ? 'Supported' : 'Not supported'}`);
    });
  };

  const testUserAgent = () => {
    addLog('🔍 Testing browser detection...');
    addLog(`User Agent: ${navigator.userAgent}`);
    
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    addLog(`Safari detected: ${isSafari ? 'YES' : 'NO'}`);
    
    const isChrome = /chrome/i.test(navigator.userAgent);
    addLog(`Chrome detected: ${isChrome ? 'YES' : 'NO'}`);
  };

  const testBasicRecording = async () => {
    try {
      addLog('🎤 Testing basic recording...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog('✅ Microphone access granted');
      
      const mimeType = MediaRecorder.isTypeSupported('audio/wav') ? 'audio/wav' : 'audio/webm';
      addLog(`Using MIME type: ${mimeType}`);
      
      const recorder = new MediaRecorder(stream, { mimeType });
      addLog('✅ MediaRecorder created');
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        addLog(`📊 Data available: ${event.data.size} bytes`);
        chunks.push(event.data);
      };
      
      recorder.onstart = () => {
        addLog('🎙️ Recording started');
        setIsRecording(true);
      };
      
      recorder.onstop = () => {
        addLog('🛑 Recording stopped');
        setIsRecording(false);
        
        const blob = new Blob(chunks, { type: mimeType });
        addLog(`📦 Final blob: ${blob.size} bytes, type: ${blob.type}`);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        addLog('🔇 Audio tracks stopped');
      };
      
      recorder.onerror = (event) => {
        addLog(`❌ Recording error: ${event}`);
        setIsRecording(false);
      };
      
      // Record for 2 seconds
      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 2000);
      
    } catch (error) {
      addLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      setIsRecording(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Safari Audio Debug Tool</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Tests</h2>
            <div className="space-y-3">
              <button
                onClick={testUserAgent}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Test Browser Detection
              </button>
              
              <button
                onClick={testMimeTypes}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Test MIME Types
              </button>
              
              <button
                onClick={testBasicRecording}
                disabled={isRecording}
                className={`w-full px-4 py-2 rounded text-white ${
                  isRecording 
                    ? 'bg-red-500 cursor-not-allowed' 
                    : 'bg-purple-500 hover:bg-purple-600'
                }`}
              >
                {isRecording ? 'Recording...' : 'Test Basic Recording (2s)'}
              </button>
              
              <button
                onClick={clearLogs}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Clear Logs
              </button>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Instructions</h2>
            <div className="text-sm text-gray-600 space-y-2">
              <p>🔍 <strong>Browser Detection:</strong> Checks if Safari is properly detected</p>
              <p>🧪 <strong>MIME Types:</strong> Tests which audio formats are supported</p>
              <p>🎤 <strong>Basic Recording:</strong> Tests MediaRecorder functionality</p>
              <p className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <strong>Note:</strong> Allow microphone access when prompted. Check the browser console for additional debug information.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Run a test to see output.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

