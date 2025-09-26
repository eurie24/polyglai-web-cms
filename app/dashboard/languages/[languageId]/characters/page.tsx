'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../../../../../src/lib/firebase';
import CustomDialog from '../../../../../src/components/CustomDialog';
import { useCustomDialog } from '../../../../../src/hooks/useCustomDialog';
import * as XLSX from 'xlsx';

// Character item type
type Character = {
  id: string;
  value: string;
  phonetic: string;
  notes?: string;
  etymology?: string; // Add etymology field
  createdAt: string;
};

// Language type
type Language = {
  id: string;
  name: string;
  code: string;
  levels: string[];
};

// Default characters with phonetics for initialization
const defaultCharacters = {
  mandarin: {
    beginner: [
      { value: '用', phonetic: 'yòng', notes: 'Use', etymology: 'Pictographic character showing a hand holding a tool. Originally depicted a hand holding a stick or implement for work.' },
      { value: '去', phonetic: 'qù', notes: 'Go', etymology: 'Combines "土" (earth) and "厶" (private). Originally meant "to remove earth", later extended to mean "to go away".' },
      { value: '来', phonetic: 'lái', notes: 'Come', etymology: 'Pictographic character showing a person with outstretched arms. Originally meant "to come" or "to arrive".' },
      { value: '好', phonetic: 'hǎo', notes: 'Good', etymology: 'Combines "女" (woman) and "子" (child). Originally meant "mother and child", representing the ideal of family harmony.' },
      { value: '丑', phonetic: 'chǒu', notes: 'Goodbye', etymology: 'Originally meant "clown" or "ugly". The character shows a person with a mask or distorted face.' },
      { value: '是', phonetic: 'shì', notes: 'To be (am/is/are)', etymology: 'Combines "日" (sun) and "正" (correct). Originally meant "correct" or "right", later used as copula.' },
      { value: '有', phonetic: 'yǒu', notes: 'To have', etymology: 'Pictographic character showing a hand holding meat. Originally meant "to possess" or "to have".' },
      { value: '吃', phonetic: 'chī', notes: 'To eat', etymology: 'Combines "口" (mouth) and "乞" (to beg). Originally meant "to eat" or "to consume".' },
      { value: '喝', phonetic: 'hē', notes: 'To drink', etymology: 'Combines "口" (mouth) and "曷" (what). Originally meant "to drink" or "to swallow".' },
      { value: '看', phonetic: 'kàn', notes: 'To look/watch', etymology: 'Combines "目" (eye) and "手" (hand). Originally meant "to look" or "to watch".' }
    ],
    intermediate: [
      { value: '你好，我是凯特。', phonetic: 'Nǐ hǎo, wǒ shì Kǎitè.', notes: 'Hello, I\'m Kate.' },
      { value: '你好吗？', phonetic: 'Nǐ hǎo ma?', notes: 'How are you?' },
      { value: '我很好，谢谢。', phonetic: 'Wǒ hěn hǎo, xièxiè.', notes: 'I\'m good, thank you.' },
      { value: '请问，洗手间在哪里？', phonetic: 'Qǐngwèn, xǐshǒujiān zài nǎlǐ?', notes: 'Excuse me, where is the restroom?' },
      { value: '我不懂。', phonetic: 'Wǒ bù dǒng.', notes: 'I don\'t understand.' },
      { value: '你会说英语吗？', phonetic: 'Nǐ huì shuō Yīngyǔ ma?', notes: 'Do you speak English?' },
      { value: '我叫李明。', phonetic: 'Wǒ jiào Lǐ Míng.', notes: 'My name is Li Ming.' },
      { value: '多少钱？', phonetic: 'Duōshǎo qián?', notes: 'How much does it cost?' },
      { value: '我想买这个。', phonetic: 'Wǒ xiǎng mǎi zhège.', notes: 'I want to buy this.' },
      { value: '再见！', phonetic: 'Zàijiàn!', notes: 'Goodbye!' }
    ]
  },
  english: {
    beginner: [
      { value: 'Picture', phonetic: '/ˈpɪktʃər/', notes: 'A painting or drawing', etymology: 'From Latin "pictura" meaning "painting, picture", from "pingere" meaning "to paint".' },
      { value: 'Cinema', phonetic: '/ˈsɪnəmə/', notes: 'A theater where movies are shown for public entertainment; a movie theater', etymology: 'From French "cinéma", short for "cinématographe", from Greek "kinema" meaning "movement" and "graphein" meaning "to write".' },
      { value: 'Money', phonetic: '/ˈmʌni/', notes: 'A current medium of exchange in the form of coins and banknotes', etymology: 'From Latin "moneta" meaning "mint, coinage", originally referring to the temple of Juno Moneta where coins were minted in ancient Rome.' },
      { value: 'Boy', phonetic: '/bɔɪ/', notes: 'A male child or young male person.', etymology: 'Origin uncertain, possibly from Old French "embuie" meaning "fettered", or from a Germanic root meaning "young man".' },
      { value: 'Car', phonetic: '/kɑr/', notes: 'A road vehicle with an engine, used for transporting people.', etymology: 'From Latin "carrus" meaning "wheeled vehicle", originally a Celtic word for a type of wagon.' },
      { value: 'Cat', phonetic: '/kæt/', notes: 'A small domesticated mammal known for catching mice and being a popular pet.', etymology: 'From Old English "catt", from Late Latin "cattus", possibly from an Afro-Asiatic source.' },
      { value: 'Day', phonetic: '/deɪ/', notes: 'A 24-hour period; the time from sunrise to sunset.', etymology: 'From Old English "dæg", from Proto-Germanic "dagaz", related to words meaning "to burn" (as in the sun burning).' },
      { value: 'End', phonetic: '/ɛnd/', notes: 'The final point of something in time or space.', etymology: 'From Old English "endian" meaning "to end, finish", from Proto-Germanic "andja" meaning "end, point".' },
      { value: 'Family', phonetic: '/ˈfæməli/', notes: 'Group consisting of parents and their children, or people related by blood.', etymology: 'From Latin "familia" meaning "household, family", from "famulus" meaning "servant, slave".' },
      { value: 'Home', phonetic: '/hoʊm/', notes: 'A place where one lives; a place of comfort and belonging.', etymology: 'From Old English "ham" meaning "village, estate, home", from Proto-Germanic "haimaz" meaning "home, village".' }
    ],
    intermediate: [
      { value: 'What time is it?', phonetic: '/wʌt taɪm ɪz ɪt/', notes: 'Asking for the current time.' },
      { value: 'Where are you going?', phonetic: '/wɛr ə ju ˈgoʊɪŋ/', notes: 'Asking someone about their destination.' },
      { value: 'I don\'t understand.', phonetic: '/aɪ doʊnt ˌʌndərˈstænd/', notes: 'Used when you\'re confused or didn\'t catch something.' },
      { value: 'Can you help me?', phonetic: '/kæn ju hɛlp mi/', notes: 'Asking someone for assistance.' },
      { value: 'How much does it cost?', phonetic: '/haʊ mʌtʃ dʌz ɪt kɔst/', notes: 'Asking for the price of something.' },
      { value: 'I\'m learning English.', phonetic: '/aɪm ˈlɜrnɪŋ ˈɪŋglɪʃ/', notes: 'A common phrase learners use to express their current goal.' },
      { value: 'That sounds great!', phonetic: '/ðæt saʊndz greɪt/', notes: 'Expressing approval or excitement.' },
      { value: 'Could you say that again?', phonetic: '/kʊd ju seɪ ðæt əˈgɛn/', notes: 'Polite way to ask for repetition.' },
      { value: 'What do you mean?', phonetic: '/wʌt du ju min/', notes: 'Asking for clarification.' },
      { value: 'I\'m not sure.', phonetic: '/aɪm nɑt ʃʊr/', notes: 'Expressing uncertainty.' }
    ],
    advanced: [
      { value: 'What are your thoughts on the role of technology in modern education?', phonetic: '', notes: 'Discuss the impact of technology on learning, teaching methods, and educational accessibility. Consider both positive and negative aspects.' },
      { value: 'How do you think climate change will affect future generations?', phonetic: '', notes: 'Share your views on environmental challenges, sustainability measures, and the long-term consequences of climate change.' },
      { value: 'Describe a memorable travel experience and explain why it was significant to you.', phonetic: '', notes: 'Talk about a journey or trip that had a lasting impact, including cultural insights, personal growth, or unexpected discoveries.' },
      { value: 'What qualities do you think make an effective leader in today\'s world?', phonetic: '', notes: 'Discuss leadership characteristics, communication skills, adaptability, and the ability to inspire others in modern contexts.' },
      { value: 'How has social media changed the way people communicate and form relationships?', phonetic: '', notes: 'Analyze the impact of social media platforms on personal connections, communication styles, and social interactions.' },
      { value: 'What role should governments play in addressing income inequality?', phonetic: '', notes: 'Express your views on economic policies, social programs, taxation, and government intervention in reducing wealth gaps.' },
      { value: 'Describe how artificial intelligence might transform the job market in the next decade.', phonetic: '', notes: 'Discuss AI\'s potential impact on employment, new job creation, skills requirements, and workforce adaptation.' },
      { value: 'What are the benefits and drawbacks of globalization for developing countries?', phonetic: '', notes: 'Analyze how global trade, cultural exchange, and economic integration affect developing nations\' growth and identity.' },
      { value: 'How do you think mental health awareness has evolved, and what more needs to be done?', phonetic: '', notes: 'Discuss changes in mental health stigma, treatment accessibility, workplace support, and societal attitudes.' },
      { value: 'What impact do you think renewable energy will have on the global economy?', phonetic: '', notes: 'Share your thoughts on the economic implications of transitioning to sustainable energy sources and green technologies.' }
    ]
  },
  japanese: {
    beginner: [
      { value: '一', phonetic: 'ichi', notes: 'one', etymology: 'Pictographic character showing a single horizontal line. Represents the number one, the most basic counting unit.' },
      { value: '人', phonetic: 'hito', notes: 'person', etymology: 'Pictographic character showing a person with outstretched arms and legs. Represents a human being.' },
      { value: '日', phonetic: 'hi / nichi', notes: 'sun / day', etymology: 'Pictographic character showing the sun with a dot in the center. Originally represented the sun, later extended to mean "day".' },
      { value: '水', phonetic: 'mizu', notes: 'water', etymology: 'Pictographic character showing flowing water with droplets. Represents water in its liquid form.' },
      { value: '火', phonetic: 'hi / ka', notes: 'fire', etymology: 'Pictographic character showing flames rising upward. Represents fire and heat.' },
      { value: '木', phonetic: 'ki / moku', notes: 'tree / wood', etymology: 'Pictographic character showing a tree with branches and roots. Represents trees and wooden materials.' },
      { value: '山', phonetic: 'yama', notes: 'mountain', etymology: 'Pictographic character showing three peaks of a mountain range. Represents mountains and high elevations.' },
      { value: '川', phonetic: 'kawa', notes: 'river', etymology: 'Pictographic character showing flowing water between banks. Represents rivers and streams.' },
      { value: '女', phonetic: 'onna', notes: 'woman', etymology: 'Pictographic character showing a person in a kneeling position, traditionally representing a woman.' },
      { value: '子', phonetic: 'ko / shi', notes: 'child', etymology: 'Pictographic character showing a child with a large head and small body. Represents children and offspring.' }
    ],
    intermediate: [
      { value: 'お名前は何ですか？', phonetic: 'Onamae wa nan desu ka?', notes: 'What is your name?' },
      { value: '私の名前は田中です。', phonetic: 'Watashi no namae wa Tanaka desu.', notes: 'My name is Tanaka.' },
      { value: 'どこから来ましたか？', phonetic: 'Doko kara kimashita ka?', notes: 'Where are you from?' },
      { value: '日本から来ました。', phonetic: 'Nihon kara kimashita.', notes: 'I came from Japan.' },
      { value: 'これはいくらですか？', phonetic: 'Kore wa ikura desu ka?', notes: 'How much is this?' },
      { value: 'トイレはどこですか？', phonetic: 'Toire wa doko desu ka?', notes: 'Where is the restroom?' },
      { value: '英語を話せますか？', phonetic: 'Eigo o hanasemasu ka?', notes: 'Can you speak English?' },
      { value: 'すみません。', phonetic: 'Sumimasen, mou ichido onegaishimasu.', notes: 'Excuse me, one more time please.' },
      { value: '今日はいい天気ですね。', phonetic: 'Kyou wa ii tenki desu ne.', notes: 'It\'s nice weather today, isn\'t it?' },
      { value: 'どこで昼ご飯を食べますか？', phonetic: 'Doko de hirugohan o tabemasu ka?', notes: 'Where shall we have lunch?' }
    ]
  },
  spanish: {
    beginner: [
      { value: 'Hola', phonetic: 'O-la', notes: 'Hello. A common and basic greeting.', etymology: 'From Old Spanish "ola", from Latin "hora" meaning "hour, time". Originally a greeting asking about the time of day.' },
      { value: 'Adiós', phonetic: 'Ah-dee-os', notes: 'Goodbye. Used when saying farewell.', etymology: 'From "a Dios" meaning "to God". Originally a religious farewell meaning "go with God".' },
      { value: 'Gracias', phonetic: 'Gra-thee-as', notes: 'Thank you. Expressing gratitude.', etymology: 'From Latin "gratias" meaning "thanks, gratitude", from "gratus" meaning "pleasing, thankful".' },
      { value: 'Por favor', phonetic: 'Por fa-vor', notes: 'Please. Used when making a polite request.', etymology: 'Literally "by favor", from Latin "per" (by) and "favor" (favor, kindness).' },
      { value: 'Sí', phonetic: 'See', notes: 'Yes. Used for affirmation.', etymology: 'From Latin "sic" meaning "thus, so". Used as an affirmative response.' },
      { value: 'Hombre', phonetic: 'Om-breh', notes: 'Man. Refers to a male person.', etymology: 'From Latin "homo" meaning "man, human being". Related to English "human".' },
      { value: 'Mujer', phonetic: 'Moo-her', notes: 'Woman. Refers to a female person.', etymology: 'From Latin "mulier" meaning "woman, wife". Originally meant "married woman".' },
      { value: 'Buenos días', phonetic: 'Bweh-nos dee-as', notes: 'Good morning. A greeting used in the morning.', etymology: 'Literally "good days", from Latin "bonus" (good) and "dies" (day).' },
      { value: 'Buenas tardes', phonetic: 'Bweh-nas tar-des', notes: 'Good afternoon/evening. A greeting used in the afternoon and early evening.', etymology: 'Literally "good afternoons", from Latin "bonus" (good) and "tardus" (late, slow).' },
      { value: '¿Cómo estás?', phonetic: 'Koh-mo es-tas', notes: 'How are you? A common way to ask about someone\'s well-being.', etymology: 'From Latin "quomodo" (how) and "stare" (to stand, to be). Literally "how do you stand?"' }
    ],
    intermediate: [
      { value: '¡Hola! ¿Cómo estás?', phonetic: 'O-la! Koh-mo es-tas?', notes: 'Hi! How are you? (A common greeting and inquiry about well-being)' },
      { value: '¿Qué tal todo?', phonetic: 'Ke tal to-do?', notes: 'How is everything? (Asking about the general state of things)' },
      { value: '¿Cómo has estado?', phonetic: 'Koh-mo as es-ta-do?', notes: 'How have you been? (Asking about someone\'s recent state)' },
      { value: '¿Cómo te va?', phonetic: 'Koh-mo teh va?', notes: 'How are you doing? (A general way to ask how someone is getting along)' },
      { value: 'Mucho gusto, mi nombre es...', phonetic: 'Moo-cho goos-to, mee nom-breh es...', notes: 'Nice to meet you, my name is... (Introducing yourself)' },
      { value: 'Es un placer conocerte, ¿Cómo te llamas?', phonetic: 'Es oon pla-ther ko-no-ther-teh, Koh-mo teh ya-mas?', notes: 'It\'s a pleasure to meet you, what\'s your name? (Polite introduction)' },
      { value: 'Con permiso ¿Puedo pasar?', phonetic: 'Kon per-mee-so Pweh-tho pa-sar?', notes: 'Excuse me, can I come in? (Politely asking for permission to enter)' },
      { value: 'Le agradezco mucho.', phonetic: 'Leh ah-gra-deh-thko moo-cho.', notes: 'I really appreciate it. (Expressing strong gratitude)' },
      { value: 'Disculpe; ¿me puede ayudar por favor?', phonetic: 'Dees-cool-peh; meh pweh-theh ah-yoo-thar por fa-vor?', notes: 'Excuse me, could you help me please? (Politely asking for assistance)' },
      { value: 'Gracias por su ayuda.', phonetic: 'Gra-thee-as por soo ah-yoo-tha.', notes: 'Thank you for your help. (Expressing thanks for assistance)' }
    ]
  },
  korean: {
    beginner: [
      { value: '물', phonetic: 'mul', notes: 'water', etymology: 'Native Korean word. Related to "mulda" (to flow) and "muljil" (water quality). Represents the basic element of water.' },
      { value: '불', phonetic: 'bul', notes: 'fire', etymology: 'Native Korean word. Related to "bulda" (to burn) and "buljil" (fire quality). Represents fire and heat.' },
      { value: '눈', phonetic: 'nun', notes: 'eye / snow', etymology: 'Native Korean word with two meanings. For "eye": related to "nunmul" (tears). For "snow": related to "nunbora" (snowstorm).' },
      { value: '손', phonetic: 'son', notes: 'hand', etymology: 'Native Korean word. Related to "sonjil" (hand quality) and "sonkkal" (hand gesture). Represents the human hand.' },
      { value: '집', phonetic: 'jip', notes: 'house / home', etymology: 'Native Korean word. Related to "jipjil" (house quality) and "jipkkal" (household). Represents dwelling and shelter.' },
      { value: '밥', phonetic: 'bap', notes: 'rice / meal', etymology: 'Native Korean word. Related to "bapjil" (food quality) and "bapkkal" (meal time). Represents cooked rice and meals.' },
      { value: '말', phonetic: 'mal', notes: 'word / speech / horse', etymology: 'Native Korean word with multiple meanings. For "word/speech": related to "malhada" (to speak). For "horse": related to "maljil" (horse quality).' },
      { value: '길', phonetic: 'gil', notes: 'road / path', etymology: 'Native Korean word. Related to "giljil" (road quality) and "gilkkal" (pathway). Represents a way or route.' },
      { value: '밤', phonetic: 'bam', notes: 'night / chestnut', etymology: 'Native Korean word with two meanings. For "night": related to "bamjil" (night quality). For "chestnut": related to "bamkkal" (chestnut tree).' },
      { value: '강', phonetic: 'gang', notes: 'river', etymology: 'Native Korean word. Related to "gangjil" (river quality) and "gangkkal" (riverbank). Represents flowing water and rivers.' }
    ],
    intermediate: [
      { value: '친구 할래요?', phonetic: 'Chingu hallaeyo?', notes: 'Shall we be friends? (A cute, direct way to propose friendship)' },
      { value: '이름이 뭐예요?', phonetic: 'Ireumi mwoyeyo?', notes: 'What\'s your name? (Standard conversation starter)' },
      { value: '어디에서 왔어요?', phonetic: 'Eodieseo wasseoyo?', notes: 'Where are you from? (Another common get-to-know-you question)' },
      { value: '반갑습니다', phonetic: 'Bangawoyo', notes: 'Nice to meet you (Slightly more polite than the casual "bangawo")' },
      { value: '배고파요', phonetic: 'Baegoyo', notes: 'I\'m getting (a bit) hungry or taxi if you need to let the driver know)' },
      { value: '택시 불러주세요', phonetic: 'Taeksi bulleojuseyo', notes: 'Please call a taxi (If you\'re in a hotel or restaurant, they\'ll usually be happy to help)' },
      { value: '지하철역 어디예요?', phonetic: 'Jihacheol-yeok odiyeyo?', notes: 'Where is the subway station? (Subways are a prime mode of transport in major cities)' },
      { value: '얼마예요?', phonetic: 'Eolmayeyo?', notes: 'How much is it? (The fundamental question for any shopper)' },
      { value: '너무 비싸요', phonetic: 'Neomu bissayo', notes: 'It\'s too expensive (A lighthearted way to indicate you\'d like a discount)' },
      { value: '좀 깎아주세요', phonetic: 'Jom kkakajuseyo', notes: 'Can you give me a discount? (Perfect for markets or smaller shops)' }
    ]
  }
};

export default function Characters() {
  // State variables
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [language, setLanguage] = useState<Language | null>(null);
  const [levels, setLevels] = useState<string[]>([]);
  const [currentLevel, setCurrentLevel] = useState('beginner');
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [newCharacter, setNewCharacter] = useState({
    value: '',
    phonetic: '',
    notes: '',
    etymology: '' // Add etymology field
  });
  const [error, setError] = useState('');
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    success: number;
    errors: string[];
  }>({ success: 0, errors: [] });
  const [previewData, setPreviewData] = useState<{
    [level: string]: Array<{
      value: string;
      detectedType: string;
      detectedLanguage: string;
    }>
  } | null>(null);
  
  // Custom dialog hook
  const { dialogState, hideDialog, showConfirm, showSuccess, showError, showWarning } = useCustomDialog();
  
  const router = useRouter();
  const params = useParams();
  const languageId = params?.languageId as string;
  
  // Fetch language details
  const fetchLanguageDetails = useCallback(async () => {
    try {
      setLoading(true);
      const languageDoc = await getDoc(doc(db, 'languages', languageId));
      
      if (!languageDoc.exists()) {
        setError('Language not found');
        return;
      }
      
      const languageData = languageDoc.data();
      
      // Set default levels based on language
      let defaultLevels = ['beginner', 'intermediate'];
      if (languageId.toLowerCase() === 'english') {
        defaultLevels = ['beginner', 'intermediate', 'advanced'];
      }
      
      setLanguage({
        id: languageDoc.id,
        name: languageData.name,
        code: languageData.code,
        levels: languageData.levels || defaultLevels
      });
      
      setLevels(languageData.levels || defaultLevels);
      
    } catch (err) {
      console.error('Error fetching language details:', err);
      setError('Failed to load language details');
    } finally {
      setLoading(false);
    }
  }, [languageId]);
  
  // Fetch characters for the current language and level
  const fetchCharacters = useCallback(async () => {
    try {
      setLoading(true);
      // Now we get characters from the subcollection based on level
      const charactersRef = collection(db, 'languages', languageId, 'characters', currentLevel, 'items');
      const charactersQuery = query(
        charactersRef,
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(charactersQuery);
      
      const charactersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Character[];
      
      setCharacters(charactersList);
    } catch (err) {
      console.error('Error fetching characters:', err);
      setError('Failed to load characters');
    } finally {
      setLoading(false);
    }
  }, [languageId, currentLevel]);
  
  useEffect(() => {
    // Force light mode
    document.documentElement.classList.remove('dark');
    document.body.classList.add('light');
    document.body.classList.remove('dark');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        fetchLanguageDetails();
      }
    });
    
    return () => unsubscribe();
  }, [router, languageId, fetchLanguageDetails]);
  
  useEffect(() => {
    if (language) {
      fetchCharacters();
    }
  }, [language, currentLevel, fetchCharacters]);

  // Clear selected characters when level changes
  useEffect(() => {
    setSelectedCharacters([]);
  }, [currentLevel]);
  
  // Add a new character
  const handleAddCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCharacter.value) {
      setError('Character value is required');
      return;
    }
    
    try {
      setLoading(true);
      // Add to the current level's subcollection
      await addDoc(collection(db, 'languages', languageId, 'characters', currentLevel, 'items'), {
        value: newCharacter.value,
        phonetic: newCharacter.phonetic,
        notes: newCharacter.notes || '',
        etymology: newCharacter.etymology || '', // Add etymology
        createdAt: new Date().toISOString()
      });
      
      setNewCharacter({
        value: '',
        phonetic: '',
        notes: '',
        etymology: ''
      });
      setIsAddingCharacter(false);
      await fetchCharacters();
    } catch (err) {
      console.error('Error adding character:', err);
      setError('Failed to add character');
    } finally {
      setLoading(false);
    }
  };
  
  // Delete a character
  const handleDeleteCharacter = async (id: string) => {
    // Get character data before deletion for cascade delete
    const characterDoc = await getDoc(doc(db, 'languages', languageId, 'characters', currentLevel, 'items', id));
    const characterData = characterDoc.data();
    
    showConfirm(
      'Delete Character',
      'Are you sure you want to delete this character? This will also remove all user assessments for this character.',
      async () => {
        try {
          setLoading(true);
          
          // First, perform cascade deletion of user assessments
          try {
            const cascadeResponse = await fetch('/api/cascade-delete-content', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contentType: 'character',
                contentId: id,
                languageId: languageId,
                level: currentLevel,
                contentValue: characterData?.value
              }),
            });
            
            const cascadeResult = await cascadeResponse.json();
            if (cascadeResult.success) {
              console.log('Cascade deletion completed:', cascadeResult.details);
            } else {
              console.warn('Cascade deletion failed:', cascadeResult.error);
            }
          } catch (cascadeError) {
            console.error('Error performing cascade deletion:', cascadeError);
            // Continue with character deletion even if cascade fails
          }
          
          // Delete the character from the content collection
          await deleteDoc(doc(db, 'languages', languageId, 'characters', currentLevel, 'items', id));
          await fetchCharacters();
          
          showSuccess('Character Deleted', 'Character and all related user assessments have been deleted successfully.');
        } catch (err) {
          console.error('Error deleting character:', err);
          setError('Failed to delete character');
        } finally {
          setLoading(false);
        }
      }
    );
  };
  
  // Start editing a character
  const startEditCharacter = (character: Character) => {
    setEditingCharacter(character);
    setNewCharacter({
      value: character.value,
      phonetic: character.phonetic || '',
      notes: character.notes || '',
      etymology: character.etymology || '' // Add etymology
    });
    setIsAddingCharacter(true);
  };
  
  // Update a character
  const handleUpdateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingCharacter) return;
    
    if (!newCharacter.value) {
      setError('Character value is required');
      return;
    }
    
    try {
      setLoading(true);
      // Update in the current level's subcollection
      await updateDoc(doc(db, 'languages', languageId, 'characters', currentLevel, 'items', editingCharacter.id), {
        value: newCharacter.value,
        phonetic: newCharacter.phonetic,
        notes: newCharacter.notes || '',
        etymology: newCharacter.etymology || '', // Add etymology
      });
      
      setNewCharacter({
        value: '',
        phonetic: '',
        notes: '',
        etymology: ''
      });
      setIsAddingCharacter(false);
      setEditingCharacter(null);
      await fetchCharacters();
    } catch (err) {
      console.error('Error updating character:', err);
      setError('Failed to update character');
    } finally {
      setLoading(false);
    }
  };
  
  // Initialize characters for the current language
  const handleInitializeCharacters = async () => {
    if (!language || !languageId) return;
    
    showConfirm(
      'Initialize Default Characters',
      `Are you sure you want to initialize default characters for ${language.name}? This will add predefined characters with phonetics to each level.`,
      async () => {
        await initializeCharactersToDatabase();
      }
    );
  };

  const initializeCharactersToDatabase = async () => {
    if (!language || !languageId) return;
    
    try {
      setIsInitializing(true);
      setLoading(true);
      
      // Get default characters for this language if available
      const langKey = languageId.toLowerCase() as keyof typeof defaultCharacters;
      const defaultsForLanguage = defaultCharacters[langKey];
      
      if (!defaultsForLanguage) {
        setError(`No default characters defined for ${language.name}`);
        return;
      }
      
      const batch = writeBatch(db);
      const timestamp = new Date().toISOString();
      
      // Add defaults for each level - now as subcollections
      for (const level of levels) {
        const levelKey = level as keyof typeof defaultsForLanguage;
        const charactersForLevel = defaultsForLanguage[levelKey];
        
        if (charactersForLevel) {
          // Create the level document first to ensure the parent path exists
          batch.set(doc(db, 'languages', languageId, 'characters', level), {
            createdAt: timestamp
          });
          
          // Then add items to the subcollection
          for (const character of charactersForLevel) {
            const newDocRef = doc(collection(db, 'languages', languageId, 'characters', level, 'items'));
            batch.set(newDocRef, {
              value: character.value,
              phonetic: character.phonetic,
              notes: character.notes || '',
              etymology: (character as { etymology?: string }).etymology || '', // Add etymology
              createdAt: timestamp
            });
          }
        }
      }
      
      await batch.commit();
      await fetchCharacters();
      
      showSuccess('Characters Initialized', `Successfully initialized characters for ${language?.name || 'this language'}`);
    } catch (err) {
      console.error('Error initializing characters:', err);
      setError('Failed to initialize characters');
    } finally {
      setIsInitializing(false);
      setLoading(false);
    }
  };
  
  // Handle form cancel
  const handleCancel = () => {
    setIsAddingCharacter(false);
    setEditingCharacter(null);
    setNewCharacter({
      value: '',
      phonetic: '',
      notes: '',
      etymology: ''
    });
  };

  // Handle checkbox selection
  const handleSelectCharacter = (characterId: string) => {
    setSelectedCharacters(prev => 
      prev.includes(characterId) 
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  };

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectedCharacters.length === characters.length) {
      setSelectedCharacters([]);
    } else {
      setSelectedCharacters(characters.map(char => char.id));
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedCharacters.length === 0) {
      setError('No characters selected for deletion');
      return;
    }

    showConfirm(
      'Delete Selected Characters',
      `Are you sure you want to delete ${selectedCharacters.length} selected character(s)? This action cannot be undone.`,
      async () => {
        await deleteSelectedCharacters();
      }
    );
  };

  const deleteSelectedCharacters = async () => {
    try {
      setIsDeleting(true);
      setLoading(true);

      // Get character data for cascade deletion
      const characterDataPromises = selectedCharacters.map(async (characterId) => {
        const characterDoc = await getDoc(doc(db, 'languages', languageId, 'characters', currentLevel, 'items', characterId));
        return {
          id: characterId,
          data: characterDoc.data()
        };
      });
      
      const characterDataList = await Promise.all(characterDataPromises);
      
      // Perform cascade deletion for all selected characters
      const cascadePromises = characterDataList.map(async (character) => {
        try {
          const cascadeResponse = await fetch('/api/cascade-delete-content', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contentType: 'character',
              contentId: character.id,
              languageId: languageId,
              level: currentLevel,
              contentValue: character.data?.value
            }),
          });
          
          const cascadeResult = await cascadeResponse.json();
          if (cascadeResult.success) {
            console.log(`Cascade deletion completed for character ${character.id}:`, cascadeResult.details);
          } else {
            console.warn(`Cascade deletion failed for character ${character.id}:`, cascadeResult.error);
          }
        } catch (cascadeError) {
          console.error(`Error performing cascade deletion for character ${character.id}:`, cascadeError);
        }
      });
      
      // Wait for all cascade deletions to complete
      await Promise.all(cascadePromises);

      // Use batch delete for better performance
      const batch = writeBatch(db);
      
      selectedCharacters.forEach(characterId => {
        const characterRef = doc(db, 'languages', languageId, 'characters', currentLevel, 'items', characterId);
        batch.delete(characterRef);
      });

      await batch.commit();
      setSelectedCharacters([]);
      await fetchCharacters();
      
      showSuccess('Characters Deleted', `Successfully deleted ${selectedCharacters.length} character(s) and all related user assessments.`);
    } catch (err) {
      console.error('Error deleting characters:', err);
      setError('Failed to delete selected characters');
    } finally {
      setIsDeleting(false);
      setLoading(false);
    }
  };

  // Preview file content and categorization
  const previewFileContent = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const rows = jsonData.slice(1) as string[][];
      const preview: {
        [level: string]: Array<{
          value: string;
          detectedType: string;
          detectedLanguage: string;
        }>
      } = {
        beginner: [],
        intermediate: [],
        advanced: []
      };

      rows.slice(0, 10).forEach((row) => { // Preview first 10 rows
        if (!row[0] || row[0].toString().trim() === '') return;

        const text = row[0].toString().trim();
        const contentType = detectContentType(text);
        const detectedLanguage = detectLanguage(text);
        
        let targetLevel = 'beginner';
        if (contentType === 'sentence') {
          targetLevel = 'intermediate';
          if (text.length > 50 || 
              text.includes('?') || 
              text.includes('!') ||
              text.includes('？') ||
              text.includes('！') ||
              text.includes('discuss') ||
              text.includes('explain') ||
              text.includes('describe') ||
              text.includes('analyze')) {
            targetLevel = 'advanced';
          }
        }

        preview[targetLevel].push({
          value: text,
          detectedType: contentType,
          detectedLanguage: detectedLanguage
        });
      });

      setPreviewData(preview);
    } catch (err) {
      console.error('Error previewing file:', err);
    }
  };

  // Handle file selection for bulk upload
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || 
          file.name.endsWith('.xls')) {
        setUploadFile(file);
        setError('');
        await previewFileContent(file);
      } else {
        setError('Please select a valid Excel file (.xlsx or .xls)');
        setUploadFile(null);
        setPreviewData(null);
      }
    }
  };

  // Helper function to detect if content is a word or sentence
  const detectContentType = (text: string): 'word' | 'sentence' => {
    const trimmedText = text.trim();
    
    // Check for sentence indicators
    const sentenceEndings = ['.', '!', '?', '。', '！', '？'];
    const hasSentenceEnding = sentenceEndings.some(ending => trimmedText.endsWith(ending));
    
    // Check for multiple words (spaces, punctuation that suggests phrases)
    const hasMultipleWords = /\s/.test(trimmedText) || 
                           trimmedText.includes(',') || 
                           trimmedText.includes('，') ||
                           trimmedText.includes('、') ||
                           trimmedText.includes(';') ||
                           trimmedText.includes('；');
    
    // Check for question words that suggest sentences
    const questionWords = ['what', 'where', 'when', 'why', 'how', 'who', 'which', 
                          'qué', 'dónde', 'cuándo', 'por qué', 'cómo', 'quién', 'cuál',
                          '什么', '哪里', '什么时候', '为什么', '怎么', '谁', '哪个',
                          '何', 'どこ', 'いつ', 'なぜ', 'どう', 'だれ', 'どちら'];
    const hasQuestionWords = questionWords.some(word => 
      trimmedText.toLowerCase().includes(word.toLowerCase())
    );
    
    // Check for common sentence patterns
    const sentencePatterns = [
      /^[A-Z].*[.!?]$/, // English sentence pattern
      /^[A-Z].*[。！？]$/, // Chinese/Japanese sentence pattern
      /^[¿¡].*[?!]$/, // Spanish question pattern
      /^[？！].*[。！？]$/, // Chinese question pattern
    ];
    const matchesSentencePattern = sentencePatterns.some(pattern => pattern.test(trimmedText));
    
    // Determine if it's a sentence
    const isSentence = hasSentenceEnding || 
                      (hasMultipleWords && (hasQuestionWords || matchesSentencePattern)) ||
                      trimmedText.length > 20; // Longer text is likely a sentence
    
    return isSentence ? 'sentence' : 'word';
  };

  // Helper function to detect language from content
  const detectLanguage = (text: string): string => {
    const trimmedText = text.trim();
    
    // Chinese characters
    if (/[\u4e00-\u9fff]/.test(trimmedText)) {
      return 'mandarin';
    }
    
    // Japanese characters (Hiragana, Katakana, Kanji)
    if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(trimmedText)) {
      return 'japanese';
    }
    
    // Korean characters
    if (/[\uac00-\ud7af]/.test(trimmedText)) {
      return 'korean';
    }
    
    // Arabic characters
    if (/[\u0600-\u06ff]/.test(trimmedText)) {
      return 'arabic';
    }
    
    // Cyrillic characters (Russian, etc.)
    if (/[\u0400-\u04ff]/.test(trimmedText)) {
      return 'russian';
    }
    
    // Spanish indicators
    if (trimmedText.includes('ñ') || trimmedText.includes('¿') || trimmedText.includes('¡') ||
        /[áéíóúü]/.test(trimmedText) || 
        trimmedText.toLowerCase().includes('hola') ||
        trimmedText.toLowerCase().includes('gracias')) {
      return 'spanish';
    }
    
    // French indicators
    if (trimmedText.includes('ç') || trimmedText.includes('à') || trimmedText.includes('é') ||
        trimmedText.includes('è') || trimmedText.includes('ù') || trimmedText.includes('â') ||
        trimmedText.includes('ê') || trimmedText.includes('î') || trimmedText.includes('ô') ||
        trimmedText.includes('û') || trimmedText.toLowerCase().includes('bonjour')) {
      return 'french';
    }
    
    // German indicators
    if (trimmedText.includes('ä') || trimmedText.includes('ö') || trimmedText.includes('ü') ||
        trimmedText.includes('ß') || trimmedText.toLowerCase().includes('hallo') ||
        trimmedText.toLowerCase().includes('danke')) {
      return 'german';
    }
    
    // Default to English for Latin script
    return 'english';
  };

  // Check for existing characters to prevent duplicates
  const checkForDuplicateCharacters = async (charactersToCheck: Array<{
    value: string;
    level: string;
  }>): Promise<Set<string>> => {
    const existingCharacters = new Set<string>();
    
    try {
      // Get all existing characters from the database for all levels
      for (const level of levels) {
        const charactersRef = collection(db, 'languages', languageId, 'characters', level, 'items');
        const snapshot = await getDocs(charactersRef);
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const characterKey = `${data.value.toLowerCase().trim()}_${level}`;
          existingCharacters.add(characterKey);
        });
      }
      
      return existingCharacters;
    } catch (err) {
      console.error('Error checking for duplicate characters:', err);
      return new Set<string>();
    }
  };

  // Process Excel file and upload to Firestore with automatic categorization
  const handleBulkUpload = async () => {
    if (!uploadFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadResults({ success: 0, errors: [] });

      // Read the Excel file
      const data = await uploadFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Skip header row and process data
      const rows = jsonData.slice(1) as string[][];
      const categorizedContent: {
        [level: string]: Array<{
          value: string;
          phonetic: string;
          notes: string;
          etymology: string;
          createdAt: string;
          detectedLanguage?: string;
        }>
      } = {
        beginner: [],
        intermediate: [],
        advanced: []
      };
      const errors: string[] = [];
      const categorizationResults: {
        [level: string]: number;
      } = {
        beginner: 0,
        intermediate: 0,
        advanced: 0
      };
      const duplicateResults: {
        [level: string]: number;
      } = {
        beginner: 0,
        intermediate: 0,
        advanced: 0
      };

      // First, collect all characters to check for duplicates
      const charactersToCheck: Array<{
        value: string;
        level: string;
      }> = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        
        if (!row[0] || row[0].toString().trim() === '') {
          errors.push(`Row ${rowNumber}: Character/Word/Phrase is required`);
          return;
        }

        const text = row[0].toString().trim();
        const contentType = detectContentType(text);
        
        // Determine difficulty level based on content type
        let targetLevel = 'beginner';
        if (contentType === 'sentence') {
          targetLevel = 'intermediate';
          // Check if it's a complex sentence that might be advanced
          if (text.length > 50 || 
              text.includes('?') || 
              text.includes('!') ||
              text.includes('？') ||
              text.includes('！') ||
              text.includes('discuss') ||
              text.includes('explain') ||
              text.includes('describe') ||
              text.includes('analyze')) {
            targetLevel = 'advanced';
          }
        }

        charactersToCheck.push({
          value: text,
          level: targetLevel
        });
      });

      // Check for duplicates
      const existingCharacters = await checkForDuplicateCharacters(charactersToCheck);

      // Process each row and categorize automatically
      rows.forEach((row, index) => {
        const rowNumber = index + 2; // +2 because we skipped header and arrays are 0-indexed
        
        if (!row[0] || row[0].toString().trim() === '') {
          errors.push(`Row ${rowNumber}: Character/Word/Phrase is required`);
          return;
        }

        const text = row[0].toString().trim();
        const contentType = detectContentType(text);
        const detectedLanguage = detectLanguage(text);
        
        // Determine difficulty level based on content type
        let targetLevel = 'beginner';
        if (contentType === 'sentence') {
          targetLevel = 'intermediate';
          // Check if it's a complex sentence that might be advanced
          if (text.length > 50 || 
              text.includes('?') || 
              text.includes('!') ||
              text.includes('？') ||
              text.includes('！') ||
              text.includes('discuss') ||
              text.includes('explain') ||
              text.includes('describe') ||
              text.includes('analyze')) {
            targetLevel = 'advanced';
          }
        }

        // Check for duplicates
        const characterKey = `${text.toLowerCase().trim()}_${targetLevel}`;
        if (existingCharacters.has(characterKey)) {
          duplicateResults[targetLevel] = (duplicateResults[targetLevel] || 0) + 1;
          return; // Skip this character as it already exists
        }

        const character = {
          value: text,
          phonetic: row[1] ? row[1].toString().trim() : '',
          notes: row[2] ? row[2].toString().trim() : '',
          etymology: row[3] ? row[3].toString().trim() : '',
          createdAt: new Date().toISOString(),
          detectedLanguage: detectedLanguage
        };

        categorizedContent[targetLevel].push(character);
        categorizationResults[targetLevel]++;
      });

      // Check if we have any valid content
      const totalContent = Object.values(categorizationResults).reduce((sum, count) => sum + count, 0);
      const totalDuplicates = Object.values(duplicateResults).reduce((sum, count) => sum + count, 0);
      
      if (totalContent === 0) {
        if (totalDuplicates > 0) {
          // All content was duplicate
          const duplicateMessage = `All content in the file already exists in the database!\n\n` +
            `🔄 Duplicates found:\n` +
            Object.entries(duplicateResults).map(([level, count]) => 
              count > 0 ? `• ${level.charAt(0).toUpperCase() + level.slice(1)}: ${count} items` : ''
            ).filter(line => line).join('\n') +
            `\n\nNo new content was uploaded.`;
          
          showWarning('All Content Already Exists', duplicateMessage, () => {
            setShowBulkUpload(false);
            setUploadFile(null);
            setPreviewData(null);
            setUploadProgress(0);
            setIsUploading(false);
          });
        } else {
          setError('No valid content found in the file');
        }
        setIsUploading(false);
        return;
      }

      // Upload to appropriate levels
      const batchSize = 500; // Firestore batch limit
      let totalSuccessCount = 0;

      for (const [level, content] of Object.entries(categorizedContent)) {
        if (content.length === 0) continue;

        // Check if this level exists for the current language
        if (!levels.includes(level)) {
          errors.push(`Level '${level}' is not available for this language. Skipping ${content.length} items.`);
          continue;
        }

        // Upload content for this level
        for (let i = 0; i < content.length; i += batchSize) {
          const batch = writeBatch(db);
          const batchData = content.slice(i, i + batchSize);

          batchData.forEach(character => {
            const newDocRef = doc(collection(db, 'languages', languageId, 'characters', level, 'items'));
            batch.set(newDocRef, character);
          });

          try {
            await batch.commit();
            totalSuccessCount += batchData.length;
          } catch (batchError) {
            console.error(`Batch upload error for ${level}:`, batchError);
            errors.push(`Failed to upload ${level} batch starting at row ${i + 2}`);
          }

          // Update progress
          const progress = Math.round((totalSuccessCount / totalContent) * 100);
          setUploadProgress(Math.min(progress, 100));
        }
      }

      setUploadResults({ success: totalSuccessCount, errors });
      
      if (totalSuccessCount > 0) {
        await fetchCharacters(); // Refresh the characters list
      }

      // Show detailed results
      const duplicateCount = Object.values(duplicateResults).reduce((sum, count) => sum + count, 0);
      const duplicateMessage = duplicateCount > 0 ? 
        `\n\n🔄 Duplicates skipped: ${duplicateCount} items` : '';
      
      const resultMessage = `Upload completed!\n\n` +
        `📊 Categorization Results:\n` +
        `• Beginner (words): ${categorizationResults.beginner} items\n` +
        `• Intermediate (sentences): ${categorizationResults.intermediate} items\n` +
        `• Advanced (complex): ${categorizationResults.advanced} items\n\n` +
        `✅ Successfully uploaded: ${totalSuccessCount} items` +
        duplicateMessage +
        `\n❌ Errors: ${errors.length} items`;

      if (errors.length === 0) {
        showSuccess('Upload Successful', resultMessage, () => {
          setShowBulkUpload(false);
          setUploadFile(null);
        });
      } else {
        showError('Upload Completed with Errors', resultMessage + `\n\nCheck details below for specific errors.`);
      }

    } catch (err) {
      console.error('Error processing file:', err);
      setError('Failed to process the Excel file. Please check the format and try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Download Excel template
  const downloadTemplate = () => {
    const templateData = [
      ['Character/Word/Phrase', 'Phonetic', 'Notes', 'Etymology'],
      ['你好', 'nǐ hǎo', 'Hello greeting', 'Combines 你 (you) and 好 (good)'],
      ['Hello', 'həˈloʊ', 'Common greeting', 'From Old English "hæl" meaning "whole, healthy"'],
      ['こんにちは', 'konnichiwa', 'Good afternoon', 'From 今日は (konnichi wa) meaning "today"'],
      ['How are you?', 'haʊ ɑr ju', 'Common question', 'Standard English greeting question'],
      ['¿Cómo estás?', 'koh-mo es-tas', 'How are you?', 'Spanish greeting question'],
      ['What are your thoughts on technology?', '', 'Discussion question', 'Complex question for advanced level'],
      ['Discuss the impact of climate change', '', 'Discussion prompt', 'Advanced discussion topic']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Characters');

    // Auto-size columns
    const colWidths = [
      { wch: 25 }, // Character/Word/Phrase
      { wch: 20 }, // Phonetic
      { wch: 30 }, // Notes
      { wch: 40 }  // Etymology
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `characters_template_${currentLevel}.xlsx`);
  };

  // Close bulk upload modal
  const closeBulkUpload = () => {
    setShowBulkUpload(false);
    setUploadFile(null);
    setUploadProgress(0);
    setUploadResults({ success: 0, errors: [] });
    setPreviewData(null);
    setError('');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 md:w-64 lg:w-64 xl:w-64 bg-[#0277BD] shadow-md text-white shrink-0">
        <div className="p-6 border-b border-[#29B6F6]/30">
          <Image 
            src="/logo_txt.png" 
            alt="PolyglAI" 
            width={140} 
            height={45} 
            className="h-10 w-auto"
          />
        </div>
        <nav className="mt-6">
          <div className="px-4">
            <Link href="/dashboard" className="flex items-center px-4 py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path>
              </svg>
              Dashboard
            </Link>
            <Link href="/dashboard/languages" className="flex items-center px-4 py-3 mt-2 bg-[#29B6F6]/20 rounded-md text-white">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Language Management
            </Link>
            <Link href="/dashboard/word-trainer" className="flex items-center px-4 py-3 mt-2 text-white hover:bg-[#29B6F6]/20 rounded-md">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
              </svg>
              Word Trainer
            </Link>
            <Link href="/dashboard/users" className="flex items-center px-4 py-3 mt-2 text-white hover:bg-[#29B6F6]/20 rounded-md">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
              Users
            </Link>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50">
      {/* Dashboard Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/dashboard">
              <Image src="/logo_txt.png" alt="PolyglAI Logo" width={120} height={40} />
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard/languages" className="text-gray-700 hover:text-blue-600">
              Back to Languages
            </Link>
            <Link href="/dashboard" className="text-gray-700 hover:text-blue-600">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {language ? (
          <>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {language.name} Characters
                </h1>
                <p className="text-gray-600">
                  Manage characters, words and phrases with phonetics
                </p>
              </div>
              <div className="flex space-x-2">
                {selectedCharacters.length > 0 && (
                  <button 
                    onClick={handleBulkDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : `Delete Selected (${selectedCharacters.length})`}
                  </button>
                )}
                <button 
                  onClick={() => setShowBulkUpload(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Bulk Upload Excel
                </button>
                <button 
                  onClick={handleInitializeCharacters}
                  disabled={isInitializing}
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                >
                  {isInitializing ? 'Initializing...' : 'Initialize Default Characters'}
                </button>
                <button 
                  onClick={() => setIsAddingCharacter(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {currentLevel === 'beginner' ? 'Add Word' : 
                   currentLevel === 'intermediate' ? 'Add Sentence' : 
                   'Add Topic'}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
                {error}
              </div>
            )}

            {/* Level Selection */}
            <div className="mb-6 bg-white rounded-lg shadow p-4">
              <div className="flex flex-wrap gap-2">
                {levels.map(level => (
                  <button
                    key={level}
                    onClick={() => setCurrentLevel(level)}
                    className={`px-4 py-2 rounded-md ${
                      currentLevel === level
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Add/Edit Character Form */}
            {isAddingCharacter && (
              <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-lg font-semibold mb-4">
                  {editingCharacter ? 
                    `Edit ${currentLevel === 'beginner' ? 'Word' : currentLevel === 'intermediate' ? 'Sentence' : 'Topic'}` : 
                    `Add New ${currentLevel === 'beginner' ? 'Word' : currentLevel === 'intermediate' ? 'Sentence' : 'Topic'}`
                  }
                </h2>
                <form onSubmit={editingCharacter ? handleUpdateCharacter : handleAddCharacter}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {currentLevel === 'beginner' 
                          ? 'Word' 
                          : currentLevel === 'intermediate' 
                            ? 'Sentence' 
                            : 'Topic'
                        }
                      </label>
                      {currentLevel === 'advanced' && languageId.toLowerCase() === 'english' ? (
                        <textarea
                          value={newCharacter.value}
                          onChange={(e) => setNewCharacter({...newCharacter, value: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          placeholder="e.g. What are your thoughts on the role of technology in modern education?"
                          rows={3}
                          required
                        />
                      ) : (
                      <input
                        type="text"
                        value={newCharacter.value}
                        onChange={(e) => setNewCharacter({...newCharacter, value: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={currentLevel === 'beginner' 
                          ? "e.g. 你好 or Hello" 
                          : currentLevel === 'intermediate' 
                            ? "e.g. How are you? or ¿Cómo estás?" 
                            : "e.g. What are your thoughts on technology?"
                        }
                        required
                      />
                      )}
                    </div>
                    {!(currentLevel === 'advanced' && languageId.toLowerCase() === 'english') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phonetic Pronunciation
                        </label>
                        <input
                          type="text"
                          value={newCharacter.phonetic}
                          onChange={(e) => setNewCharacter({...newCharacter, phonetic: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          placeholder="e.g. nǐ hǎo or hə-lō"
                        />
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {currentLevel === 'beginner' 
                          ? 'Notes (Optional)' 
                          : currentLevel === 'intermediate' 
                            ? 'Notes (Optional)' 
                            : 'Discussion Guidelines (Optional)'
                        }
                      </label>
                      <textarea
                        value={newCharacter.notes}
                        onChange={(e) => setNewCharacter({...newCharacter, notes: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={currentLevel === 'beginner' 
                          ? 'Additional notes or context' 
                          : currentLevel === 'intermediate' 
                            ? 'Additional notes or context' 
                            : 'Guidelines for what the user should discuss or key points to consider'
                        }
                        rows={3}
                      />
                    </div>
                    {currentLevel === 'beginner' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Etymology (Optional)
                        </label>
                        <textarea
                          value={newCharacter.etymology}
                          onChange={(e) => setNewCharacter({...newCharacter, etymology: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          placeholder="Word origin and historical development"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      disabled={loading}
                    >
                      {loading ? (editingCharacter ? 'Updating...' : 'Adding...') : (editingCharacter ? 
                        `Update ${currentLevel === 'beginner' ? 'Word' : currentLevel === 'intermediate' ? 'Sentence' : 'Topic'}` : 
                        `Add ${currentLevel === 'beginner' ? 'Word' : currentLevel === 'intermediate' ? 'Sentence' : 'Topic'}`
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Characters List */}
            {loading && !isAddingCharacter ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading characters...</p>
              </div>
            ) : (
              <>
                {/* Mobile Card Layout */}
                <div className="block lg:hidden">
                  {characters.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                      No characters found for this level. Add one to get started or use the Initialize Default Characters button.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {characters.map((character) => (
                        <div key={character.id} className="bg-white rounded-lg shadow p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <input
                                type="checkbox"
                                checked={selectedCharacters.includes(character.id)}
                                onChange={() => handleSelectCharacter(character.id)}
                                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-medium text-gray-900 break-words">
                                  {character.value}
                                </h3>
                                {character.phonetic && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Phonetic:</span> {character.phonetic}
                                  </p>
                                )}
                                {character.notes && (
                                  <p className="text-sm text-gray-500 mt-1 break-words">
                                    <span className="font-medium">Notes:</span> {character.notes}
                                  </p>
                                )}
                                {currentLevel === 'beginner' && character.etymology && (
                                  <p className="text-sm text-gray-500 mt-1 break-words">
                                    <span className="font-medium">Etymology:</span> {character.etymology}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col space-y-2 ml-4">
                              <button
                                onClick={() => startEditCharacter(character)}
                                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteCharacter(character.id)}
                                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                            <input
                              type="checkbox"
                              checked={characters.length > 0 && selectedCharacters.length === characters.length}
                              onChange={handleSelectAll}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {currentLevel === 'beginner' 
                              ? 'Word' 
                              : currentLevel === 'intermediate' 
                                ? 'Sentence' 
                                : 'Topic'
                            }
                          </th>
                          {!(currentLevel === 'advanced' && languageId.toLowerCase() === 'english') && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Phonetic
                            </th>
                          )}
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {currentLevel === 'beginner' 
                              ? 'Notes' 
                              : currentLevel === 'intermediate' 
                                ? 'Notes' 
                                : 'Guidelines'
                            }
                          </th>
                          {currentLevel === 'beginner' && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Etymology
                            </th>
                          )}
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {characters.length === 0 ? (
                          <tr>
                            <td colSpan={
                              currentLevel === 'beginner' ? 6 : 
                              (currentLevel === 'advanced' && languageId.toLowerCase() === 'english') ? 4 : 5
                            } className="px-6 py-4 text-center text-gray-500">
                              No characters found for this level. Add one to get started or use the Initialize Default Characters button.
                            </td>
                          </tr>
                        ) : (
                          characters.map((character) => (
                            <tr key={character.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <input
                                  type="checkbox"
                                  checked={selectedCharacters.includes(character.id)}
                                  onChange={() => handleSelectCharacter(character.id)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                <div className="max-w-xs break-words">
                                  {character.value}
                                </div>
                              </td>
                              {!(currentLevel === 'advanced' && languageId.toLowerCase() === 'english') && (
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  <div className="max-w-xs break-words">
                                    {character.phonetic || '-'}
                                  </div>
                                </td>
                              )}
                              <td className="px-6 py-4 text-sm text-gray-500">
                                <div className="max-w-xs break-words">
                                  {character.notes || '-'}
                                </div>
                              </td>
                              {currentLevel === 'beginner' && (
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  <div className="max-w-xs break-words">
                                    {character.etymology || '-'}
                                  </div>
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end items-center space-x-3">
                                  <button
                                    onClick={() => startEditCharacter(character)}
                                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                                    title="Edit character"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCharacter(character.id)}
                                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                                    title="Delete character"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        ) : loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading language details...</p>
          </div>
        ) : (
          <div className="text-center py-12 bg-red-50 rounded-lg">
            <p className="text-red-600">Language not found or an error occurred.</p>
            <Link href="/dashboard/languages" className="mt-4 inline-block text-blue-600 hover:underline">
              Return to Languages
            </Link>
          </div>
        )}
      </main>
      </div>

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Bulk Upload Characters
                </h2>
                <button
                  onClick={closeBulkUpload}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">Smart Upload Instructions:</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Download the Excel template to see the required format</li>
                    <li>• Fill in your content (words, phrases, sentences) with phonetics, notes, and etymology</li>
                    <li>• Upload the completed Excel file (.xlsx or .xls)</li>
                    <li>• <strong>Automatic categorization:</strong> Words → Beginner, Sentences → Intermediate, Complex → Advanced</li>
                    <li>• Content will be automatically sorted into appropriate difficulty levels</li>
                    <li>• Mixed content is supported - each item will be categorized individually</li>
                  </ul>
                </div>

                {/* Template Download */}
                <div className="flex justify-center">
                  <button
                    onClick={downloadTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Download Excel Template
                  </button>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isUploading}
                  />
                  {uploadFile && (
                    <p className="mt-2 text-sm text-green-600">
                      Selected: {uploadFile.name}
                    </p>
                  )}

                  {/* Preview Data */}
                  {previewData && (
                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Preview Categorization (first 10 items):</h4>
                      <div className="space-y-3">
                        {Object.entries(previewData).map(([level, items]) => (
                          items.length > 0 && (
                            <div key={level} className="border-l-4 border-blue-500 pl-3">
                              <h5 className="font-medium text-gray-800 capitalize">
                                {level} ({items.length} items)
                              </h5>
                              <div className="mt-1 space-y-1">
                                {items.map((item, index) => (
                                  <div key={index} className="text-sm text-gray-600 flex items-center space-x-2">
                                    <span className="font-mono bg-gray-200 px-2 py-1 rounded text-xs">
                                      {item.detectedType}
                                    </span>
                                    <span className="font-mono bg-blue-100 px-2 py-1 rounded text-xs">
                                      {item.detectedLanguage}
                                    </span>
                                    <span className="truncate max-w-xs">{item.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Progress */}
                {isUploading && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Upload Results */}
                {uploadResults.success > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-medium text-green-900 mb-2">Upload Results:</h3>
                    <p className="text-green-800">
                      Successfully uploaded {uploadResults.success} items with automatic categorization!
                    </p>
                  </div>
                )}

                {/* Upload Errors */}
                {uploadResults.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-medium text-red-900 mb-2">Upload Errors:</h3>
                    <ul className="text-red-800 text-sm space-y-1">
                      {uploadResults.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={closeBulkUpload}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkUpload}
                    disabled={!uploadFile || isUploading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Characters'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Dialog */}
      {dialogState.isOpen && dialogState.options && (
        <CustomDialog
          isOpen={dialogState.isOpen}
          onClose={hideDialog}
          title={dialogState.options.title}
          message={dialogState.options.message}
          type={dialogState.options.type}
          onConfirm={dialogState.options.onConfirm}
          onCancel={dialogState.options.onCancel}
          confirmText={dialogState.options.confirmText}
          cancelText={dialogState.options.cancelText}
          showCancel={dialogState.options.type === 'confirm'}
        />
      )}
    </div>
  );
} 