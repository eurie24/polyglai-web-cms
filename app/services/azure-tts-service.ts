// Azure Text-to-Speech Service
import { azureConfig } from '../config/azure-config';

export class AzureTTSService {
  private subscriptionKey: string;
  private region: string;
  private endpoint: string;

  constructor() {
    this.subscriptionKey = azureConfig.speech.subscriptionKey;
    this.region = azureConfig.speech.region;
    this.endpoint = azureConfig.speech.endpoint;
  }

  /**
   * Check if Azure TTS Service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.subscriptionKey && 
           this.subscriptionKey.length > 32 && 
           this.region && 
           this.endpoint);
  }

  /**
   * Get Azure TTS voice mappings for different languages
   * Using high-quality Neural voices optimized for language learning
   */
  private getVoiceMapping(): { [key: string]: string } {
    return {
      'en-US': 'en-US-AriaNeural',      // Clear, natural American English
      'en-GB': 'en-GB-SoniaNeural',     // British English
      'en-AU': 'en-AU-NatashaNeural',   // Australian English
      'ja-JP': 'ja-JP-KeitaNeural',     // Male Japanese voice, clear pronunciation
      'ko-KR': 'ko-KR-InJoonNeural',    // Male Korean voice, clear pronunciation  
      'zh-CN': 'zh-CN-YunxiNeural',     // Male Chinese voice, good for learning
      'es-ES': 'es-ES-AlvaroNeural',    // Male Spanish voice, clear pronunciation
      'es-MX': 'es-MX-JorgeNeural',     // Mexican Spanish
      'fr-FR': 'fr-FR-HenriNeural',     // French male voice
      'de-DE': 'de-DE-ConradNeural',    // German male voice
      'it-IT': 'it-IT-DiegoNeural',     // Italian male voice
      'pt-BR': 'pt-BR-AntonioNeural',   // Brazilian Portuguese
      'ru-RU': 'ru-RU-DmitryNeural'     // Russian male voice
    };
  }

  /**
   * Generate SSML for text-to-speech
   * Optimized for language learning with clear pronunciation
   */
  private generateSSML(text: string, locale: string, voice: string): string {
    // Escape XML special characters
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}">
        <voice name="${voice}">
          <prosody rate="0.85" pitch="0%" volume="100%">
            ${escapedText}
          </prosody>
        </voice>
      </speak>
    `.trim();
  }

  /**
   * Get access token for Azure Cognitive Services
   */
  private async getAccessToken(): Promise<string> {
    const tokenEndpoint = `https://${this.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: ''
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * Convert text to speech using Azure TTS
   */
  async textToSpeech(text: string, locale: string = 'en-US'): Promise<Blob> {
    if (!this.isConfigured()) {
      throw new Error('Azure TTS Service is not properly configured');
    }

    const voiceMapping = this.getVoiceMapping();
    const voice = voiceMapping[locale] || voiceMapping['en-US'];
    const ssml = this.generateSSML(text, locale, voice);

    console.log(`Azure TTS: Converting "${text}" to speech in ${locale} using voice ${voice}`);

    try {
      // Get access token
      const accessToken = await this.getAccessToken();

      // Make TTS request
      const ttsEndpoint = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
      
      const response = await fetch(ttsEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          'User-Agent': 'PolyglAI-Web-TTS'
        },
        body: ssml
      });

      if (!response.ok) {
        throw new Error(`Azure TTS request failed: ${response.status} ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      console.log(`Azure TTS: Successfully generated audio (${audioBlob.size} bytes)`);
      
      return audioBlob;
    } catch (error) {
      console.error('Azure TTS Error:', error);
      throw error;
    }
  }

  /**
   * Play text as speech (convenience method)
   */
  async speak(text: string, locale: string = 'en-US'): Promise<void> {
    try {
      const audioBlob = await this.textToSpeech(text, locale);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Clean up URL when done
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl);
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        URL.revokeObjectURL(audioUrl);
      });

      await audio.play();
    } catch (error) {
      console.error('Azure TTS speak error:', error);
      throw error;
    }
  }

  /**
   * Get supported locales
   */
  getSupportedLocales(): string[] {
    return Object.keys(this.getVoiceMapping());
  }
}

// Create singleton instance
export const azureTTSService = new AzureTTSService();
