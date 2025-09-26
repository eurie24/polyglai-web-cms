/**
 * Profanity Filter Service for Web CMS
 * 
 * This service provides content filtering capabilities to prevent inappropriate
 * content from being translated. It follows the same implementation as the
 * Flutter app's ProfanityFilterService.
 */

export interface ContentValidationResult {
  isValid: boolean;
  reason?: string;
  errorMessage?: string;
  detectedWords?: string[];
}

export class ProfanityFilterService {
  // Comprehensive list of inappropriate words in multiple languages
  // Note: This is a basic implementation. In production, you'd want a more sophisticated approach
  private static readonly profanityWords: string[] = [
    // English profanity
    'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'crap', 'piss',
    'motherfucker', 'cocksucker', 'whore', 'slut', 'cunt', 'dick', 'pussy',
    'retard', 'faggot', 'nigger', 'nazi', 'hitler', 'kill yourself', 'kys',
    'suicide', 'die', 'murder', 'rape', 'terrorist', 'bomb', 'weapon',
    
    // Spanish profanity
    'puta', 'mierda', 'joder', 'cabrón', 'coño', 'gilipollas', 'hijo de puta',
    'mamada', 'pendejo', 'chingar', 'verga', 'culero', 'pinche', 'marica',
    'estúpido', 'idiota', 'terrorista', 'matar', 'asesinar', 'violación',
    
    // Mandarin/Chinese profanity (romanized)
    'cao', 'ma de', 'sha bi', 'ben dan', 'hun dan', 'wang ba dan', 'ta ma de',
    'ni ma', 'qu si', 'si', 'sha', 'kong bu', 'bao zha', 'wu qi',
    
    // Japanese profanity (romanized)
    'kuso', 'chikushou', 'shine', 'baka', 'aho', 'kisama', 'teme', 'yarou',
    'fuzakeru', 'urusai', 'koroshi', 'shi', 'tero', 'bakudan', 'buki',
    
    // Korean profanity (romanized)
    'sibal', 'ssibal', 'gaesaekki', 'jotgat', 'byeongsin', 'michin', 'nappeun',
    'jugeo', 'jukda', 'tero', 'poktan', 'mugi',
    
    // Violence and harmful content
    'violence', 'harm', 'abuse', 'torture', 'kill', 'death', 'blood',
    'gore', 'mutilate', 'destroy', 'attack', 'assault', 'fight',
    'violencia', 'daño', 'abuso', 'tortura', 'muerte', 'sangre',
    'destruir', 'atacar', 'agredir', 'luchar',
    
    // Hate speech indicators
    'hate', 'racism', 'discrimination', 'supremacy', 'genocide', 'ethnic cleansing',
    'odio', 'racismo', 'discriminación', 'supremacía', 'genocidio',
    
    // Drug-related content
    'cocaine', 'heroin', 'meth', 'drugs', 'marijuana', 'weed', 'pot',
    'cocaína', 'heroína', 'metanfetamina', 'drogas', 'marihuana',
    
    // Sexual content
    'porn', 'pornography', 'sex', 'sexual', 'nude', 'naked', 'breast',
    'penis', 'vagina', 'masturbate', 'orgasm', 'erotic',
    'porno', 'pornografía', 'sexo', 'sexual', 'desnudo', 'seno',
    'masturbar', 'orgasmo', 'erótico',
  ];

  // Additional patterns to check for
  private static readonly harmfulPatterns: RegExp[] = [
    // Threats and violence
    /\b(kill|murder|die|death)\s+(you|yourself|him|her|them)\b/i,
    /\b(go\s+)?kill\s+yourself\b/i,
    /\bkys\b/i,
    /\b(i\s+will|gonna|going\s+to)\s+(kill|murder|hurt)\b/i,
    
    // Hate speech patterns
    /\b(all\s+)?(jews|muslims|christians|blacks|whites|asians|latinos|hispanics)\s+(are|should)\s+(die|burn|suffer)\b/i,
    /\b(hitler\s+was\s+right|nazi\s+germany|white\s+power|black\s+people\s+are)\b/i,
    
    // Self-harm patterns
    /\b(cut\s+yourself|harm\s+yourself|hurt\s+yourself)\b/i,
    /\b(commit\s+suicide|end\s+your\s+life)\b/i,
    
    // Bullying patterns
    /\b(you\s+are\s+)?(worthless|useless|stupid|retarded|ugly|fat|disgusting)\b/i,
    /\b(nobody\s+likes\s+you|everyone\s+hates\s+you)\b/i,
    
    // Terrorist/violence patterns
    /\b(bomb|terrorist|attack|explosion|weapon|gun|knife)\b/i,
    /\b(make\s+a\s+bomb|build\s+a\s+weapon|plan\s+an\s+attack)\b/i,
  ];

  /**
   * Checks if the given text contains profanity or harmful content
   */
  static containsProfanity(text: string): boolean {
    if (!text || text.trim().length === 0) return false;
    
    const normalizedText = this.normalizeText(text);
    
    // Check against profanity word list
    for (const profanityWord of this.profanityWords) {
      if (this.containsWord(normalizedText, profanityWord)) {
        return true;
      }
    }
    
    // Check against harmful patterns
    for (const pattern of this.harmfulPatterns) {
      if (pattern.test(normalizedText)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Gets the specific inappropriate words/phrases found in the text
   */
  static getDetectedProfanity(text: string): string[] {
    const detected: string[] = [];
    
    if (!text || text.trim().length === 0) return detected;
    
    const normalizedText = this.normalizeText(text);
    
    // Check against profanity word list
    for (const profanityWord of this.profanityWords) {
      if (this.containsWord(normalizedText, profanityWord)) {
        detected.push(profanityWord);
      }
    }
    
    // Check against harmful patterns
    for (const pattern of this.harmfulPatterns) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        detected.push(...matches);
      }
    }
    
    return detected;
  }

  /**
   * Normalizes text for checking (removes special characters, converts to lowercase)
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters except word chars and spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Checks if a specific word exists in the text (whole word matching)
   */
  private static containsWord(text: string, word: string): boolean {
    // Create regex for whole word matching
    const wordRegex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
    return wordRegex.test(text);
  }

  /**
   * Escapes special regex characters in a string
   */
  private static escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Gets an appropriate error message based on the content detected
   */
  static getErrorMessage(detectedContent: string): string {
    if (detectedContent.includes('kill') || 
        detectedContent.includes('murder') || 
        detectedContent.includes('die') ||
        detectedContent.includes('death') ||
        detectedContent.includes('kys')) {
      return 'Translation blocked: Text contains violent or threatening language that could harm others.';
    }
    
    if (detectedContent.includes('terrorist') || 
        detectedContent.includes('bomb') || 
        detectedContent.includes('weapon') ||
        detectedContent.includes('attack')) {
      return 'Translation blocked: Text contains content related to violence or terrorism.';
    }
    
    if (detectedContent.includes('hate') || 
        detectedContent.includes('racism') || 
        detectedContent.includes('nazi') ||
        detectedContent.includes('supremacy')) {
      return 'Translation blocked: Text contains hate speech or discriminatory language.';
    }
    
    if (detectedContent.includes('drug') || 
        detectedContent.includes('cocaine') || 
        detectedContent.includes('heroin')) {
      return 'Translation blocked: Text contains references to illegal substances.';
    }
    
    if (detectedContent.includes('porn') || 
        detectedContent.includes('sex') || 
        detectedContent.includes('nude')) {
      return 'Translation blocked: Text contains inappropriate sexual content.';
    }
    
    // Generic message for other profanity
    return 'Translation blocked: Text contains inappropriate language that violates our community guidelines.';
  }

  /**
   * Checks if text length exceeds reasonable limits (to prevent abuse)
   */
  static isTextTooLong(text: string, maxLength: number = 10000): boolean {
    return text.length > maxLength;
  }

  /**
   * Comprehensive content validation
   */
  static validateContent(text: string, options?: {
    context?: string;
    language?: string;
    recordProfanity?: boolean;
  }): ContentValidationResult {
    if (!text || text.trim().length === 0) {
      return {
        isValid: false,
        reason: 'Text is empty',
        errorMessage: 'Please enter some text to translate.'
      };
    }

    if (this.isTextTooLong(text)) {
      return {
        isValid: false,
        reason: 'Text too long',
        errorMessage: 'Text is too long. Please reduce the content and try again.'
      };
    }

    if (this.containsProfanity(text)) {
      const detected = this.getDetectedProfanity(text);
      
      // Record profanity usage if enabled (default: true)
      if (options?.recordProfanity !== false) {
        // Use dynamic import to avoid circular dependency
        import('./profanityCounterService').then(({ ProfanityCounterService }) => {
          ProfanityCounterService.recordProfanityUsage({
            text,
            context: options?.context || 'translation',
            language: options?.language || 'unknown',
            detectedWords: detected,
          }).catch(error => {
            console.error('Error recording profanity usage:', error);
          });
        }).catch(error => {
          console.error('Error importing profanity counter service:', error);
        });
      }
      
      return {
        isValid: false,
        reason: 'Inappropriate content',
        errorMessage: this.getErrorMessage(detected.join(', ')),
        detectedWords: detected
      };
    }

    return { isValid: true };
  }
}
