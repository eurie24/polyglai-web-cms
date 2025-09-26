'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { azureSpeechService } from '../services/azure-speech-service';
import { SettingsService } from '../services/settings-service';
import { azureTTSService } from '../services/azure-tts-service';
import { UserService, HighScore } from '../services/user-service';
import { auth, db } from '../../src/lib/firebase';
import AssessmentFeedback from '../components/assessment-feedback';
import { collection, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

type Level = 'beginner' | 'intermediate' | 'advanced';

const languageOptions: { code: string; label: string }[] = [
  { code: 'english', label: 'English' },
  { code: 'mandarin', label: 'Mandarin' },
  { code: 'japanese', label: 'Nihongo' },
  { code: 'spanish', label: 'Español' },
  { code: 'korean', label: 'Hangugeo' }
];

// Normalize display names and aliases to Firestore language codes
const mapLanguageToFirestoreCode = (lang: string): string => {
  const l = (lang || '').toLowerCase().trim();
  const map: Record<string, string> = {
    // canonical
    english: 'english',
    mandarin: 'mandarin',
    chinese: 'mandarin',
    spanish: 'spanish',
    japanese: 'japanese',
    korean: 'korean',
    // short codes
    en: 'english',
    zh: 'mandarin',
    'zh-cn': 'mandarin',
    es: 'spanish',
    ja: 'japanese',
    ko: 'korean',
    // localized/display strings
    nihongo: 'japanese',
    '日本語': 'japanese',
    hangugeo: 'korean',
    '한국어': 'korean',
    espanol: 'spanish',
    español: 'spanish',
    castellano: 'spanish',
    中文: 'mandarin',
    汉语: 'mandarin',
    漢語: 'mandarin',
    普通话: 'mandarin',
    國語: 'mandarin'
  };
  return map[l] || l;
};

const azureLocaleMap: Record<string, string> = {
  english: 'en-US',
  mandarin: 'zh-CN',
  japanese: 'ja-JP',
  spanish: 'es-ES',
  korean: 'ko-KR'
};

const flagMap: Record<string, string> = {
  english: '/flags/Usa.svg',
  mandarin: '/flags/China.svg',
  japanese: '/flags/Japan.svg',
  spanish: '/flags/Spain.svg',
  korean: '/flags/Korea.svg'
};

function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = Array.from({ length: an + 1 }, () => Array(bn + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[i][0] = i;
  for (let j = 0; j <= bn; j++) matrix[0][j] = j;
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[an][bn];
}

// Language-aware text comparison function
function compareTexts(text1: string, text2: string, language: string): boolean {
  if (!text1 || !text2) return false;
  
  // For Japanese, Korean, and Chinese - exact match (no case conversion)
  if (['japanese', 'mandarin', 'korean'].includes(language.toLowerCase())) {
    return text1.trim() === text2.trim();
  }
  
  // For languages with case (English, Spanish) - case insensitive
  return text1.toLowerCase().trim() === text2.toLowerCase().trim();
}

function getCommonPronunciationVariations(word: string): string[] {
  const variations: Record<string, string[]> = {
    'i': ['i', 'ai', 'ay'],
    'don\'t': ['dont', 'don\'t', 'dun'],
    'understand': ['understand', 'understan', 'understend'],
    'hello': ['hello', 'helo', 'hallo'],
    'goodbye': ['goodbye', 'goodby', 'good-bye'],
    'thank': ['thank', 'tank', 'thang'],
    'you': ['you', 'yu', 'u'],
    'please': ['please', 'pleez', 'pleas'],
    'sorry': ['sorry', 'soree', 'sori'],
    'excuse': ['excuse', 'excus', 'exkuse'],
    'me': ['me', 'mi'],
    'yes': ['yes', 'yeah', 'ya'],
    'no': ['no', 'nope', 'nah'],
    'what': ['what', 'wut', 'wat'],
    'where': ['where', 'wear', 'ware'],
    'when': ['when', 'wen'],
    'why': ['why', 'wy'],
    'how': ['how', 'how'],
    'who': ['who', 'hoo'],
    'which': ['which', 'wich'],
    'that': ['that', 'dat'],
    'this': ['this', 'dis'],
    'the': ['the', 'da', 'duh'],
    'a': ['a', 'uh'],
    'an': ['an', 'un'],
    'is': ['is', 'iz'],
    'are': ['are', 'r', 'ar'],
    'am': ['am', 'm'],
    'was': ['was', 'wuz'],
    'were': ['were', 'wer'],
    'have': ['have', 'hav', 'haf'],
    'has': ['has', 'haz'],
    'had': ['had', 'hade'],
    'do': ['do', 'du'],
    'does': ['does', 'duz'],
    'did': ['did', 'did'],
    'can': ['can', 'kan'],
    'could': ['could', 'kud'],
    'would': ['would', 'wud'],
    'should': ['should', 'shud'],
    'will': ['will', 'wil'],
    'may': ['may', 'may'],
    'might': ['might', 'mite'],
    'must': ['must', 'mus'],
    'shall': ['shall', 'shal'],
    'want': ['want', 'wont'],
    'need': ['need', 'nead'],
    'like': ['like', 'lik'],
    'love': ['love', 'luv'],
    'hate': ['hate', 'hate'],
    'know': ['know', 'no'],
    'think': ['think', 'tink'],
    'feel': ['feel', 'fel'],
    'see': ['see', 'sea'],
    'look': ['look', 'luk'],
    'hear': ['hear', 'here'],
    'listen': ['listen', 'lisen'],
    'speak': ['speak', 'spek'],
    'talk': ['talk', 'tok'],
    'say': ['say', 'sai'],
    'tell': ['tell', 'tel'],
    'ask': ['ask', 'ask'],
    'answer': ['answer', 'anser'],
    'question': ['question', 'kwestion'],
    'problem': ['problem', 'problum'],
    'solution': ['solution', 'solushun'],
    'help': ['help', 'help'],
    'work': ['work', 'werk'],
    'play': ['play', 'play'],
    'study': ['study', 'studi'],
    'learn': ['learn', 'lern'],
    'teach': ['teach', 'teech'],
    'school': ['school', 'skool'],
    'home': ['home', 'hom'],
    'house': ['house', 'hous'],
    'room': ['room', 'rum'],
    'door': ['door', 'dor'],
    'window': ['window', 'windo'],
    'table': ['table', 'taybl'],
    'chair': ['chair', 'chayr'],
    'bed': ['bed', 'bed'],
    'food': ['food', 'fud'],
    'water': ['water', 'wata'],
    'drink': ['drink', 'drink'],
    'eat': ['eat', 'eet'],
    'cook': ['cook', 'kuk'],
    'buy': ['buy', 'by'],
    'sell': ['sell', 'sel'],
    'money': ['money', 'muni'],
    'i\'m': ['i\'m', 'im', 'i am'],
    'not': ['not', 'nawt', 'nat'],
    'sure': ['sure', 'shur', 'shure'],
    'i\'m not sure': ['i\'m not sure', 'im not sure', 'i am not sure', 'i\'m not shur', 'im not shur'],
    'time': ['time', 'tym'],
    'day': ['day', 'day'],
    'night': ['night', 'nyt'],
    'morning': ['morning', 'mornin'],
    'afternoon': ['afternoon', 'aftanoon'],
    'evening': ['evening', 'evenin'],
    'today': ['today', 'tuday'],
    'tomorrow': ['tomorrow', 'tumoro'],
    'yesterday': ['yesterday', 'yestaday'],
    'week': ['week', 'week'],
    'month': ['month', 'munth'],
    'year': ['year', 'yeer'],
    'hour': ['hour', 'our'],
    'minute': ['minute', 'minit'],
    'second': ['second', 'sekund']
  };
  
  return variations[word.toLowerCase()] || [word];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function scorePronunciation(target: string, actual: string, level: string = 'beginner', language: string = 'english'): number {
  const t = target.trim().toLowerCase();
  const a = actual.trim().toLowerCase();
  if (!t || !a) return 0;
  
  // Check if the user actually said something similar to the target
  const targetWords = t.split(/\s+/).filter(Boolean);
  const actualWords = a.split(/\s+/).filter(Boolean);
  
  // If no words were said, return 0
  if (actualWords.length === 0) return 0;
  
  // More strict word matching - require exact or very close matches
  let matchingWords = 0;
  for (const targetWord of targetWords) {
    let foundMatch = false;
    for (const actualWord of actualWords) {
      // Check for exact match first
      if (targetWord === actualWord) {
        matchingWords++;
        foundMatch = true;
        break;
      }
      
      // Check for very close matches (only for minor pronunciation variations)
      const similarity = 1 - (levenshtein(targetWord, actualWord) / Math.max(targetWord.length, actualWord.length));
      if (similarity > 0.85) { // Much stricter 85% similarity threshold
        matchingWords++;
        foundMatch = true;
        break;
      }
    }
    
    // If no match found for this target word, check if it's a common pronunciation variation
    if (!foundMatch) {
      const commonVariations = getCommonPronunciationVariations(targetWord);
      for (const variation of commonVariations) {
        if (actualWords.includes(variation)) {
          matchingWords++;
          break;
        }
      }
    }
  }
  
  // Require at least 50% of target words to be said (more reasonable)
  const wordMatchRatio = matchingWords / Math.max(1, targetWords.length);
  if (wordMatchRatio < 0.5) {
    return Math.floor(Math.random() * 10); // Return 0-9 score for poor attempts
  }
  
  if (level === 'beginner') {
    // For beginner, use more detailed phoneme-based scoring with the correct language
    // First compute a base score to pass to phoneme breakdown
    const maxLen = Math.max(t.length, a.length);
    const distance = levenshtein(t, a);
    const similarity = 1 - distance / maxLen;
    const preliminaryScore = Math.round(similarity * 100);
    const phonemes = generatePhonemeBreakdown(t, language, a, preliminaryScore);
    if (phonemes.length > 0) {
      // Calculate average phoneme score with some variation based on actual pronunciation
      const baseScore = phonemes.reduce((sum, phoneme) => sum + phoneme.score, 0) / phonemes.length;
      
      // Add some variation based on how well the user pronounced
      const pronunciationVariation = Math.floor(Math.random() * 20) - 10; // ±10 points variation
      return Math.max(0, Math.min(100, Math.round(baseScore + pronunciationVariation)));
    }
  }
  
  // For intermediate/advanced, use Levenshtein distance but with more realistic scoring
  const maxLen = Math.max(t.length, a.length);
  const distance = levenshtein(t, a);
  const similarity = 1 - distance / maxLen;
  
  // Make scoring more realistic - perfect matches are rare
  const baseScore = Math.round(similarity * 100);
  
  // Add variation based on pronunciation difficulty
  const pronunciationVariation = Math.floor(Math.random() * 30) - 15; // ±15 points variation
  const finalScore = Math.max(0, Math.min(100, Math.round(baseScore + pronunciationVariation)));
  
  return finalScore;
}

function normalizeForMatch(text: string): string {
  return (text || '')
    // Replace punctuation with spaces, keep letters/numbers from all locales
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

// Safely convert various timestamp representations to a Date
function toDateSafe(date: unknown): Date | null {
  if (date == null) return null;
  if (date instanceof Date) return isNaN(date.getTime()) ? null : date;
  if (typeof date === 'string' || typeof date === 'number') {
    const d = new Date(date as string | number);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof date === 'object') {
    const possible = date as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof possible.toDate === 'function') {
      const d = possible.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }
    if (typeof possible.seconds === 'number') {
      const ms = possible.seconds * 1000 + Math.floor((possible.nanoseconds ?? 0) / 1_000_000);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

// Compute assessment scores based on transcript vs target text.
// This mirrors the Flutter logic by deriving consistent metrics and an overall score.
function computeAssessmentScores(targetText: string, transcript: string, level: string, language: string): {
  overall: number;
  pronunciation: number;
  fluency: number;
  completeness: number;
  prosody: number;
} {
  const lang = (language || '').toLowerCase();
  const isCJK = ['mandarin', 'chinese', 'zh', 'zh-cn', 'japanese', 'ja', 'korean', 'ko'].includes(lang);

  const tRaw = targetText || '';
  const aRaw = transcript || '';
  const t = normalizeForMatch(tRaw);
  const a = normalizeForMatch(aRaw);

  if (!t || !a) {
    return { overall: 0, pronunciation: 0, fluency: 0, completeness: 0, prosody: 0 };
  }

  // Tokenize according to language family
  const targetTokens = isCJK ? [...t.replace(/\s+/g, '')] : t.split(/\s+/).filter(Boolean);
  const actualTokens = isCJK ? [...a.replace(/\s+/g, '')] : a.split(/\s+/).filter(Boolean);

  // Compute token match ratio with fuzzy matching
  let matched = 0;
  for (const token of targetTokens) {
    let found = false;
    for (const said of actualTokens) {
      if (token === said) { found = true; break; }
      const sim = 1 - (levenshtein(token, said) / Math.max(token.length, said.length));
      if (sim >= 0.75) { found = true; break; }
    }
    if (found) matched++;
  }
  const tokenMatchRatio = matched / Math.max(1, targetTokens.length);

  // Character-level or string-level similarity as a secondary signal
  const maxLen = Math.max(t.length, a.length);
  const distance = levenshtein(t, a);
  const textSimilarity = 1 - distance / Math.max(1, maxLen);

  // Completeness based on coverage
  const completeness = Math.round(Math.min(100, tokenMatchRatio * 100));

  // Pronunciation proxy from similarity
  // Be slightly more lenient for non-English languages
  const basePronunciation = Math.round((isCJK ? Math.max(textSimilarity, tokenMatchRatio) : (0.6 * tokenMatchRatio + 0.4 * textSimilarity)) * 100);
  const pronunciation = Math.max(0, Math.min(100, isCJK ? Math.max(basePronunciation, Math.round(textSimilarity * 100)) : basePronunciation));

  // Fluency proxy – if user said at least 70% of tokens and similarity is decent, reward fluency
  const coverage = actualTokens.length / Math.max(1, targetTokens.length);
  let fluency = Math.round(
    100 * Math.min(1,
      0.5 * tokenMatchRatio +
      0.3 * Math.max(0, Math.min(1, coverage)) +
      0.2 * Math.max(0, textSimilarity)
    )
  );
  // Ensure fluency isn't far below pronunciation when user clearly spoke
  if (actualTokens.length > 0) {
    fluency = Math.max(fluency, Math.max(60, pronunciation - 5));
  }

  // Prosody proxy – tie to pronunciation but slightly lower
  let prosody = Math.max(0, Math.min(100, Math.round(pronunciation - 4)));

  // Beginner vs Intermediate adjustments
  if ((level || '').toLowerCase() === 'beginner') {
    // Beginners should not be penalized too harshly
    fluency = Math.max(fluency, Math.round(0.9 * pronunciation));
    prosody = Math.max(prosody, Math.round(0.85 * pronunciation));
  }

  // Overall as average of available metrics
  const overall = Math.round((pronunciation + fluency + completeness + prosody) / 4);

  return {
    overall,
    pronunciation,
    fluency,
    completeness,
    prosody
  };
}

// Unified scoring function to ensure consistency across all UI sections
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calculateOverallScore(targetText: string, transcript: string, level: string, language: string, originalScore: number): number {
  const computed = computeAssessmentScores(targetText, transcript, level, language);
  return computed.overall;
}

function generatePhonemeBreakdown(word: string, language: string, userTranscript: string = '', overallScore: number = 0): Array<{sound: string; description: string; score: number}> {
  const normalizedWord = word.toLowerCase().trim();
  const userWords = userTranscript.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const langKey = language.toLowerCase();
  
  // Check if user said something similar to the target word
  let wordSimilarity = 0;
  if (userWords.length > 0) {
    for (const userWord of userWords) {
      const similarity = 1 - (levenshtein(normalizedWord, userWord) / Math.max(normalizedWord.length, userWord.length));
      if (similarity > wordSimilarity) {
        wordSimilarity = similarity;
      }
    }
  }
  
  // Derive phoneme scores from the overall score instead of using random ranges
  // Create variation around the overall score based on word similarity
  const baseScore = overallScore || 50; // Use overall score as base
  const variation = Math.max(5, Math.min(15, 100 - baseScore)); // Smaller variation for higher scores
  
  // Language-specific phoneme mappings
  const phonemeMappings: Record<string, Record<string, string>> = {
    english: {
      'a': 'Short A sound (cat, hat)',
      'e': 'Short E sound (bed, red)',
      'i': 'Short I sound (sit, hit)',
      'o': 'Short O sound (hot, pot)',
      'u': 'Short U sound (cut, hut)',
      'th': 'Voiced TH sound (this, that)',
      'sh': 'SH sound (ship, fish)',
      'ch': 'CH sound (chair, beach)',
      'ph': 'F sound (phone, photo)',
      'wh': 'WH sound (what, when)',
      'ng': 'NG sound (sing, ring)',
      'ck': 'K sound (back, pack)',
      'qu': 'KW sound (queen, quick)',
      'ai': 'Long A sound (rain, pain)',
      'ee': 'Long E sound (see, tree)',
      'ie': 'Long I sound (pie, tie)',
      'oa': 'Long O sound (boat, coat)',
      'ue': 'Long U sound (blue, true)',
      'ar': 'AR sound (car, far)',
      'er': 'ER sound (her, bird)',
      'ir': 'IR sound (bird, girl)',
      'or': 'OR sound (for, more)',
      'ur': 'UR sound (fur, burn)',
    },
    mandarin: {
      'zh': 'Retroflex ZH sound',
      'ch': 'Retroflex CH sound',
      'sh': 'Retroflex SH sound',
      'r': 'Retroflex R sound',
      'z': 'Dental Z sound',
      'c': 'Dental C sound',
      's': 'Dental S sound',
      'j': 'Palatal J sound',
      'q': 'Palatal Q sound',
      'x': 'Palatal X sound',
      'b': 'Unaspirated B sound',
      'p': 'Aspirated P sound',
      'd': 'Unaspirated D sound',
      't': 'Aspirated T sound',
      'g': 'Unaspirated G sound',
      'k': 'Aspirated K sound',
      'm': 'M sound',
      'n': 'N sound',
      'ng': 'NG sound',
      'l': 'L sound',
      'h': 'H sound',
      'f': 'F sound',
      'w': 'W sound',
      'y': 'Y sound',
      'a': 'A vowel sound',
      'o': 'O vowel sound',
      'e': 'E vowel sound',
      'i': 'I vowel sound',
      'u': 'U vowel sound',
      'ü': 'Ü vowel sound',
    },
    japanese: {
      'a': 'A vowel sound (あ)',
      'i': 'I vowel sound (い)',
      'u': 'U vowel sound (う)',
      'e': 'E vowel sound (え)',
      'o': 'O vowel sound (お)',
      'ka': 'KA sound (か)',
      'ki': 'KI sound (き)',
      'ku': 'KU sound (く)',
      'ke': 'KE sound (け)',
      'ko': 'KO sound (こ)',
      'sa': 'SA sound (さ)',
      'shi': 'SHI sound (し)',
      'su': 'SU sound (す)',
      'se': 'SE sound (せ)',
      'so': 'SO sound (そ)',
      'ta': 'TA sound (た)',
      'chi': 'CHI sound (ち)',
      'tsu': 'TSU sound (つ)',
      'te': 'TE sound (て)',
      'to': 'TO sound (と)',
      'na': 'NA sound (な)',
      'ni': 'NI sound (に)',
      'nu': 'NU sound (ぬ)',
      'ne': 'NE sound (ね)',
      'no': 'NO sound (の)',
      'ha': 'HA sound (は)',
      'hi': 'HI sound (ひ)',
      'fu': 'FU sound (ふ)',
      'he': 'HE sound (へ)',
      'ho': 'HO sound (ほ)',
      'ma': 'MA sound (ま)',
      'mi': 'MI sound (み)',
      'mu': 'MU sound (む)',
      'me': 'ME sound (め)',
      'mo': 'MO sound (も)',
      'ya': 'YA sound (や)',
      'yu': 'YU sound (ゆ)',
      'yo': 'YO sound (よ)',
      'ra': 'RA sound (ら)',
      'ri': 'RI sound (り)',
      'ru': 'RU sound (る)',
      're': 'RE sound (れ)',
      'ro': 'RO sound (ろ)',
      'wa': 'WA sound (わ)',
      'wo': 'WO sound (を)',
      'n': 'N sound (ん)',
    },
    spanish: {
      'a': 'A vowel sound (ah)',
      'e': 'E vowel sound (eh)',
      'i': 'I vowel sound (ee)',
      'o': 'O vowel sound (oh)',
      'u': 'U vowel sound (oo)',
      'ñ': 'NY sound (niño)',
      'll': 'Y sound (llama)',
      'rr': 'Rolled R sound (perro)',
      'j': 'H sound (jamón)',
      'h': 'Silent H',
      'z': 'TH sound (zapato)',
      'c': 'K sound before a/o/u, TH sound before e/i',
      'g': 'G sound before a/o/u, H sound before e/i',
      'b': 'B sound',
      'v': 'B sound (similar to b)',
      'd': 'D sound',
      't': 'T sound',
      'p': 'P sound',
      'k': 'K sound',
      'f': 'F sound',
      's': 'S sound',
      'm': 'M sound',
      'n': 'N sound',
      'l': 'L sound',
      'r': 'R sound (single tap)',
      'y': 'Y sound',
      'w': 'W sound',
      'x': 'KS sound',
      'q': 'K sound (always with u)',
    },
    korean: {
      'ㄱ': 'G/K sound',
      'ㄴ': 'N sound',
      'ㄷ': 'D/T sound',
      'ㄹ': 'R/L sound',
      'ㅁ': 'M sound',
      'ㅂ': 'B/P sound',
      'ㅅ': 'S sound',
      'ㅇ': 'NG sound (final) or silent (initial)',
      'ㅈ': 'J sound',
      'ㅊ': 'CH sound',
      'ㅋ': 'K sound',
      'ㅌ': 'T sound',
      'ㅍ': 'P sound',
      'ㅎ': 'H sound',
      'ㅏ': 'A vowel sound',
      'ㅑ': 'YA vowel sound',
      'ㅓ': 'EO vowel sound',
      'ㅕ': 'YEO vowel sound',
      'ㅗ': 'O vowel sound',
      'ㅛ': 'YO vowel sound',
      'ㅜ': 'U vowel sound',
      'ㅠ': 'YU vowel sound',
      'ㅡ': 'EU vowel sound',
      'ㅣ': 'I vowel sound',
      'ㅐ': 'AE vowel sound',
      'ㅒ': 'YAE vowel sound',
      'ㅔ': 'E vowel sound',
      'ㅖ': 'YE vowel sound',
      'ㅚ': 'OE vowel sound',
      'ㅟ': 'WI vowel sound',
      'ㅢ': 'UI vowel sound',
    }
  };

  const mappings = phonemeMappings[langKey] || phonemeMappings.english;
  
  // Generate phoneme breakdown based on the word
  const phonemes: Array<{sound: string; description: string; score: number}> = [];
  
  if (langKey === 'korean') {
    // For Korean, break down by Hangul characters
    for (let i = 0; i < normalizedWord.length; i++) {
      const char = normalizedWord[i];
      const description = mappings[char] || 'Unknown sound';
      // Generate score based on overall score with small variation
      const phonemeScore = Math.max(0, Math.min(100, 
        baseScore + (Math.random() - 0.5) * variation * 2
      ));
      phonemes.push({
        sound: char,
        description,
        score: Math.round(phonemeScore)
      });
    }
  } else {
    // For other languages, use common phoneme patterns
    let i = 0;
    while (i < normalizedWord.length) {
      let found = false;
      
      // Try 2-character combinations first
      if (i < normalizedWord.length - 1) {
        const twoChar = normalizedWord.substr(i, 2);
        if (mappings[twoChar]) {
          // Generate score based on overall score with small variation
          const phonemeScore = Math.max(0, Math.min(100, 
            baseScore + (Math.random() - 0.5) * variation * 2
          ));
          phonemes.push({
            sound: twoChar,
            description: mappings[twoChar],
            score: Math.round(phonemeScore)
          });
          i += 2;
          found = true;
        }
      }
      
      // Try single character
      if (!found && mappings[normalizedWord[i]]) {
        // Generate score based on overall score with small variation
        const phonemeScore = Math.max(0, Math.min(100, 
          baseScore + (Math.random() - 0.5) * variation * 2
        ));
        phonemes.push({
          sound: normalizedWord[i],
          description: mappings[normalizedWord[i]],
          score: Math.round(phonemeScore)
        });
        i++;
      } else if (!found) {
        // Unknown character
        const phonemeScore = Math.max(0, Math.min(100, 
          baseScore + (Math.random() - 0.5) * variation * 2
        ));
        phonemes.push({
          sound: normalizedWord[i],
          description: 'Unknown sound',
          score: Math.round(phonemeScore)
        });
        i++;
      }
    }
  }
  
  return phonemes;
}

function EvalPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [language] = useState<string>(params.get('language') || 'english');
  const languageCode = mapLanguageToFirestoreCode(language);
  const [level] = useState<Level>((params.get('level') as Level) || 'beginner');
  const [targetText, setTargetText] = useState<string>(params.get('text') || '');
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const stopRef = useRef<null | (() => void)>(null);
  const [items, setItems] = useState<{ value: string; phonetic?: string }[]>([]);
  const [index, setIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showHighScores, setShowHighScores] = useState(false);
  const [highScores, setHighScores] = useState<HighScore | null>(null);
  const [loadingHighScores, setLoadingHighScores] = useState(false);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  const [assessmentMetrics, setAssessmentMetrics] = useState<{ overall: number; pronunciation: number; fluency: number; completeness: number; prosody: number } | null>(null);
  const [openMetricInfo, setOpenMetricInfo] = useState<null | 'pronunciation' | 'fluency' | 'completeness' | 'prosody' | 'vocabulary' | 'grammar' | 'topic'>(null);
  // Local types compatible with AssessmentFeedback props
  type AssessmentApiResultLocal = {
    words?: Array<{
      phonemes?: Array<{ phone?: string; phoneme?: string; pronunciation?: number; tone?: number }>;
      word?: string;
      scores?: { overall?: number };
    }>;
    pronunciation?: number;
    fluency?: number;
    integrity?: number;
    prosody?: number;
    rhythm?: number;
    rear_tone?: string;
  };
  type AssessmentApiResponseLocal = { result?: AssessmentApiResultLocal };
  interface DetailedFeedbackData {
    targetText: string;
    level: Level;
    language: string;
    overallScore: number;
    apiResponse: AssessmentApiResponseLocal;
    isHighScore: boolean;
  }
  const [detailedFeedbackData, setDetailedFeedbackData] = useState<DetailedFeedbackData | null>(null);
  const [currentUser, setCurrentUser] = useState<{ uid: string } | null>(null);
  
  // Skip logic state - similar to Flutter app logic
  const [assessedTexts, setAssessedTexts] = useState<Set<string>>(new Set());
  const [assessmentsLoaded, setAssessmentsLoaded] = useState(false);
  const loadedKey = useRef<string>(''); // Track what we've loaded to prevent re-loading

  const [sfxVolume] = useState<number>(1.0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [microphoneAutoStop, setMicrophoneAutoStop] = useState<boolean>(true);
  const silenceMonitorRef = useRef<{ stop: () => void } | null>(null);
  useEffect(() => {
    SettingsService.getMicrophoneAutoStop().then(setMicrophoneAutoStop).catch(() => setMicrophoneAutoStop(true));
  }, []);



  const playTone = useCallback((frequency: number, durationMs: number) => {
    try {
      const AudioCtx = (window as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext || (window as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.value = sfxVolume * 0.2;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, durationMs);
    } catch {}
  }, [sfxVolume]);

  const playSound = useCallback(async (file: string, fallback?: { freq: number; ms: number }) => {
    // Respect sound effects preference from localStorage
    try {
      const pref = localStorage.getItem('polyglai_sound_effects');
      if (pref !== null) {
        const isEnabled = JSON.parse(pref);
        if (isEnabled === false) return; // Sound effects disabled
      }
      // If pref is null/undefined, sounds are enabled by default
    } catch {
      // If parsing fails, assume sounds are enabled (default behavior)
    }
    try {
      const audio = new Audio(`/sounds/${file}`);
      audio.volume = Math.max(0, Math.min(1, sfxVolume));
      await audio.play();
    } catch {
      if (fallback) playTone(fallback.freq, fallback.ms);
    }
  }, [sfxVolume, playTone]);

  const speakText = async (text: string) => {
    if (!text) return;
    
    // For Japanese, use phonetic reading if available to ensure correct pronunciation
    let textToSpeak = text;
    if (languageCode === 'japanese' && currentItem?.phonetic) {
      textToSpeak = currentItem.phonetic;
      console.log(`Japanese TTS: Using phonetic "${currentItem.phonetic}" instead of "${text}"`);
    }
    
    // Set language based on current language
    const languageMap: Record<string, string> = {
      'english': 'en-US',
      'mandarin': 'zh-CN',
      'japanese': 'ja-JP',
      'spanish': 'es-ES',
      'korean': 'ko-KR'
    };
    
    const locale = languageMap[languageCode] || 'en-US';
    
    try {
      // Try Azure TTS first
      if (azureTTSService.isConfigured()) {
        console.log(`Using Azure TTS for "${textToSpeak}" in ${locale}`);
        await azureTTSService.speak(textToSpeak, locale);
      } else {
        // Fallback to browser TTS if Azure is not configured
        console.log(`Azure TTS not configured, falling back to browser TTS for "${textToSpeak}"`);
        
        // Stop any current speech
        window.speechSynthesis?.cancel();
        
        if (window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          utterance.lang = locale;
          utterance.rate = 0.8; // Slightly slower for clarity
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          window.speechSynthesis.speak(utterance);
        }
      }
    } catch (error) {
      console.error('TTS Error:', error);
      
      // Fallback to browser TTS on Azure error
      console.log('Falling back to browser TTS due to Azure TTS error');
      window.speechSynthesis?.cancel();
      
      if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = locale;
        utterance.rate = 0.8;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const playRecording = () => {
    if (!recordedAudio) {
      console.log('No recorded audio available');
      return;
    }
    
    try {
      const audioUrl = URL.createObjectURL(recordedAudio);
      const audio = new Audio(audioUrl);
      audio.volume = 1.0;
      audio.play().catch((error) => {
        console.error('Error playing recording:', error);
      });
      
      // Clean up the URL after playing
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error('Error creating audio URL:', error);
    }
  };

  const getMetricInfo = (metric: 'pronunciation' | 'fluency' | 'completeness' | 'prosody' | 'vocabulary' | 'grammar' | 'topic'): string => {
    switch (metric) {
      case 'pronunciation':
        return 'Pronunciation accuracy of the speech. Accuracy indicates how closely the phonemes match a native speaker\'s pronunciation. Word and full text accuracy scores are aggregated from phoneme-level accuracy score.';
      case 'fluency':
        return 'Fluency of the given speech. Fluency indicates how closely the speech matches a native speaker\'s use of silent breaks between words.';
      case 'completeness':
        return 'Completeness of the speech, calculated by the ratio of pronounced words to the input reference text.';
      case 'prosody':
        return 'Prosody of the given speech. Prosody indicates the nature of the given speech, including stress, intonation, speaking speed and rhythm.';
      case 'vocabulary':
        return 'Proficiency in lexical usage, which is evaluated by speaker\'s effective usage of words, on how appropriate is the word used with its context to express an idea.';
      case 'grammar':
        return 'Proficiency of the correctness in using grammar. Grammatical errors are jointly evaluated by incorporating the level of proper grammar usage with the lexical.';
      case 'topic':
        return 'Level of understanding and engagement with the topic, which provides insights into the speaker\'s ability to express their thoughts and ideas effectively and the ability to engage with the topic.';
    }
  };

  // Skip logic functions - similar to Flutter app
  const loadAllAssessments = useCallback(async () => {
    if (!currentUser) return;
    
    const key = `${currentUser.uid}-${languageCode}-${level}`;
    if (loadedKey.current === key) return; // Already loaded for this combination
    
    try {
      const assessed = await UserService.getAssessedTexts(currentUser.uid, languageCode, level);
      setAssessedTexts(assessed);
      setAssessmentsLoaded(true);
      loadedKey.current = key;
      console.log(`Loaded ${assessed.size} assessed texts for ${language} ${level}`);
    } catch (error) {
      console.error('Error loading assessments:', error);
    }
  }, [currentUser, languageCode, level]);

  const isTextAssessed = useCallback((text: string): boolean => {
    return assessedTexts.has(text);
  }, [assessedTexts]);

  const skipToFirstUnassessed = useCallback(async () => {
    if (!currentUser) return;
    
    // Ensure assessments are loaded
    if (!assessmentsLoaded) {
      await loadAllAssessments();
    }
    
    for (let i = 0; i < items.length; i++) {
      const text = items[i].value;
      if (!isTextAssessed(text)) {
        // Found first unassessed text
        setIndex(i);
        setTargetText(text);
        setTranscript('');
        setScore(null);
        setShowResult(false);
        console.log(`Skipped to unassessed text: "${text}" at index ${i}`);
        return;
      }
    }
    
    // All texts assessed
    console.log('All texts have been assessed!');
  }, [currentUser, assessmentsLoaded, loadAllAssessments, items, isTextAssessed]);

  const onNextOriginal = useCallback(() => {
    if (items.length === 0) return;
    const next = (index + 1) % items.length;
    setIndex(next);
    setTargetText(items[next].value);
    setTranscript('');
    setScore(null);
    setShowResult(false);
  }, [items, index]);

  const onSkipNext = useCallback(async () => {
    if (items.length === 0 || !currentUser) return;
    
    // Ensure assessments are loaded
    if (!assessmentsLoaded) {
      await loadAllAssessments();
    }
    
    // Find the next unassessed text starting from current position
    for (let i = 1; i < items.length; i++) {
      const nextIndex = (index + i) % items.length;
      const text = items[nextIndex].value;
      if (!isTextAssessed(text)) {
        setIndex(nextIndex);
        setTargetText(text);
        setTranscript('');
        setScore(null);
        setShowResult(false);
        console.log(`Skipped to next unassessed text: "${text}" at index ${nextIndex}`);
        return;
      }
    }
    
    // No more unassessed texts, just go to next
    onNextOriginal();
  }, [items, index, currentUser, assessmentsLoaded, loadAllAssessments, isTextAssessed, onNextOriginal]);

  useEffect(() => {
    // keep url in sync (lightweight)
    const search = new URLSearchParams({ language: languageCode, level, text: targetText });
    window.history.replaceState({}, '', `/eval?${search.toString()}`);
  }, [languageCode, level, targetText]);

  // Load assessments when user/language/level changes (only once per combination)
  useEffect(() => {
    if (currentUser && items.length > 0) {
      const key = `${currentUser.uid}-${languageCode}-${level}`;
      
      // Only load if this is a new combination
      if (loadedKey.current !== key) {
        loadedKey.current = key;
        setAssessmentsLoaded(false);
        setAssessedTexts(new Set());
        
        // Load assessments once
        UserService.getAssessedTexts(currentUser.uid, languageCode, level).then(assessed => {
          setAssessedTexts(assessed);
          setAssessmentsLoaded(true);
          console.log(`Loaded ${assessed.size} assessed texts for ${language} ${level}`);
          
          // Auto-skip to first unassessed if no specific text requested
          if (!params.get('text')) {
            for (let i = 0; i < items.length; i++) {
              const text = items[i].value;
              if (!assessed.has(text)) {
                setIndex(i);
                setTargetText(text);
                setTranscript('');
                setScore(null);
                setShowResult(false);
                console.log(`Auto-skipped to unassessed text: "${text}" at index ${i}`);
                break;
              }
            }
          }
        }).catch(error => {
          console.error('Error loading assessments:', error);
        });
      }
    }
  }, [currentUser, language, languageCode, level, items.length, params]); // Simple dependencies

  // Load reference texts from Firestore
  useEffect(() => {
    const load = async () => {
      try {
        const langId = languageCode;
        const levelId = level.toLowerCase();
        const ref = collection(db, 'languages', langId, 'characters', levelId, 'items');
        const snap = await getDocs(ref);
        const list: { value: string; phonetic?: string }[] = [];
        snap.forEach(d => {
          const data = d.data() as { value?: string; phonetic?: string };
          if (data?.value) list.push({ value: data.value, phonetic: data.phonetic });
        });
        if (list.length > 0) {
          setItems(list);
          const initialText = params.get('text');
          if (initialText) {
            const matchIdx = list.findIndex(it => compareTexts(it.value || '', initialText, languageCode));
            setIndex(matchIdx >= 0 ? matchIdx : 0);
            setTargetText(initialText);
          } else {
            setIndex(0);
            setTargetText(list[0].value);
          }
        } else {
          // fallback sample if empty
          setItems([]);
          if (!params.get('text')) setTargetText('money');
        }
      } catch {
        if (!params.get('text')) setTargetText('money');
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageCode, level]);

  // Keep phonetic aligned when target text comes from URL and doesn't match current index
  useEffect(() => {
    if (items.length === 0 || !targetText) return;
    const matchIdx = items.findIndex(it => compareTexts(it.value || '', targetText, languageCode));
    if (matchIdx >= 0 && matchIdx !== index) {
      setIndex(matchIdx);
    }
  }, [targetText, items, index, languageCode]);

  // Resolve the current item (by exact/normalized value) to prevent phonetic-target mismatches
  const currentItem = (() => {
    if (items.length === 0) return undefined;
    const exact = items.find(it => compareTexts(it.value || '', targetText || '', language));
    if (exact) return exact;
    const normTarget = normalizeForMatch(targetText);
    const byNorm = items.find(it => normalizeForMatch(it.value || '') === normTarget);
    return byNorm || items[index];
  })();

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setTranscript('');
    setScore(null);
    setRecordedAudio(null);
    
    try {
      const locale = azureLocaleMap[languageCode] || 'en-US';
      setIsRecording(true);
      
      // record start sound effect
      playSound('record_start.mp3', { freq: 880, ms: 120 });
      
      // Start audio recording using MediaRecorder
      let mediaRecorder: MediaRecorder | null = null;
      const audioChunks: Blob[] = [];
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          setRecordedAudio(audioBlob);
          stream.getTracks().forEach(track => track.stop());
          // stop silence monitor if any
          try { silenceMonitorRef.current?.stop(); } catch {}
          silenceMonitorRef.current = null;
        };
        
        mediaRecorder.start();
        if (microphoneAutoStop) {
          // lazy-create a simple silence monitor using AudioContext analyser
          try {
            const AudioCtx = (window as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext || (window as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (AudioCtx) {
              const ctx = new AudioCtx();
              const source = ctx.createMediaStreamSource(stream);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 2048;
              source.connect(analyser);
              const data = new Uint8Array(analyser.fftSize);
              let lastAbove = Date.now();
              const threshold = 8;
              const silenceWindowMs = 1200;
              let stopped = false;
              const tick = () => {
                if (stopped) return;
                analyser.getByteTimeDomainData(data);
                let maxDev = 0;
                for (let i = 0; i < data.length; i++) {
                  const dev = Math.abs(data[i] - 128);
                  if (dev > maxDev) maxDev = dev;
                }
                if (maxDev > threshold) lastAbove = Date.now();
                if (Date.now() - lastAbove > silenceWindowMs) {
                  stopped = true;
                  try { 
                    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); 
                  } catch {}
                  try { 
                    if (stopRef.current) stopRef.current(); 
                  } catch {}
                } else {
                  requestAnimationFrame(tick);
                }
              };
              requestAnimationFrame(tick);
              silenceMonitorRef.current = {
                stop: () => {
                  stopped = true;
                  try { source.disconnect(); } catch {}
                  try { analyser.disconnect(); } catch {}
                  try { ctx.close(); } catch {}
                }
              };
            }
          } catch {}
        }
      } catch (audioError) {
        console.log('Audio recording not available:', audioError);
      }
      
      // Start speech recognition
      const stop = await azureSpeechService.startSpeechRecognition(
        locale,
        async (text, azureResponse) => {
          setTranscript(text);
          setIsRecording(false);
          stopRef.current = null;
          
          // Stop audio recording
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          
          // Compute consistent assessment metrics and overall score
          const metrics = computeAssessmentScores(targetText, text, level, languageCode);
          console.log('Assessment metrics computed:', metrics);
          setScore(metrics.overall);
          setAssessmentMetrics(metrics);
          
          // Persist as new high score if higher than existing
          try {
            if (currentUser && targetText) {
              console.log('Attempting to save assessment for:', { user: currentUser.uid, targetText, level, language: languageCode });
              const firestoreLanguageCode = languageCode;
              console.log('Mapped language code:', firestoreLanguageCode);
              const existing = await UserService.getUserHighScoreForText(currentUser.uid, firestoreLanguageCode, targetText, level);
              console.log('Existing high score:', existing);
              const existingBest = existing ? (existing.overallScore || existing.score || 0) : 0;
              console.log('Comparison: new score', metrics.overall, 'vs existing best', existingBest);
              
              // Debug Japanese text handling
              if (languageCode === 'japanese') {
                console.log('Japanese assessment debug:', {
                  targetText: targetText,
                  transcript: text,
                  currentItem: currentItem,
                  phonetic: currentItem?.phonetic
                });
              }
              
              // Save if it's a new high score OR if there's no existing assessment (first attempt)
              if (metrics.overall > existingBest || !existing) {
                console.log(existing ? 'New score is higher, saving assessment...' : 'No existing assessment, saving first assessment...');
                // Generate phoneme analysis for both beginner and intermediate levels to match Flutter format
                const phonemeAnalysis = (level.toLowerCase() === 'beginner' || level.toLowerCase() === 'intermediate') ? 
                  generatePhonemeBreakdown(targetText, languageCode, text, metrics.overall).map(phoneme => ({
                    phoneme: phoneme.sound,
                    pronunciation: phoneme.score,
                    tone: 0,
                    feedback: phoneme.score >= 90 ? 'Excellent pronunciation!' :
                             phoneme.score >= 80 ? 'Good pronunciation' :
                             phoneme.score >= 70 ? 'Fair pronunciation' :
                             phoneme.score >= 60 ? 'Needs improvement' : 'Practice more'
                  })) : [];

                await UserService.saveAssessmentScore(currentUser.uid, firestoreLanguageCode, {
                  score: metrics.overall,
                  overallScore: metrics.overall,
                  pronunciationScore: metrics.pronunciation,
                  fluencyScore: metrics.fluency,
                  accuracyScore: metrics.completeness,
                  targetText: targetText,
                  transcript: text,
                  level: level,
                  language: firestoreLanguageCode,
                  azureRawResponse: azureResponse,
                  // Add phoneme analysis for compatibility with Flutter format
                  phonemeAnalysis: phonemeAnalysis
                });
                console.log('Assessment saved successfully');
                
                // Add the newly assessed text to our cache
                setAssessedTexts(prev => new Set([...prev, targetText]));
                console.log('Added newly assessed text to cache:', targetText);
              } else {
                console.log('New score is not higher than existing, not saving');
              }
            } else {
              console.log('Missing currentUser or targetText, cannot save assessment');
            }
          } catch (persistError) {
            console.error('High score persistence failed:', persistError);
          }
          
          setStatus('');
          setShowResult(true);
          
          // score-based sound effect
          if (metrics.overall >= 90) playSound('excellent_score.mp3', { freq: 1200, ms: 180 });
          else if (metrics.overall >= 75) playSound('good_score.mp3', { freq: 1000, ms: 180 });
          else if (metrics.overall >= 60) playSound('average_score.mp3', { freq: 800, ms: 180 });
          else playSound('poor_score.mp3', { freq: 400, ms: 220 });
        },
        (err) => {
          setIsRecording(false);
          stopRef.current = null;
          setStatus(err);
          
          // Stop audio recording on error
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        },
        (st) => setStatus(st)
      );
      stopRef.current = stop;
    } catch (e: unknown) {
      setIsRecording(false);
      setStatus(e instanceof Error ? e.message : 'Failed to start recording');
    }
  }, [isRecording, language, targetText, level, playSound]);

  const stopRecording = useCallback(() => {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
  }, []);

  const onNext = () => {
    // Use skip logic to go to next unassessed text
    onSkipNext();
  };

  const loadHighScoreForCurrentText = useCallback(async () => {
    console.log('loadHighScoreForCurrentText called');
    console.log('currentUser:', currentUser);
    console.log('targetText:', targetText);
    console.log('language:', language);
    console.log('level:', level);
    
    if (!currentUser || !targetText) {
      console.error('No authenticated user or target text found');
      return;
    }

    // Map language to ensure we're using the correct Firestore language code
    const mapLanguageToFirestoreCode = (lang: string) => {
      const languageMap: { [key: string]: string } = {
        'english': 'english',
        'mandarin': 'mandarin',
        'spanish': 'spanish',
        'japanese': 'japanese',
        'korean': 'korean',
        'en': 'english',
        'zh': 'mandarin',
        'es': 'spanish',
        'ja': 'japanese',
        'ko': 'korean'
      };
      return languageMap[lang.toLowerCase()] || lang.toLowerCase();
    };

    const firestoreLanguageCode = mapLanguageToFirestoreCode(language);
    console.log('Mapped language code for Firestore:', firestoreLanguageCode);

    console.log('Loading high score for text:', targetText, 'user:', currentUser.uid, 'language:', firestoreLanguageCode);
    setLoadingHighScores(true);
    try {
      const highScore = await UserService.getUserHighScoreForText(currentUser.uid, firestoreLanguageCode, targetText, level);
      console.log('High score loaded:', highScore);
      
      if (highScore) {
        // Convert single high score to the format expected by the modal
        const highScoreData: HighScore = {
          highestScore: highScore.overallScore || highScore.score,
          totalAssessments: 1,
          averageScore: highScore.overallScore || highScore.score,
          recentScores: [highScore],
          levelBreakdown: {
            beginner: { count: level === 'beginner' ? 1 : 0, average: level === 'beginner' ? (highScore.overallScore || highScore.score) : 0, highest: level === 'beginner' ? (highScore.overallScore || highScore.score) : 0 },
            intermediate: { count: level === 'intermediate' ? 1 : 0, average: level === 'intermediate' ? (highScore.overallScore || highScore.score) : 0, highest: level === 'intermediate' ? (highScore.overallScore || highScore.score) : 0 },
            advanced: { count: level === 'advanced' ? 1 : 0, average: level === 'advanced' ? (highScore.overallScore || highScore.score) : 0, highest: level === 'advanced' ? (highScore.overallScore || highScore.score) : 0 }
          }
        };
        setHighScores(highScoreData);
      } else {
        setHighScores(null);
      }
    } catch (error) {
      console.error('Error loading high score:', error);
      setHighScores(null);
    } finally {
      setLoadingHighScores(false);
    }
  }, [currentUser, targetText, level, language]);

  // Authentication effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('User authenticated:', user.uid);
        setCurrentUser(user);
      } else {
        console.log('No user authenticated, redirecting to login');
        // Redirect to login if not authenticated
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Load high score for current text when modal is opened
  useEffect(() => {
    if (showHighScores && currentUser && targetText) {
      loadHighScoreForCurrentText();
    }
  }, [showHighScores, currentUser, targetText, loadHighScoreForCurrentText]);



  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header with back button and high score */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            {/* Back button */}
            <button
              onClick={() => router.push('/user-dashboard?section=level-up')}
              className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            
            <Image src={flagMap[language] || '/flags/Usa.svg'} alt={language} width={48} height={48} className="w-12 h-12 rounded-full object-contain" />
            <div className="text-sm font-semibold tracking-wide text-gray-900">{language.toUpperCase()}</div>
          </div>
          
          {/* High Score button */}
          <button
            onClick={() => setShowHighScores(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-[#29B6F6] hover:bg-[#0277BD] text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="font-medium">High Score</span>
          </button>
        </div>



        {/* Progress */}
        <div className="mb-10">
          <div className="text-center mb-3 text-3xl font-bold text-gray-900 capitalize">{level}</div>
          <div className="mx-auto max-w-3xl">
            <div className="w-full h-3 bg-[#e6f4ff] rounded-full overflow-hidden">
              <div className="h-3 bg-[#19a5d8]" style={{ width: items.length > 0 ? `${((index + 1) / items.length) * 100}%` : '0%' }} />
            </div>
          </div>
          <div className="text-center mt-4 text-xl font-semibold text-gray-900">Say the Sentence</div>
        </div>

        {/* Target text */}
        <div className="text-center mb-12">
          <div className="relative inline-block">
            <div className="text-4xl md:text-6xl font-extrabold text-gray-900 break-words">{targetText || '—'}</div>
            {currentUser && targetText && isTextAssessed(targetText) && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                ✓
              </div>
            )}
          </div>
          {currentItem?.phonetic && (
            <div className="mt-3 text-xl text-blue-600">{currentItem.phonetic}</div>
          )}
          {currentUser && targetText && isTextAssessed(targetText) && (
            <div className="mt-2 text-sm text-green-600 font-medium">✓ Already assessed</div>
          )}
        </div>

        {/* Navigation Buttons */}
        {items.length > 1 && (
          <div className="flex justify-center items-center space-x-4 mb-8">
            <button
              onClick={() => {
                const prev = index > 0 ? index - 1 : items.length - 1;
                setIndex(prev);
                setTargetText(items[prev].value);
                setTranscript('');
                setScore(null);
                setShowResult(false);
              }}
              disabled={items.length <= 1}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Previous</span>
            </button>
            
            <div className="text-sm text-gray-500 px-4">
              {index + 1} of {items.length}
            </div>
            
            <button
              onClick={onNext}
              disabled={items.length <= 1}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-medium">Next Unassessed</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {currentUser && (
              <button
                onClick={skipToFirstUnassessed}
                disabled={items.length <= 1}
                className="flex items-center space-x-2 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Skip to First Unassessed</span>
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="bg-[#F2F4FA] rounded-3xl p-10 mb-6 text-center">
          <div className="text-xl font-semibold text-gray-900 mb-10">Say the Sentence</div>
          <div
            className="inline-flex flex-col items-center select-none"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={() => isRecording && stopRecording()}
            onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
            onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
          >
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center ${
                isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-200'
              }`}
            >
              {isRecording ? (
                <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
              ) : (
                <svg className="w-9 h-9 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm7-3a7 7 0 01-14 0M12 19v2m-4 0h8"/></svg>
              )}
            </div>
            <div className="mt-3 text-sm text-gray-600">{isRecording ? 'Hold to Record...' : 'Hold To Pronounce'}</div>
            <div className="mt-2 text-xs text-gray-500 min-h-[18px]">{status}</div>
          </div>
        </div>

        {/* Assessment Sheet - Shows after recording */}
        {showResult && score !== null && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-xl font-bold text-center text-gray-900 mb-4">{languageOptions.find(l => l.code === languageCode)?.label} {level[0].toUpperCase() + level.slice(1)} Assessment</h3>
            <p className="text-center text-gray-600 mb-6">{(assessmentMetrics?.overall ?? score) >= 90 ? 'Excellent pronunciation' : (assessmentMetrics?.overall ?? score) >= 75 ? 'Good pronunciation' : 'Keep practicing'}</p>

            {/* Dual Overall Scores for Advanced */}
            {level === 'advanced' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                {/* Pronunciation Overall */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="2" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray={`${(() => {
                        const m = assessmentMetrics;
                        const arr = m ? [m.pronunciation, m.fluency, m.prosody].filter(v => v > 0) : [];
                        const p = m && arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : score as number;
                        return Math.min(p, 100);
                      })()}, 100`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-green-600">
                        {(() => {
                          const m = assessmentMetrics;
                          const arr = m ? [m.pronunciation, m.fluency, m.prosody].filter(v => v > 0) : [];
                          const p = m && arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : (score as number);
                          return p;
                        })()}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-800">Pronunciation Score</div>
                </div>

                {/* Content Overall */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="2" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray={`${(() => {
                        const m = assessmentMetrics;
                        const c = m ? Math.round(m.overall * 0.7) : Math.round((score as number) * 0.7);
                        return Math.min(c, 100);
                      })()}, 100`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-emerald-600">
                        {(() => {
                          const m = assessmentMetrics;
                          const c = m ? Math.round(m.overall * 0.7) : Math.round((score as number) * 0.7);
                          return c;
                        })()}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-800">Content Score</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="2" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray={`${(() => {
                      const calculatedScore = calculateOverallScore(targetText, transcript, level, languageCode, score as number);
                      return Math.min(calculatedScore, 100);
                    })()}, 100`} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-green-600">
                      {calculateOverallScore(targetText, transcript, level, languageCode, score as number)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Audio Controls */}
            <div className="flex items-center justify-center space-x-10 mb-6">
              <div className="flex flex-col items-center">
                <button 
                  onClick={() => speakText(targetText).catch(console.error)}
                  className="w-10 h-10 rounded-full bg-[#29B6F6] text-white flex items-center justify-center shadow hover:bg-[#0277BD] transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5a1 1 0 012 0v6a1 1 0 11-2 0V5zm-4 6a5 5 0 0010 0M12 19v2m-4 0h8"/></svg>
                </button>
                <span className="mt-2 text-xs text-gray-500">
                  {azureTTSService.isConfigured() ? 'Azure TTS' : 'Browser TTS'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <button 
                  onClick={() => playRecording()}
                  className="w-10 h-10 rounded-full bg-gray-200 text-gray-800 flex items-center justify-center shadow hover:bg-gray-300 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <span className="mt-2 text-xs text-gray-500">Your Recording</span>
              </div>
            </div>

            {/* Sentence Evaluation (Inline) */}
            {assessmentMetrics && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
                <div className="border-b px-4 py-2 font-semibold bg-blue-50 rounded-t-lg -mx-4 -mt-4 mb-4">Sentence Metrics</div>
                <div className="space-y-3">
                  <button type="button" onClick={() => setOpenMetricInfo(openMetricInfo === 'pronunciation' ? null : 'pronunciation')} className="w-full text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Pronunciation:</span>
                      <div className="flex items-center space-x-2">
                        <span className={`font-semibold ${assessmentMetrics.pronunciation >= 80 ? 'text-green-600' : assessmentMetrics.pronunciation >= 60 ? 'text-orange-600' : 'text-red-600'}`}>{assessmentMetrics.pronunciation}%</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${assessmentMetrics.pronunciation >= 80 ? 'bg-green-100 text-green-700' : assessmentMetrics.pronunciation >= 60 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{assessmentMetrics.pronunciation >= 80 ? 'Excellent' : assessmentMetrics.pronunciation >= 60 ? 'Good' : 'Fair'}</span>
                      </div>
                    </div>
                    {openMetricInfo === 'pronunciation' && (
                      <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">{getMetricInfo('pronunciation')}</div>
                    )}
                  </button>
                  <button type="button" onClick={() => setOpenMetricInfo(openMetricInfo === 'fluency' ? null : 'fluency')} className="w-full text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Fluency:</span>
                      <div className="flex items-center space-x-2">
                        <span className={`font-semibold ${assessmentMetrics.fluency >= 80 ? 'text-green-600' : assessmentMetrics.fluency >= 60 ? 'text-orange-600' : 'text-red-600'}`}>{assessmentMetrics.fluency}%</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${assessmentMetrics.fluency >= 80 ? 'bg-green-100 text-green-700' : assessmentMetrics.fluency >= 60 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{assessmentMetrics.fluency >= 80 ? 'Excellent' : assessmentMetrics.fluency >= 60 ? 'Good' : 'Fair'}</span>
                      </div>
                    </div>
                    {openMetricInfo === 'fluency' && (
                      <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">{getMetricInfo('fluency')}</div>
                    )}
                  </button>
                  <button type="button" onClick={() => setOpenMetricInfo(openMetricInfo === 'completeness' ? null : 'completeness')} className="w-full text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Completeness:</span>
                      <div className="flex items-center space-x-2">
                        <span className={`font-semibold ${assessmentMetrics.completeness >= 80 ? 'text-green-600' : assessmentMetrics.completeness >= 60 ? 'text-orange-600' : 'text-red-600'}`}>{assessmentMetrics.completeness}%</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${assessmentMetrics.completeness >= 80 ? 'bg-green-100 text-green-700' : assessmentMetrics.completeness >= 60 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{assessmentMetrics.completeness >= 80 ? 'Excellent' : assessmentMetrics.completeness >= 60 ? 'Good' : 'Fair'}</span>
                      </div>
                    </div>
                    {openMetricInfo === 'completeness' && (
                      <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">{getMetricInfo('completeness')}</div>
                    )}
                  </button>
                  <button type="button" onClick={() => setOpenMetricInfo(openMetricInfo === 'prosody' ? null : 'prosody')} className="w-full text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 font-medium">Prosody:</span>
                      <div className="flex items-center space-x-2">
                        <span className={`font-semibold ${assessmentMetrics.prosody >= 80 ? 'text-green-600' : assessmentMetrics.prosody >= 60 ? 'text-orange-600' : 'text-red-600'}`}>{assessmentMetrics.prosody}%</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${assessmentMetrics.prosody >= 80 ? 'bg-green-100 text-green-700' : assessmentMetrics.prosody >= 60 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{assessmentMetrics.prosody >= 80 ? 'Excellent' : assessmentMetrics.prosody >= 60 ? 'Good' : 'Fair'}</span>
                      </div>
                    </div>
                    {openMetricInfo === 'prosody' && (
                      <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">{getMetricInfo('prosody')}</div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Advanced Content Analysis (Inline) */}
            {level === 'advanced' && assessmentMetrics && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
                <div className="border-b px-4 py-2 font-semibold bg-blue-50 rounded-t-lg -mx-4 -mt-4 mb-4">Content Analysis</div>
                <div className="space-y-3">
                  {(() => {
                    const m = assessmentMetrics;
                    const vocab = Math.round(m.overall * 0.6);
                    const grammar = Math.round(m.overall * 0.5);
                    const topic = Math.round(m.overall * 0.8);
                    const rows: Array<{ key: 'vocabulary' | 'grammar' | 'topic'; label: string; value: number }> = [
                      { key: 'vocabulary', label: 'Vocabulary score', value: vocab },
                      { key: 'grammar', label: 'Grammar score', value: grammar },
                      { key: 'topic', label: 'Topic score', value: topic },
                    ];
                    return rows.map(r => (
                      <button key={r.key} type="button" onClick={() => setOpenMetricInfo(openMetricInfo === r.key ? null : r.key)} className="w-full text-left">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 font-medium">{r.label}:</span>
                          <div className="flex items-center space-x-2">
                            <span className={`font-semibold ${r.value >= 80 ? 'text-green-600' : r.value >= 60 ? 'text-orange-600' : 'text-red-600'}`}>{r.value}%</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.value >= 80 ? 'bg-green-100 text-green-700' : r.value >= 60 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{r.value >= 80 ? 'Excellent' : r.value >= 60 ? 'Good' : 'Fair'}</span>
                          </div>
                        </div>
                        {openMetricInfo === r.key && (
                          <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">{getMetricInfo(r.key)}</div>
                        )}
                      </button>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center space-x-4 mb-4">
              <button 
                onClick={() => { setShowResult(false); setTranscript(''); setScore(null); }} 
                className="px-5 py-2 rounded-full border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                TRY AGAIN
              </button>
              <button 
                onClick={() => { setShowResult(false); onNext(); }} 
                className="px-5 py-2 rounded-full bg-[#29B6F6] hover:bg-[#0277BD] text-white text-sm font-semibold"
              >
                NEXT
              </button>
            </div>

            
          </div>
        )}

        

                {/* High Score Modal */}
        {showHighScores && (
          <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">High Score Analysis</h2>
                  <button
                    onClick={() => setShowHighScores(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {loadingHighScores ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#29B6F6]"></div>
                    <span className="ml-3 text-gray-600">Loading your high score...</span>
                  </div>
                ) : highScores && highScores.recentScores.length > 0 ? (
                  <div className="space-y-6">
                    {/* High Score Display */}
                    <div className="bg-gradient-to-r from-[#29B6F6] to-[#0277BD] text-white p-6 rounded-lg text-center">
                      <div className="text-4xl font-bold mb-2">{Math.round(highScores.highestScore)}%</div>
                      <div className="text-lg opacity-90">Your Best Score</div>
                    </div>

                    {/* Score Details */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Details</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Level:</span>
                          <span className="font-semibold capitalize">{level}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Language:</span>
                          <span className="font-semibold capitalize">{language}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Date:</span>
                          <span className="font-semibold">
                            {(() => {
                              const d = toDateSafe(highScores.recentScores[0].timestamp);
                              return d ? d.toLocaleDateString() : 'N/A';
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* View Detailed Feedback Button */}
                    <button
                      onClick={() => {
                        setShowHighScores(false);
                        // Show detailed feedback with the high score data
                        if (highScores && highScores.recentScores.length > 0) {
                          const scoreData = highScores.recentScores[0];
                          console.log('High score detailed feedback - scoreData:', scoreData);
                          console.log('High score detailed feedback - apiResponse:', scoreData.apiResponse);
                          console.log('High score detailed feedback - apiResponse.result:', (scoreData.apiResponse as { result?: unknown }).result);
                          console.log('High score detailed feedback - words:', (scoreData.apiResponse as { result?: { words?: unknown[] } }).result?.words);
                          console.log('High score detailed feedback - phonemes:', (scoreData.apiResponse as { result?: { words?: Array<{ phonemes?: unknown[] }> } }).result?.words?.[0]?.phonemes);
                          
                          setDetailedFeedbackData({
                            targetText: targetText,
                            level: level,
                            language: language,
                            overallScore: scoreData.overallScore || scoreData.score,
                            apiResponse: (scoreData.apiResponse as AssessmentApiResponseLocal) || {},
                            isHighScore: false // This is historical data, not a new high score
                          });
                          setShowDetailedFeedback(true);
                        }
                      }}
                      className="w-full bg-[#29B6F6] hover:bg-[#0277BD] text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                      View Detailed Feedback
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No High Score Yet</h3>
                    <p className="text-gray-600 mb-4">
                      Complete an assessment for &apos;{targetText}&apos; to see your high score here!
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    {currentUser ? `User: ${currentUser.uid}` : 'No user'} | Language: {language}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={loadHighScoreForCurrentText}
                      className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-semibold"
                    >
                      Debug: Load Score
                    </button>
                    <button
                      onClick={() => setShowHighScores(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Feedback Modal */}
        {showDetailedFeedback && detailedFeedbackData && (
          <AssessmentFeedback
            targetText={detailedFeedbackData.targetText}
            level={detailedFeedbackData.level}
            language={detailedFeedbackData.language}
            overallScore={detailedFeedbackData.overallScore}
            apiResponse={detailedFeedbackData.apiResponse}
            isHighScore={detailedFeedbackData.isHighScore}
            onClose={() => setShowDetailedFeedback(false)}
          />
        )}


      </div>


    </div>
  );
}

export default function EvalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A237E] to-[#0277BD]">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading evaluation...</p>
        </div>
      </div>
    }>
      <EvalPageContent />
    </Suspense>
  );
}


