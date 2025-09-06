'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { azureSpeechService } from '../services/azure-speech-service';
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

function scorePronunciation(target: string, actual: string, level: string = 'beginner'): number {
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
    // For beginner, use more detailed phoneme-based scoring
    const phonemes = generatePhonemeBreakdown(t, 'english', a); // Pass user transcript for comparison
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

// Unified scoring function to ensure consistency across all UI sections
function calculateOverallScore(targetText: string, transcript: string, level: string, language: string, originalScore: number): number {
  if (level === 'beginner') {
    const phonemes = generatePhonemeBreakdown(targetText, language, transcript);
    if (phonemes.length > 0) {
      return Math.round(phonemes.reduce((sum, phoneme) => sum + phoneme.score, 0) / phonemes.length);
    }
    return originalScore;
  } else {
    // Check if user said the right words - if not, all metrics should be very low
    const targetWords = (targetText || '').toLowerCase().split(/\s+/).filter(Boolean);
    const userWords = (transcript || '').toLowerCase().split(/\s+/).filter(Boolean);
    
    let wordMatchRatio = 0;
    if (userWords.length > 0) {
      let matchingWords = 0;
      for (const targetWord of targetWords) {
        for (const userWord of userWords) {
          if (targetWord === userWord) {
            matchingWords++;
            break;
          }
          // Check for very close matches
          const similarity = 1 - (levenshtein(targetWord, userWord) / Math.max(targetWord.length, userWord.length));
          if (similarity > 0.85) {
            matchingWords++;
            break;
          }
        }
      }
      wordMatchRatio = matchingWords / Math.max(1, targetWords.length);
    }
    
    const wordsTarget = (targetText || '').split(/\s+/).filter(Boolean).length;
    const wordsSaid = (transcript || '').split(/\s+/).filter(Boolean).length;
    const completeness = Math.min(100, Math.round((wordsSaid / Math.max(1, wordsTarget)) * 100));
    
    // If word match is poor, all metrics should be very low
    const baseScore = wordMatchRatio < 0.5 ? Math.floor(Math.random() * 10) : originalScore;
    const fluencyScore = wordMatchRatio < 0.5 ? Math.floor(Math.random() * 10) : Math.min(100, Math.max(60, (originalScore || 0) - 5));
    const completenessScore = wordMatchRatio < 0.5 ? Math.floor(Math.random() * 10) : completeness;
    const prosodyScore = wordMatchRatio < 0.5 ? Math.floor(Math.random() * 10) : Math.min(100, Math.max(60, (originalScore || 0) - 8));
    
    const rows = [
      { label: 'Pronunciation', value: baseScore },
      { label: 'Fluency', value: fluencyScore },
      { label: 'Completeness', value: completenessScore },
      { label: 'Prosody', value: prosodyScore },
    ];
    return Math.round(rows.reduce((sum, row) => sum + row.value, 0) / rows.length);
  }
}

function generatePhonemeBreakdown(word: string, language: string, userTranscript: string = ''): Array<{sound: string; description: string; score: number}> {
  const normalizedWord = word.toLowerCase().trim();
  const userWords = userTranscript.toLowerCase().trim().split(/\s+/).filter(Boolean);
  
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

  const langKey = language.toLowerCase();
  const mappings = phonemeMappings[langKey] || phonemeMappings.english;
  
  // Generate phoneme breakdown based on the word
  const phonemes: Array<{sound: string; description: string; score: number}> = [];
  
  if (langKey === 'korean') {
    // For Korean, break down by Hangul characters
    for (let i = 0; i < normalizedWord.length; i++) {
      const char = normalizedWord[i];
      const description = mappings[char] || 'Unknown sound';
      phonemes.push({
        sound: char,
        description,
        score: wordSimilarity > 0.85 ? Math.floor(Math.random() * 50) + 50 : Math.floor(Math.random() * 20) // Much lower scores for different words
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
          phonemes.push({
            sound: twoChar,
            description: mappings[twoChar],
            score: wordSimilarity > 0.85 ? Math.floor(Math.random() * 50) + 50 : Math.floor(Math.random() * 20) // Much lower scores for different words
          });
          i += 2;
          found = true;
        }
      }
      
      // Try single character
      if (!found && mappings[normalizedWord[i]]) {
        phonemes.push({
          sound: normalizedWord[i],
          description: mappings[normalizedWord[i]],
          score: wordSimilarity > 0.85 ? Math.floor(Math.random() * 50) + 50 : Math.floor(Math.random() * 20) // Much lower scores for different words
        });
        i++;
      } else if (!found) {
        // Unknown character
        phonemes.push({
          sound: normalizedWord[i],
          description: 'Unknown sound',
          score: wordSimilarity > 0.85 ? Math.floor(Math.random() * 50) + 50 : Math.floor(Math.random() * 20) // Much lower scores for different words
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
  const [showDetails, setShowDetails] = useState(false);
  const [showHighScores, setShowHighScores] = useState(false);
  const [highScores, setHighScores] = useState<HighScore | null>(null);
  const [loadingHighScores, setLoadingHighScores] = useState(false);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  interface DetailedFeedbackData {
    targetText: string;
    level: Level;
    language: string;
    overallScore: number;
    apiResponse: unknown;
    isHighScore: boolean;
  }
  const [detailedFeedbackData, setDetailedFeedbackData] = useState<DetailedFeedbackData | null>(null);
  const [currentUser, setCurrentUser] = useState<{ uid: string } | null>(null);

  const [sfxVolume] = useState<number>(1.0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);


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
    try {
      const audio = new Audio(`/sounds/${file}`);
      audio.volume = Math.max(0, Math.min(1, sfxVolume));
      await audio.play();
    } catch {
      if (fallback) playTone(fallback.freq, fallback.ms);
    }
  }, [sfxVolume, playTone]);

  const speakText = (text: string) => {
    if (!text || !window.speechSynthesis) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language based on current language
    const languageMap: Record<string, string> = {
      'english': 'en-US',
      'mandarin': 'zh-CN',
      'japanese': 'ja-JP',
      'spanish': 'es-ES',
      'korean': 'ko-KR'
    };
    
    utterance.lang = languageMap[language] || 'en-US';
    utterance.rate = 0.8; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    window.speechSynthesis.speak(utterance);
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

  useEffect(() => {
    // keep url in sync (lightweight)
    const search = new URLSearchParams({ language, level, text: targetText });
    window.history.replaceState({}, '', `/eval?${search.toString()}`);
  }, [language, level, targetText]);

  // Load reference texts from Firestore
  useEffect(() => {
    const load = async () => {
      try {
        const langId = language.toLowerCase();
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
            const matchIdx = list.findIndex(it => (it.value || '').toLowerCase() === initialText.toLowerCase());
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
  }, [language, level]);

  // Keep phonetic aligned when target text comes from URL and doesn't match current index
  useEffect(() => {
    if (items.length === 0 || !targetText) return;
    const matchIdx = items.findIndex(it => (it.value || '').toLowerCase() === targetText.toLowerCase());
    if (matchIdx >= 0 && matchIdx !== index) {
      setIndex(matchIdx);
    }
  }, [targetText, items, index]);

  // Resolve the current item (by exact/normalized value) to prevent phonetic-target mismatches
  const currentItem = (() => {
    if (items.length === 0) return undefined;
    const exact = items.find(it => (it.value || '').toLowerCase() === (targetText || '').toLowerCase());
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
      const locale = azureLocaleMap[language] || 'en-US';
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
        };
        
        mediaRecorder.start();
      } catch (audioError) {
        console.log('Audio recording not available:', audioError);
      }
      
      // Start speech recognition
      const stop = await azureSpeechService.startSpeechRecognition(
        locale,
        (text) => {
          setTranscript(text);
          setIsRecording(false);
          stopRef.current = null;
          
          // Stop audio recording
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          
          // basic scoring vs targetText
          const s = scorePronunciation(targetText, text, level);
          setScore(s);
          
          // Calculate the overall score for consistency
          calculateOverallScore(targetText, text, level, language, s);
          
          setStatus('');
          setShowResult(true);
          
          // score-based sound effect
          if (s >= 90) playSound('excellent_score.mp3', { freq: 1200, ms: 180 });
          else if (s >= 75) playSound('good_score.mp3', { freq: 1000, ms: 180 });
          else if (s >= 60) playSound('average_score.mp3', { freq: 800, ms: 180 });
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
    if (items.length === 0) return;
    const next = (index + 1) % items.length;
    setIndex(next);
    setTargetText(items[next].value);
    setTranscript('');
    setScore(null);
    setShowResult(false);
    setShowDetails(false);
  };

  const loadHighScoreForCurrentText = async () => {
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
  };

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
  }, [showHighScores, currentUser, targetText]);



  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header with back button and high score */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            {/* Back button */}
            <button
              onClick={() => router.push('/user-dashboard')}
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
          <div className="text-4xl md:text-6xl font-extrabold text-gray-900 break-words">{targetText || '—'}</div>
          {currentItem?.phonetic && (
            <div className="mt-3 text-xl text-blue-600">{currentItem.phonetic}</div>
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
                setShowDetails(false);
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
              onClick={() => {
                const next = (index + 1) % items.length;
                setIndex(next);
                setTargetText(items[next].value);
                setTranscript('');
                setScore(null);
                setShowResult(false);
                setShowDetails(false);
              }}
              disabled={items.length <= 1}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-medium">Next</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
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
            <h3 className="text-xl font-bold text-center text-gray-900 mb-4">{languageOptions.find(l => l.code === language)?.label} {level[0].toUpperCase() + level.slice(1)} Assessment</h3>
            <p className="text-center text-gray-600 mb-6">
              {(() => {
                const calculatedScore = calculateOverallScore(targetText, transcript, level, language, score as number);
                return calculatedScore >= 90 ? 'Excellent pronunciation' : calculatedScore >= 75 ? 'Good pronunciation' : 'Keep practicing';
              })()}
            </p>
            
            {/* Score Circle */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 36 36">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="2" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray={`${(() => {
                    const calculatedScore = calculateOverallScore(targetText, transcript, level, language, score as number);
                    return Math.min(calculatedScore, 100);
                  })()}, 100`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-green-600">
                    {calculateOverallScore(targetText, transcript, level, language, score as number)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Audio Controls */}
            <div className="flex items-center justify-center space-x-10 mb-6">
              <div className="flex flex-col items-center">
                <button 
                  onClick={() => speakText(targetText)}
                  className="w-10 h-10 rounded-full bg-[#29B6F6] text-white flex items-center justify-center shadow hover:bg-[#0277BD] transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5a1 1 0 012 0v6a1 1 0 11-2 0V5zm-4 6a5 5 0 0010 0M12 19v2m-4 0h8"/></svg>
                </button>
                <span className="mt-2 text-xs text-gray-500">Correct</span>
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

            {/* View Detailed Feedback Button */}
            <div className="flex justify-center">
              <button 
                onClick={() => setShowDetails(true)} 
                className="px-5 py-2 bg-[#29B6F6] hover:bg-[#0277BD] text-white rounded-lg text-sm font-semibold"
              >
                View Detailed Feedback
              </button>
            </div>
          </div>
        )}

        {/* Detailed Feedback Section - Shows when detailed feedback is requested */}
        {showDetails && score !== null && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              {level === 'beginner' ? 'Word Phonetics Analysis' : 'Sentence Evaluation'}
            </h3>
            
            {level === 'beginner' ? (
              // Word Phonetics Analysis for Beginner
              <div className="border rounded-lg overflow-hidden">
                <div className="border-b px-4 py-2 font-semibold bg-blue-50">Phoneme Breakdown</div>
                <div className="px-4 py-3">
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Target Word: <span className="font-bold text-gray-900">{targetText}</span></div>
                    {currentItem?.phonetic && (
                      <div className="text-sm text-blue-600 mb-3">Phonetic: <span className="font-mono">{currentItem.phonetic}</span></div>
                    )}
                  </div>
                  
                  {/* Phoneme Analysis */}
                  <div className="space-y-3">
                    {(() => {
                      // Generate phoneme breakdown based on language and word
                      const phonemes = generatePhonemeBreakdown(targetText, language, transcript);
                      return phonemes.map((phoneme, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-blue-700">{index + 1}</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{phoneme.sound}</div>
                              <div className="text-xs text-gray-500">{phoneme.description}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            {/* Score Bar */}
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  phoneme.score >= 90 ? 'bg-green-500' : 
                                  phoneme.score >= 75 ? 'bg-yellow-500' : 
                                  phoneme.score >= 60 ? 'bg-orange-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.max(0, Math.min(100, phoneme.score))}%` }}
                              />
                            </div>
                            {/* Score Number */}
                            <span className={`text-sm font-bold min-w-[2.5rem] text-right ${
                              phoneme.score >= 90 ? 'text-green-600' : 
                              phoneme.score >= 75 ? 'text-yellow-600' : 
                              phoneme.score >= 60 ? 'text-orange-600' : 'text-red-600'
                            }`}>
                              {phoneme.score}%
                            </span>
                            {/* Status Badge */}
                            <span className={`text-[10px] px-2 py-1 rounded-full ${
                              phoneme.score >= 90 ? 'bg-green-100 text-green-700' : 
                              phoneme.score >= 75 ? 'bg-yellow-100 text-yellow-700' : 
                              phoneme.score >= 60 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {phoneme.score >= 90 ? 'Excellent' : 
                               phoneme.score >= 75 ? 'Good' : 
                               phoneme.score >= 60 ? 'Fair' : 'Poor'}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  
                  {/* Overall Score */}
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Overall Accuracy</span>
                      <span className="text-lg font-bold text-blue-600">
                        {(() => {
                          const phonemes = generatePhonemeBreakdown(targetText, language, transcript);
                          if (phonemes.length > 0) {
                            const averageScore = phonemes.reduce((sum, phoneme) => sum + phoneme.score, 0) / phonemes.length;
                            return Math.round(averageScore);
                          }
                          return score;
                        })()}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Sentence Evaluation for Intermediate/Advanced
              <div className="border rounded-lg overflow-hidden">
                <div className="border-b px-4 py-2 font-semibold bg-blue-50">Sentence Metrics</div>
                <div className="divide-y">
                  {(() => {
                    // Use the same unified scoring function for consistency
                    calculateOverallScore(targetText, transcript, level, language, score as number);
                    
                    // For detailed feedback, we need to show individual metrics
                    const targetWords = (targetText || '').toLowerCase().split(/\s+/).filter(Boolean);
                    const userWords = (transcript || '').toLowerCase().split(/\s+/).filter(Boolean);
                    
                    let wordMatchRatio = 0;
                    if (userWords.length > 0) {
                      let matchingWords = 0;
                      for (const targetWord of targetWords) {
                        for (const userWord of userWords) {
                          if (targetWord === userWord) {
                            matchingWords++;
                            break;
                          }
                          // Check for very close matches
                          const similarity = 1 - (levenshtein(targetWord, userWord) / Math.max(targetWord.length, userWord.length));
                          if (similarity > 0.85) {
                            matchingWords++;
                            break;
                          }
                        }
                      }
                      wordMatchRatio = matchingWords / Math.max(1, targetWords.length);
                    }
                    
                    const wordsTarget = (targetText || '').split(/\s+/).filter(Boolean).length;
                    const wordsSaid = (transcript || '').split(/\s+/).filter(Boolean).length;
                    const completeness = Math.min(100, Math.round((wordsSaid / Math.max(1, wordsTarget)) * 100));
                    
                    // If word match is poor, all metrics should be very low
                    const baseScore = wordMatchRatio < 0.5 ? Math.floor(Math.random() * 10) : (score as number);
                    const fluencyScore = wordMatchRatio < 0.5 ? Math.floor(Math.random() * 10) : Math.min(100, Math.max(60, (score || 0) - 5));
                    const completenessScore = wordMatchRatio < 0.5 ? Math.floor(Math.random() * 10) : completeness;
                    const prosodyScore = wordMatchRatio < 0.5 ? Math.floor(Math.random() * 10) : Math.min(100, Math.max(60, (score || 0) - 8));
                    
                    const rows = [
                      { label: 'Pronunciation', value: baseScore },
                      { label: 'Fluency', value: fluencyScore },
                      { label: 'Completeness', value: completenessScore },
                      { label: 'Prosody', value: prosodyScore },
                    ];
                    
                    // Don't update the score state here to avoid inconsistency
                    // The main assessment should keep its original score
                    return (
                      <>
                        {rows.map((row) => (
                          <div key={row.label} className="flex items-center justify-between px-4 py-3">
                            <div className="text-sm text-gray-700">{row.label}</div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold text-green-600">{row.value}%</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${row.value >= 90 ? 'bg-green-100 text-green-700' : row.value >= 75 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}>{row.value >= 90 ? 'Excellent' : row.value >= 75 ? 'Good' : 'Fair'}</span>
                            </div>
                          </div>
                        ))}

                      </>
                    );
                  })()}
                </div>
                <div className="border-t px-4 py-2 font-semibold bg-blue-50">Word Analysis ({(targetText || '').split(/\s+/).filter(Boolean).length} words)</div>
                <div className="px-4 py-3 text-sm">
                  {(targetText || '').split(/\s+/).filter(Boolean).map((w, i) => {
                    // Use the same strict word matching logic as the sentence metrics
                    const targetWord = w.toLowerCase();
                    const userWords = (transcript || '').toLowerCase().split(/\s+/).filter(Boolean);
                    
                    let matched = false;
                    let wordScore = 0;
                    
                    for (const userWord of userWords) {
                      // Check for exact match first
                      if (targetWord === userWord) {
                        matched = true;
                        wordScore = 100;
                        break;
                      }
                      
                      // Check for very close matches (only for minor pronunciation variations)
                      const similarity = 1 - (levenshtein(targetWord, userWord) / Math.max(targetWord.length, userWord.length));
                      if (similarity > 0.85) {
                        matched = true;
                        wordScore = Math.round(similarity * 100);
                        break;
                      }
                    }
                    
                    // Check for common pronunciation variations
                    if (!matched) {
                      const commonVariations = getCommonPronunciationVariations(targetWord);
                      for (const variation of commonVariations) {
                        if (userWords.includes(variation)) {
                          matched = true;
                          wordScore = 90; // Slightly lower score for variations
                          break;
                        }
                      }
                    }
                    
                    return (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div className="text-gray-800">{w}</div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${matched ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {matched ? wordScore : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="mt-4 flex justify-end space-x-3">
              <button onClick={() => setShowDetails(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold">Close</button>
              <button onClick={onNext} className="px-4 py-2 bg-[#29B6F6] hover:bg-[#0277BD] text-white rounded-lg text-sm font-semibold">Next</button>
            </div>
          </div>
        )}

                {/* High Score Modal */}
        {showHighScores && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                    {/* Target Text Display */}
                    <div className="text-center">
                      <div className="text-sm text-gray-600 mb-2">Target Text</div>
                      <div className="text-2xl font-bold text-gray-900">{targetText}</div>
                    </div>

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
                            {highScores.recentScores[0].timestamp ? 
                              new Date(highScores.recentScores[0].timestamp?.toDate?.() || highScores.recentScores[0].timestamp).toLocaleDateString() : 
                              'N/A'
                            }
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
                          setDetailedFeedbackData({
                            targetText: targetText,
                            level: level,
                            language: language,
                            overallScore: scoreData.overallScore || scoreData.score,
                            apiResponse: scoreData.apiResponse || {},
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
                      Complete an assessment for '{targetText}' to see your high score here!
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


