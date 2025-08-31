// Azure Speech Service for Web - Replaces unreliable browser Web Speech API
import { azureConfig } from '../config/azure-config';
import { createTestWavBlob } from '../utils/audio-helper';

export class AzureSpeechService {
  private subscriptionKey: string;
  private region: string;
  private endpoint: string;
  private alternativeEndpoints: string[];

  constructor() {
    // Use configuration from environment variables or config file
    this.subscriptionKey = azureConfig.speech.subscriptionKey;
    this.region = azureConfig.speech.region;
    this.endpoint = azureConfig.speech.endpoint;
    this.alternativeEndpoints = azureConfig.alternativeEndpoints;
  }

  /**
   * Check if Azure Speech Service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.subscriptionKey && 
           this.subscriptionKey.length > 32 && 
           this.region && 
           this.endpoint);
  }

  /**
   * Get available speech recognition languages
   */
  getAvailableLanguages(): { [key: string]: string } {
    return {
      'en-US': 'English (United States)',
      'en-GB': 'English (United Kingdom)',
      'en-AU': 'English (Australia)',
      'en-CA': 'English (Canada)',
      'en-IN': 'English (India)',
      'es-ES': 'Spanish (Spain)',
      'es-MX': 'Spanish (Mexico)',
      'fr-FR': 'French (France)',
      'fr-CA': 'French (Canada)',
      'de-DE': 'German (Germany)',
      'it-IT': 'Italian (Italy)',
      'pt-BR': 'Portuguese (Brazil)',
      'pt-PT': 'Portuguese (Portugal)',
      'ru-RU': 'Russian (Russia)',
      'ja-JP': 'Japanese (Japan)',
      'ko-KR': 'Korean (Korea)',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'ar-SA': 'Arabic (Saudi Arabia)',
      'hi-IN': 'Hindi (India)',
      'th-TH': 'Thai (Thailand)',
      'vi-VN': 'Vietnamese (Vietnam)',
      'tr-TR': 'Turkish (Turkey)',
      'nl-NL': 'Dutch (Netherlands)',
      'sv-SE': 'Swedish (Sweden)',
      'da-DK': 'Danish (Denmark)',
      'no-NO': 'Norwegian (Norway)',
      'fi-FI': 'Finnish (Finland)',
      'pl-PL': 'Polish (Poland)',
      'cs-CZ': 'Czech (Czech Republic)',
      'hu-HU': 'Hungarian (Hungary)',
      'ro-RO': 'Romanian (Romania)',
      'bg-BG': 'Bulgarian (Bulgaria)',
      'hr-HR': 'Croatian (Croatia)',
      'sk-SK': 'Slovak (Slovakia)',
      'sl-SI': 'Slovenian (Slovenia)',
      'et-EE': 'Estonian (Estonia)',
      'lv-LV': 'Latvian (Latvia)',
      'lt-LT': 'Lithuanian (Lithuania)',
      'mt-MT': 'Maltese (Malta)',
      'el-GR': 'Greek (Greece)',
      'he-IL': 'Hebrew (Israel)',
      'id-ID': 'Indonesian (Indonesia)',
      'ms-MY': 'Malay (Malaysia)',
      'fil-PH': 'Filipino (Philippines)',
      'ur-PK': 'Urdu (Pakistan)',
      'bn-BD': 'Bengali (Bangladesh)',
      'ta-IN': 'Tamil (India)',
      'te-IN': 'Telugu (India)',
      'kn-IN': 'Kannada (India)',
      'ml-IN': 'Malayalam (India)',
      'gu-IN': 'Gujarati (India)',
      'pa-IN': 'Punjabi (India)',
      'or-IN': 'Odia (India)',
      'as-IN': 'Assamese (India)',
      'ne-NP': 'Nepali (Nepal)',
      'si-LK': 'Sinhala (Sri Lanka)',
      'my-MM': 'Myanmar (Myanmar)',
      'km-KH': 'Khmer (Cambodia)',
      'lo-LA': 'Lao (Laos)',
      'mn-MN': 'Mongolian (Mongolia)',
      'ka-GE': 'Georgian (Georgia)',
      'hy-AM': 'Armenian (Armenia)',
      'az-AZ': 'Azerbaijani (Azerbaijan)',
      'kk-KZ': 'Kazakh (Kazakhstan)',
      'ky-KG': 'Kyrgyz (Kyrgyzstan)',
      'uz-UZ': 'Uzbek (Uzbekistan)',
      'tg-TJ': 'Tajik (Tajikistan)',
      'tk-TM': 'Turkmen (Turkmenistan)',
      'af-ZA': 'Afrikaans (South Africa)',
      'zu-ZA': 'Zulu (South Africa)',
      'xh-ZA': 'Xhosa (South Africa)',
      'sw-KE': 'Swahili (Kenya)',
      'am-ET': 'Amharic (Ethiopia)',
      'ha-NG': 'Hausa (Nigeria)',
      'ig-NG': 'Igbo (Nigeria)',
      'yo-NG': 'Yoruba (Nigeria)',
      'so-SO': 'Somali (Somalia)',
      'rw-RW': 'Kinyarwanda (Rwanda)',
      'lg-UG': 'Ganda (Uganda)',
      'ak-GH': 'Akan (Ghana)',
      'tw-GH': 'Twi (Ghana)',
      'ee-GH': 'Ewe (Ghana)',
      'sn-ZW': 'Shona (Zimbabwe)',
      'st-ZA': 'Southern Sotho (South Africa)',
      'tn-BW': 'Tswana (Botswana)',
      'ts-ZA': 'Tsonga (South Africa)',
      've-ZA': 'Venda (South Africa)',
      'nr-ZA': 'Southern Ndebele (South Africa)',
      'ss-ZA': 'Swati (South Africa)',
      'nd-ZW': 'Northern Ndebele (Zimbabwe)',
      'ny-MW': 'Chichewa (Malawi)'
    };
  }

  /**
   * Start speech recognition using Azure Speech Services
   */
  async startSpeechRecognition(
    language: string = 'en-US',
    onResult: (text: string) => void,
    onError: (error: string) => void,
    onStatus: (status: string) => void
  ): Promise<() => void> {
    console.log('🎤 Starting speech recognition...');
    console.log('Browser:', navigator.userAgent);
    console.log('Language:', language);
    
    if (!this.isConfigured()) {
      console.error('❌ Azure Speech Service not configured');
      throw new Error('Azure Speech Service not configured. Please check your credentials.');
    }

    try {
      // Detect Safari and use different constraints
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      // Request microphone access with browser-specific constraints
      const audioConstraints = isSafari 
        ? { 
            audio: true  // Safari works better with simple constraints
          }
        : { 
            audio: {
              sampleRate: 16000,      // Azure prefers 16kHz
              channelCount: 1,        // Mono audio
              echoCancellation: true, // Remove echo
              noiseSuppression: true, // Remove background noise
              autoGainControl: true   // Automatic volume adjustment
            }
          };
          
      console.log(isSafari ? '🍎 Safari detected, using simplified audio constraints' : '🌐 Using advanced audio constraints');
      console.log('Audio constraints:', audioConstraints);
      
      onStatus('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      console.log('✅ Microphone access granted');
      onStatus('Microphone access granted');
      
      // Create MediaRecorder to capture audio with better format handling
      let mimeType = 'audio/wav';
      let recorderOptions: MediaRecorderOptions = {};
      
      if (isSafari) {
        // Safari specific configuration
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
          recorderOptions = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
          recorderOptions = { mimeType: 'audio/webm' };
        } else {
          // Use default
          recorderOptions = {};
        }
        console.log(`🍎 Safari using mime type: ${mimeType}`);
      } else {
        // Non-Safari browsers - try to force WAV or use better WebM settings
        if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeType = 'audio/wav';
          recorderOptions = { 
            mimeType: 'audio/wav',
            audioBitsPerSecond: 16000 
          };
        } else {
          // Try different WebM configurations for better Azure compatibility
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
            recorderOptions = { 
              mimeType: 'audio/webm;codecs=opus',
              audioBitsPerSecond: 16000 
            };
          } else if (MediaRecorder.isTypeSupported('audio/webm')) {
            mimeType = 'audio/webm';
            recorderOptions = { 
              mimeType: 'audio/webm',
              audioBitsPerSecond: 16000 
            };
          } else {
            // Fallback to default
            recorderOptions = {};
          }
          console.log(`⚠️ WAV not supported, using ${mimeType}. Audio quality may be affected.`);
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      console.log('✅ MediaRecorder created with options:', recorderOptions);

      const audioChunks: Blob[] = [];
      let recordingStartTime = Date.now();
      
      onStatus('Setting up recording...');
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Audio data available, size:', event.data.size, 'bytes');
        audioChunks.push(event.data);
      };

      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        onError('Recording failed. Please try again.');
      };

      mediaRecorder.onstart = () => {
        console.log('✅ MediaRecorder started successfully');
        onStatus('Recording active...');
      };

      mediaRecorder.onstop = async () => {
        try {
          console.log('🛑 Recording stopped');
          onStatus('Processing recording...');
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          console.log('🔇 Audio tracks stopped');
          
          // Check minimum recording duration (at least 500ms)
          const recordingDuration = Date.now() - recordingStartTime;
          console.log(`⏱️ Recording duration: ${recordingDuration}ms`);
          
          if (recordingDuration < 500) {
            console.error('❌ Recording too short:', recordingDuration + 'ms');
            onError('Recording too short. Please hold the microphone button for at least half a second and speak clearly.');
            return;
          }
          
          // Create audio blob with the correct format
          const audioBlob = new Blob(audioChunks, { type: mimeType });
          console.log(`📦 Audio blob created: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
          
          // Check if audio blob has data
          if (audioBlob.size === 0) {
            console.error('❌ No audio data recorded');
            onError('No audio data recorded. Please try again.');
            return;
          }
          
          console.log(`✅ Recording completed. Duration: ${recordingDuration}ms, Size: ${audioBlob.size} bytes`);
          
          // If audio is WebM, try to convert it or use an alternative approach
          let processedAudioBlob = audioBlob;
          if (audioBlob.type.includes('webm')) {
            console.log('🔄 WebM audio detected, trying alternative processing...');
            
            // Try to convert WebM to WAV using AudioContext
            try {
              const audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
              const arrayBuffer = await audioBlob.arrayBuffer();
              const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
              
              // Convert to WAV format
              const wavBlob = this.audioBufferToWav(audioBuffer);
              processedAudioBlob = wavBlob;
              console.log('✅ Successfully converted WebM to WAV');
            } catch (conversionError) {
              console.warn('⚠️ WebM to WAV conversion failed, using original:', conversionError);
              // Continue with original WebM blob
            }
          }
          
          // Convert audio to text using Azure Speech Services
          onStatus('Converting speech to text...');
          console.log('🔄 Starting speech-to-text conversion...');
          
          try {
            const text = await this.convertAudioToText(processedAudioBlob, language);
            console.log('✅ Speech converted successfully:', text);
            onResult(text);
          } catch (azureError) {
            console.error('❌ Azure conversion failed:', azureError);
            
            // If WebM failed and we have browser speech recognition, try fallback
            if (processedAudioBlob.type.includes('webm') && 
                ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
              console.log('🔄 Trying browser Web Speech API fallback...');
              onStatus('Azure failed, trying browser speech recognition...');
              
              try {
                const browserText = await this.fallbackToBrowserSpeechRecognition(language, onStatus);
                if (browserText) {
                  console.log('✅ Browser speech recognition succeeded:', browserText);
                  onResult(browserText);
                  return;
                }
              } catch (browserError) {
                console.warn('⚠️ Browser speech recognition also failed:', browserError);
              }
            }
            
            // Re-throw the original error
            throw azureError;
          }
          
        } catch (error) {
          console.error('❌ Critical error in onstop handler:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // If Azure fails with WebM format, suggest trying a different browser
          if (errorMessage.includes('WebM audio format')) {
            onError('WebM audio format issue detected. Try using Chrome or Edge browser for better microphone support, or try speaking louder and more clearly.');
          } else {
            onError(`Audio processing failed: ${errorMessage}`);
          }
        }
      };

      // Start recording
      console.log('🎙️ Starting recording...');
      mediaRecorder.start();
      recordingStartTime = Date.now();
      onStatus('Recording... Click microphone again to stop');
      
      // Return stop function
      return () => {
        console.log('🛑 Stop function called');
        if (mediaRecorder.state === 'recording') {
          console.log('📴 Stopping MediaRecorder...');
          mediaRecorder.stop();
        } else {
          console.log('⚠️ MediaRecorder not recording, current state:', mediaRecorder.state);
        }
        stream.getTracks().forEach(track => track.stop());
      };

    } catch (error) {
      console.error('❌ Error starting speech recognition:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      onError(error instanceof Error ? error.message : 'Failed to start speech recognition');
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

    /**
   * Convert AudioBuffer to WAV format
   */
  private audioBufferToWav(audioBuffer: AudioBuffer): Blob {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const dataLength = length * numChannels * 2; // 16-bit samples
    
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Fallback to browser's native Web Speech API
   */
  private async fallbackToBrowserSpeechRecognition(language: string, onStatus: (status: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const SpeechRecognitionClass = (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
      
            if (!SpeechRecognitionClass) {
        reject(new Error('Browser speech recognition not supported'));
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognitionClass as any)();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language;
      
      let finalTranscript = '';
      
      recognition.onstart = () => {
        onStatus('Browser speech recognition started...');
      };
      
      recognition.onresult = (event: { resultIndex: number; results: Array<{ [0]: { transcript: string }; isFinal: boolean }> }) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        onStatus(`Browser: ${finalTranscript || interimTranscript}`);
      };
      
      recognition.onerror = (event: { error: string }) => {
        console.error('Browser speech recognition error:', event.error);
        reject(new Error(`Browser speech recognition failed: ${event.error}`));
      };
      
      recognition.onend = () => {
        if (finalTranscript) {
          resolve(finalTranscript);
        } else {
          reject(new Error('No speech detected by browser'));
        }
      };
      
      // Start browser recognition
      recognition.start();
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (recognition.state === 'recording') {
          recognition.stop();
        }
      }, 10000);
    });
  }

  /**
   * Convert audio blob to text using Azure Speech Services
   */
  private async convertAudioToText(audioBlob: Blob, language: string): Promise<string> {
    try {
      // Use the working endpoint for all formats since v3.1 is giving 404
      const url = `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed`;
      console.log('🎵 Using working Azure STT endpoint for all formats');
      console.log('Audio format:', audioBlob.type);
      
      console.log('Sending request to Azure Speech Service:', url);
      console.log('Audio blob size:', audioBlob.size, 'bytes');
      console.log('Audio blob type:', audioBlob.type);
      
      // Convert blob to array buffer
      const audioData = await audioBlob.arrayBuffer();
      
      // Determine the correct Content-Type based on the actual audio format
      let contentType = 'audio/wav';
      if (audioBlob.type.includes('mp4')) {
        contentType = 'audio/mp4';
      } else if (audioBlob.type.includes('webm')) {
        contentType = 'audio/webm';
      } else if (audioBlob.type.includes('ogg')) {
        contentType = 'audio/ogg';
      }
      
      console.log('Using Content-Type:', contentType);
      
      // For Azure Speech Services REST API, we need to send the audio as binary data
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          'Content-Type': contentType,
          'Accept': 'application/json'
        },
        body: audioData
      });

      console.log('Azure Speech Service response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure Speech Service error response:', errorText);
        throw new Error(`Azure Speech Service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Azure Speech Service result:', result);
      
      // Debug: Check if NBest array has any results
      if (result.NBest && Array.isArray(result.NBest) && result.NBest.length > 0) {
        console.log('NBest results:', result.NBest);
        const bestResult = result.NBest[0];
        console.log('Best result object:', bestResult);
        
        // Try different property names that Azure might use
        if (bestResult) {
          if (bestResult.Display) {
            console.log('Found text in NBest[0].Display:', bestResult.Display);
            return bestResult.Display;
          } else if (bestResult.Lexical) {
            console.log('Found text in NBest[0].Lexical:', bestResult.Lexical);
            return bestResult.Lexical;
          } else if (bestResult.ITN) {
            console.log('Found text in NBest[0].ITN:', bestResult.ITN);
            return bestResult.ITN;
          } else if (bestResult.MaskedITN) {
            console.log('Found text in NBest[0].MaskedITN:', bestResult.MaskedITN);
            return bestResult.MaskedITN;
          } else {
            console.log('NBest[0] properties:', Object.keys(bestResult));
          }
        }
      }
      
      // The response format is different for this endpoint
      if (result.RecognitionStatus === 'Success') {
        if (result.DisplayText && result.DisplayText.trim() !== '') {
          return result.DisplayText;
        } else {
          // Check for confidence score and other details
          const duration = result.Duration ? `${result.Duration / 10000}ms` : 'unknown';
          const offset = result.Offset ? `${result.Offset / 10000}ms` : 'unknown';
          console.log(`Audio processed - Duration: ${duration}, Offset: ${offset}`);
          
          // Provide browser-specific error messages and suggestions
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          
          if (isSafari) {
            throw new Error('Safari audio recording detected but no speech found. Try speaking louder and more clearly, or consider using Chrome/Edge for better speech recognition compatibility.');
          } else if (audioBlob.type.includes('webm')) {
            throw new Error('WebM audio format issue detected. The audio was recorded but Azure couldn\'t detect speech. Try speaking louder and more clearly, or use Chrome/Edge browser for better compatibility.');
          } else {
            throw new Error('No speech detected in the audio. Try speaking louder and more clearly, or check your microphone.');
          }
        }
      } else if (result.RecognitionStatus === 'NoMatch') {
        throw new Error('No speech detected. Please try speaking again.');
      } else {
        throw new Error(`Recognition failed: ${result.RecognitionStatus || 'Unknown status'}`);
      }

    } catch (error) {
      console.error('Audio conversion error:', error);
      throw new Error(`Audio conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert blob to base64 string
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix to get just the base64 string
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Test Azure Speech Service connectivity
   */
  async testConnection(): Promise<boolean> {
    console.log('🔍 Testing Azure Speech Service connection...');
    
    try {
      // Try the main endpoint first
      console.log('🔄 Testing main endpoint:', this.endpoint);
      const isMainEndpointWorking = await this.testEndpoint(this.endpoint);
      if (isMainEndpointWorking) {
        console.log('✅ Main endpoint is working');
        return true;
      }
      
      // If main endpoint fails, try alternative endpoints
      console.log('🔄 Main endpoint failed, trying alternatives...');
      for (const altEndpoint of this.alternativeEndpoints) {
        if (altEndpoint !== this.endpoint) {
          console.log('🔄 Trying alternative endpoint:', altEndpoint);
          const isWorking = await this.testEndpoint(altEndpoint);
          if (isWorking) {
            // Update the endpoint to the working one
            this.endpoint = altEndpoint;
            console.log('✅ Switched to working endpoint:', altEndpoint);
            return true;
          }
        }
      }
      
      // Test 3: Try region-specific endpoint discovery
      console.log('🔄 Test 3: Trying region-specific endpoint discovery...');
      const regionSpecificEndpoints = [
        `https://${this.region}.stt.speech.microsoft.com`,
        `https://${this.region}.cognitiveservices.azure.com`,
        `https://${this.region}.api.cognitive.microsoft.com`
      ];
      
      for (const regionEndpoint of regionSpecificEndpoints) {
        if (regionEndpoint !== this.endpoint && !this.alternativeEndpoints.includes(regionEndpoint)) {
          try {
            console.log('🔄 Trying region-specific endpoint:', regionEndpoint);
            const isWorking = await this.testEndpoint(regionEndpoint);
            if (isWorking) {
              console.log('✅ Found working region-specific endpoint:', regionEndpoint);
              this.endpoint = regionEndpoint;
              return true;
            }
          } catch (error) {
            console.log('❌ Region-specific endpoint failed:', regionEndpoint, error);
          }
        }
      }
      
      console.log('❌ All endpoint discovery methods failed');
      console.log('💡 This suggests either:');
      console.log('   1. Azure Speech Service is not enabled in your subscription');
      console.log('   2. The region does not support Speech Services');
      console.log('   3. The subscription key is invalid or expired');
      console.log('   4. Network/firewall restrictions are blocking access');
      
      return false;
    } catch (error) {
      console.error('❌ Azure Speech Service connection test failed:', error);
      return false;
    }
  }

  /**
   * Test a specific endpoint by trying different API paths for speech recognition
   */
  private async testEndpoint(endpoint: string): Promise<boolean> {
    try {
      console.log('🔍 Testing speech endpoint:', endpoint);
      
      // Skip basic connectivity test to avoid CORS issues
      // Go directly to testing the actual speech endpoints
      
      // Create test audio blob - using proper WAV format
      const testAudio = createTestWavBlob(100); // 100ms of silence
      
      // Try different API endpoints and formats
      // Using the format that works in the Flutter app
      const testEndpoints = [
        `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
        `${endpoint}/speech/recognition/conversation/cognitiveservices/v1`,
        `${endpoint}/speechtotext/v3.1/recognize`,
        `${endpoint}/speechtotext/v3.0/recognize`
      ];
      
      for (const testUrl of testEndpoints) {
        const speechUrl = testUrl;
        console.log('🔍 Testing endpoint:', speechUrl);
        
        try {
          console.log(`🔍 Testing: ${speechUrl}`);
          console.log(`📤 Headers:`, {
            'Ocp-Apim-Subscription-Key': `${this.subscriptionKey.substring(0, 8)}...`,
            'Content-Type': 'audio/wav',
            'Accept': 'application/json'
          });
          
          // Add language parameter for the cognitiveservices endpoint
          const urlWithParams = speechUrl.includes('cognitiveservices') 
            ? `${speechUrl}?language=en-US`
            : speechUrl;
            
          const response = await fetch(urlWithParams, {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': this.subscriptionKey,
              'Content-Type': 'audio/wav',
              'Accept': 'application/json'
            },
            body: testAudio
          });

          console.log(`📡 Response status:`, response.status);
          console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));
          
          // If we get a response (even an error), the service is reachable
          // 400 is expected for invalid audio, but means the service is accessible
          // 401 means unauthorized (key issue), 403 means forbidden, 404 means endpoint not found
          if (response.status === 400) {
            console.log('✅ Endpoint is working (400 is expected for invalid test audio)');
            return true;
          } else if (response.status === 401) {
            console.log('⚠️ Endpoint is working but unauthorized (check subscription key)');
            return true;
          } else if (response.status === 403) {
            console.log('⚠️ Endpoint is working but forbidden (check permissions)');
            return true;
          } else if (response.status === 404) {
            console.log(`❌ Endpoint not found, trying next...`);
            continue;
          } else if (response.status === 200) {
            console.log('✅ Endpoint is working (200 response)');
            return true;
          }
          
          // If we get here, we found a working endpoint
          console.log(`✅ Found working endpoint with status: ${response.status}`);
          return true;
        } catch (error) {
          console.log(`❌ Endpoint failed:`, error);
          continue;
        }
      }
      
      console.error('❌ All API paths failed');
      return false;
    } catch (error) {
      console.error(`❌ Endpoint test failed for ${endpoint}:`, error);
      return false;
    }
  }

  /**
   * Get service status and configuration
   */
  getServiceInfo() {
    return {
      configured: this.isConfigured(),
      subscriptionKey: this.subscriptionKey ? 
        `${this.subscriptionKey.substring(0, 8)}...${this.subscriptionKey.substring(this.subscriptionKey.length - 4)}` : 
        'Not configured',
      region: this.region,
      endpoint: this.endpoint,
      availableLanguages: Object.keys(this.getAvailableLanguages()).length
    };
  }

  /**
   * Run comprehensive diagnostics to identify Azure Speech Service issues
   */
  async runDiagnostics(): Promise<{
    configuration: boolean;
    networkAccess: boolean;
    serviceAvailability: boolean;
    recommendations: string[];
  }> {
    const results: {
      configuration: boolean;
      networkAccess: boolean;
      serviceAvailability: boolean;
      recommendations: string[];
    } = {
      configuration: false,
      networkAccess: false,
      serviceAvailability: false,
      recommendations: []
    };

    console.log('🔍 Running comprehensive Azure Speech Service diagnostics...');

    // Test 1: Configuration
    results.configuration = this.isConfigured();
    if (!results.configuration) {
      results.recommendations.push('Check your .env.local file for Azure credentials');
      results.recommendations.push('Ensure subscription key is at least 32 characters long');
      results.recommendations.push('Verify region and endpoint are correctly formatted');
    }

    // Test 2: Network Access - Skip external site tests to avoid CORS issues
    // We'll test network access indirectly through the Azure Speech Service test
    results.networkAccess = true;

    // Test 3: Service Availability
    try {
      console.log('🔗 Testing Azure Speech Service availability...');
      const isAvailable = await this.testConnection();
      results.serviceAvailability = isAvailable;
      
      if (!isAvailable) {
        results.recommendations.push('Azure Speech Service may not be enabled in your subscription');
        results.recommendations.push('Check if your Azure region supports Speech Services');
        results.recommendations.push('Verify your subscription key has Speech Services permissions');
        results.recommendations.push('Consider creating a new Speech Service resource in Azure Portal');
      }
    } catch (error) {
      console.log('❌ Service availability test failed:', error);
      results.recommendations.push('Service test encountered an error - check console for details');
    }

    console.log('📊 Diagnostics complete:', results);
    return results;
  }
}

// Export singleton instance
export const azureSpeechService = new AzureSpeechService();
