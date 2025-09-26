/**
 * Microsoft Translator Text API Service
 * 
 * This service provides text translation capabilities using Microsoft's Translator Text API.
 * It follows the same configuration pattern as other Azure services in this app.
 * 
 * Documentation: https://docs.microsoft.com/en-us/azure/cognitive-services/translator/
 */

export interface TranslationResult {
  translation: string;
  transliteration?: string;
}

export interface LanguageInfo {
  [code: string]: string;
}

export class MicrosoftTranslatorService {
  
  // Language code mappings for Microsoft Translator API
  // Microsoft uses different codes than Google Translator for some languages
  private static readonly languageCodes: { [key: string]: string } = {
    'en': 'en',        // English
    'es': 'es',        // Spanish  
    'zh-cn': 'zh-Hans', // Chinese Simplified (Microsoft uses zh-Hans)
    'ja': 'ja',        // Japanese
    'ko': 'ko',        // Korean
  };

  /**
   * Get the correct Microsoft language code
   */
  private static getMicrosoftLanguageCode(inputCode: string): string {
    return this.languageCodes[inputCode] || inputCode;
  }

  /**
   * Get Microsoft Translator configuration from environment variables
   */
  private static getConfiguration() {
    const subscriptionKey = process.env.NEXT_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY;
    const region = process.env.NEXT_PUBLIC_AZURE_TRANSLATOR_REGION;
    
    if (!subscriptionKey || !region) {
      throw new Error('Microsoft Translator not configured. Please set NEXT_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY and NEXT_PUBLIC_AZURE_TRANSLATOR_REGION in your .env.local file');
    }
    
    return { subscriptionKey, region };
  }

  /**
   * Check if Microsoft Translator is properly configured
   */
  static isConfigured(): boolean {
    try {
      const { subscriptionKey, region } = this.getConfiguration();
      return subscriptionKey.length > 0 && region.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Translate text using Microsoft Translator Text API
   * 
   * @param text - The text to translate
   * @param fromLanguage - Source language code (e.g., 'en', 'es', 'zh-cn')
   * @param toLanguage - Target language code (e.g., 'en', 'es', 'zh-cn')
   * @returns The translated text
   */
  static async translateText({
    text,
    fromLanguage,
    toLanguage,
  }: {
    text: string;
    fromLanguage: string;
    toLanguage: string;
  }): Promise<string> {
    if (!text.trim()) {
      throw new Error('Text cannot be empty');
    }

    try {
      const { subscriptionKey, region } = this.getConfiguration();

      // Convert language codes to Microsoft format
      const fromLang = this.getMicrosoftLanguageCode(fromLanguage);
      const toLang = this.getMicrosoftLanguageCode(toLanguage);

      // Construct the Microsoft Translator API endpoint
      // Using the global endpoint which works with any region
      const endpoint = 'https://api.cognitive.microsofttranslator.com';
      const path = '/translate';
      const version = '3.0';
      
      const url = new URL(`${endpoint}${path}`);
      url.searchParams.append('api-version', version);
      url.searchParams.append('from', fromLang);
      url.searchParams.append('to', toLang);

      console.log('🌐 Microsoft Translator API URL:', url.toString());
      console.log('🔑 Using region:', region);
      console.log('📝 Translating:', `"${text}" from ${fromLang} to ${toLang}`);

      // Prepare the request body
      const requestBody = JSON.stringify([
        {
          Text: text,
        }
      ]);

      // Make the HTTP request
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Ocp-Apim-Subscription-Region': region,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-ClientTraceId': Date.now().toString(),
        },
        body: requestBody,
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const responseData = await response.json();
        
        if (Array.isArray(responseData) && responseData.length > 0) {
          const translations = responseData[0].translations;
          if (Array.isArray(translations) && translations.length > 0) {
            const translatedText = translations[0].text as string;
            console.log('✅ Translation successful:', `"${translatedText}"`);
            return translatedText;
          }
        }
        
        throw new Error('Unexpected response format from Microsoft Translator');
      } else {
        const errorBody = await response.text();
        console.log('❌ Translation failed:', `${response.status} - ${errorBody}`);
        
        // Parse error message if available
        try {
          const errorData = JSON.parse(errorBody);
          const errorMessage = errorData.error?.message || 'Unknown error';
          throw new Error(`Microsoft Translator error: ${errorMessage}`);
        } catch {
          throw new Error(`Microsoft Translator error: ${response.status} - ${errorBody}`);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Microsoft Translator')) {
        throw error;
      }
      console.log('❌ Translation error:', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test connection to Microsoft Translator service
   * 
   * @returns true if the service is accessible and configured correctly
   */
  static async testConnection(): Promise<boolean> {
    try {
      // Test with a simple translation
      const result = await this.translateText({
        text: 'Hello',
        fromLanguage: 'en',
        toLanguage: 'es',
      });
      
      return result.length > 0;
    } catch (error) {
      console.log('❌ Microsoft Translator connection test failed:', error);
      return false;
    }
  }

  /**
   * Detect the language of the given text
   * 
   * @param text - The text to detect the language for
   * @returns The detected language code
   */
  static async detectLanguage(text: string): Promise<string> {
    if (!text.trim()) {
      throw new Error('Text cannot be empty for language detection');
    }

    try {
      const { subscriptionKey, region } = this.getConfiguration();

      const endpoint = 'https://api.cognitive.microsofttranslator.com';
      const url = new URL(`${endpoint}/detect`);
      url.searchParams.append('api-version', '3.0');

      console.log('🔍 Detecting language for text:', `"${text.substring(0, 50)}..."`);

      const requestBody = JSON.stringify([
        { Text: text }
      ]);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Ocp-Apim-Subscription-Region': region,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: requestBody,
      });

      console.log('📡 Language detection response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
          const detection = data[0];
          const detectedLanguage = detection.language as string;
          const confidence = detection.score as number;
          
          console.log('✅ Language detected:', detectedLanguage, 'with confidence:', confidence);
          
          // Convert Microsoft language codes back to our app's format
          const appLanguageCode = this.getAppLanguageCode(detectedLanguage);
          return appLanguageCode;
        }
        
        throw new Error('Unexpected response format from Microsoft Translator detect API');
      } else {
        const errorBody = await response.text();
        console.log('❌ Language detection failed:', `${response.status} - ${errorBody}`);
        throw new Error(`Language detection failed: ${response.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Language detection')) {
        throw error;
      }
      console.log('❌ Language detection error:', error);
      throw new Error(`Language detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert Microsoft language codes back to our app's format
   */
  private static getAppLanguageCode(microsoftCode: string): string {
    // Reverse mapping from Microsoft codes to our app codes
    const reverseMapping: { [key: string]: string } = {
      'en': 'en',
      'es': 'es', 
      'zh-Hans': 'zh-cn',
      'ja': 'ja',
      'ko': 'ko',
    };
    
    return reverseMapping[microsoftCode] || microsoftCode;
  }

  /**
   * Fallback language detection using basic pattern matching
   * This is used when Microsoft Translator is not configured
   */
  static fallbackLanguageDetection(text: string): string {
    // Basic language detection patterns
    const patterns = {
      'en': /^[a-zA-Z\s.,!?'"()-]+$/,
      'es': /[ñáéíóúüÑÁÉÍÓÚÜ]/,
      'zh-cn': /[\u4e00-\u9fff]/,
      'ja': /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/,
      'ko': /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/,
    };

    // Check for specific language patterns
    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        console.log('🔍 Fallback language detection:', lang);
        return lang;
      }
    }

    // Default to English if no pattern matches
    console.log('🔍 Fallback language detection: defaulting to English');
    return 'en';
  }

  /**
   * Get supported languages from Microsoft Translator
   * 
   * @returns A map of language codes to language names
   */
  static async getSupportedLanguages(): Promise<LanguageInfo> {
    try {
      const { subscriptionKey, region } = this.getConfiguration();

      const endpoint = 'https://api.cognitive.microsofttranslator.com';
      const url = new URL(`${endpoint}/languages`);
      url.searchParams.append('api-version', '3.0');
      url.searchParams.append('scope', 'translation');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Ocp-Apim-Subscription-Region': region,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const translation = data.translation as { [key: string]: { name: string } };
        
        const languages: LanguageInfo = {};
        Object.keys(translation).forEach((code) => {
          languages[code] = translation[code].name;
        });
        
        return languages;
      } else {
        throw new Error(`Failed to get supported languages: ${response.status}`);
      }
    } catch (error) {
      console.log('❌ Failed to get supported languages:', error);
      return {};
    }
  }

  /**
   * Combined translation and transliteration result
   */
  static async translateWithTransliteration({
    text,
    fromLanguage,
    toLanguage,
  }: {
    text: string;
    fromLanguage: string;
    toLanguage: string;
  }): Promise<TranslationResult> {
    if (!text) {
      return { translation: '', transliteration: '' };
    }

    try {
      // Get the translation
      const translation = await this.translateText({
        text,
        fromLanguage,
        toLanguage,
      });

      let transliteration = '';
      
      // Get transliteration if supported for the target language
      if (this.supportsTransliteration(toLanguage)) {
        try {
          transliteration = await this.transliterateText({
            text: translation,
            languageCode: toLanguage,
          });
        } catch (error) {
          console.log('⚠️ Transliteration failed but translation succeeded:', error);
          // Continue with just the translation if transliteration fails
        }
      }

      return {
        translation,
        transliteration,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if transliteration is supported for a language
   */
  static supportsTransliteration(languageCode: string): boolean {
    const normalized = languageCode.toLowerCase();
    const supported = ['zh-cn', 'ja', 'ko'];
    return supported.includes(normalized);
  }

  /**
   * Transliterate text using Microsoft Transliteration API
   */
  private static async transliterateText({
    text,
    languageCode,
  }: {
    text: string;
    languageCode: string;
  }): Promise<string> {
    // Map app language codes to Microsoft language and script codes
    // Using the correct script codes that Microsoft Transliteration API supports
    const mapping: Record<string, { language: string; fromScript: string; toScript: string }> = {
      // Chinese Simplified → Latin (Pinyin)
      'zh-cn': { language: 'zh-Hans', fromScript: 'Hans', toScript: 'Latn' },
      // Japanese → Latin (Romaji)
      'ja': { language: 'ja', fromScript: 'Jpan', toScript: 'Latn' },
      // Korean → Latin (Romanization)
      'ko': { language: 'ko', fromScript: 'Kore', toScript: 'Latn' },
    };

    const key = languageCode.toLowerCase();
    const config = mapping[key];
    if (!config) {
      // If not supported, return the original text
      return text;
    }

    console.log('🔤 Transliterating:', `"${text}" from ${config.fromScript} to ${config.toScript}`);

    const { subscriptionKey, region } = this.getConfiguration();

    const endpoint = 'https://api.cognitive.microsofttranslator.com';
    const url = new URL(`${endpoint}/transliterate`);
    url.searchParams.append('api-version', '3.0');
    url.searchParams.append('language', config.language);
    url.searchParams.append('fromScript', config.fromScript);
    url.searchParams.append('toScript', config.toScript);

    console.log('🌐 Transliteration URL:', url.toString());

    const requestBody = JSON.stringify([
      { Text: text }
    ]);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey as string,
          'Ocp-Apim-Subscription-Region': region as string,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: requestBody,
      });

      console.log('📡 Transliteration response status:', response.status);

      if (!response.ok) {
        const errorBody = await response.text();
        console.log('❌ Transliteration error:', errorBody);
        
        // If Microsoft Transliteration API fails, try a fallback approach
        console.log('🔄 Trying fallback transliteration...');
        return this.fallbackTransliteration(text, languageCode);
      }

      const data = await response.json();
      console.log('📊 Transliteration response data:', data);
      
      // Response format: [ { text: '...' } ]
      if (Array.isArray(data) && data.length > 0 && typeof data[0].text === 'string') {
        const result = data[0].text as string;
        console.log('✅ Transliteration successful:', `"${result}"`);
        return result;
      }

      // If response format is unexpected, try fallback
      console.log('🔄 Unexpected response format, trying fallback transliteration...');
      return this.fallbackTransliteration(text, languageCode);
      
    } catch (error) {
      console.log('❌ Transliteration API call failed:', error);
      // Use fallback transliteration
      return this.fallbackTransliteration(text, languageCode);
    }
  }

  /**
   * Fallback transliteration using basic character mapping
   */
  private static fallbackTransliteration(text: string, languageCode: string): string {
    const key = languageCode.toLowerCase();
    
    switch (key) {
      case 'zh-cn':
        // Basic Chinese to Pinyin mapping (simplified)
        // This is a very basic fallback - in production you'd want a proper Pinyin library
        const chineseToPinyin: { [key: string]: string } = {
          '你好': 'nǐ hǎo',
          '对不起': 'duì bù qǐ',
          '晚上好': 'wǎn shang hǎo',
          '我可以': 'wǒ kě yǐ',
          '知道': 'zhī dào',
          '你的': 'nǐ de',
          '名字': 'míng zi',
          '吗': 'ma',
          '？': '?',
          '。': '.',
          '，': ',',
        };
        
        let result = text;
        Object.keys(chineseToPinyin).forEach(chinese => {
          result = result.replace(new RegExp(chinese, 'g'), chineseToPinyin[chinese]);
        });
        
        console.log('🔄 Fallback transliteration result:', result);
        return result;
        
      case 'ja':
        // Basic Japanese to Romaji mapping (simplified)
        const japaneseToRomaji: { [key: string]: string } = {
          'こんにちは': 'konnichiwa',
          'おはよう': 'ohayou',
          'ありがとう': 'arigatou',
          'さようなら': 'sayounara',
        };
        
        let japaneseResult = text;
        Object.keys(japaneseToRomaji).forEach(japanese => {
          japaneseResult = japaneseResult.replace(new RegExp(japanese, 'g'), japaneseToRomaji[japanese]);
        });
        
        console.log('🔄 Fallback transliteration result:', japaneseResult);
        return japaneseResult;
        
      case 'ko':
        // Basic Korean to Romanization mapping (simplified)
        const koreanToRoman: { [key: string]: string } = {
          '안녕하세요': 'annyeonghaseyo',
          '감사합니다': 'gamsahamnida',
          '안녕': 'annyeong',
        };
        
        let koreanResult = text;
        Object.keys(koreanToRoman).forEach(korean => {
          koreanResult = koreanResult.replace(new RegExp(korean, 'g'), koreanToRoman[korean]);
        });
        
        console.log('🔄 Fallback transliteration result:', koreanResult);
        return koreanResult;
        
      default:
        return text;
    }
  }
}
