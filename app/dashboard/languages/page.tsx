'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import AdminSidebar from '../../../src/components/AdminSidebar';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, getDoc, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../../../src/lib/firebase';
import CustomDialog from '../../../src/components/CustomDialog';
import { useCustomDialog } from '../../../src/hooks/useCustomDialog';

type Language = {
  id: string;
  name: string;
  code: string;
  appCode?: string;
  levels?: string[];
};

// Microsoft Azure Speech AI supported languages
const AZURE_SUPPORTED_LANGUAGES = [
  { name: 'English (US)', code: 'en-US', appCode: 'english' },
  { name: 'English (UK)', code: 'en-GB', appCode: 'english' },
  { name: 'English (AU)', code: 'en-AU', appCode: 'english' },
  { name: 'English (CA)', code: 'en-CA', appCode: 'english' },
  { name: 'English (IN)', code: 'en-IN', appCode: 'english' },
  { name: 'English (IE)', code: 'en-IE', appCode: 'english' },
  { name: 'English (NZ)', code: 'en-NZ', appCode: 'english' },
  { name: 'English (ZA)', code: 'en-ZA', appCode: 'english' },
  { name: 'Spanish (ES)', code: 'es-ES', appCode: 'spanish' },
  { name: 'Spanish (MX)', code: 'es-MX', appCode: 'spanish' },
  { name: 'Spanish (AR)', code: 'es-AR', appCode: 'spanish' },
  { name: 'Spanish (CO)', code: 'es-CO', appCode: 'spanish' },
  { name: 'Spanish (PE)', code: 'es-PE', appCode: 'spanish' },
  { name: 'Spanish (VE)', code: 'es-VE', appCode: 'spanish' },
  { name: 'Spanish (CL)', code: 'es-CL', appCode: 'spanish' },
  { name: 'Spanish (EC)', code: 'es-EC', appCode: 'spanish' },
  { name: 'Spanish (UY)', code: 'es-UY', appCode: 'spanish' },
  { name: 'Spanish (PY)', code: 'es-PY', appCode: 'spanish' },
  { name: 'Spanish (BO)', code: 'es-BO', appCode: 'spanish' },
  { name: 'Spanish (HN)', code: 'es-HN', appCode: 'spanish' },
  { name: 'Spanish (SV)', code: 'es-SV', appCode: 'spanish' },
  { name: 'Spanish (NI)', code: 'es-NI', appCode: 'spanish' },
  { name: 'Spanish (PR)', code: 'es-PR', appCode: 'spanish' },
  { name: 'Spanish (DO)', code: 'es-DO', appCode: 'spanish' },
  { name: 'Spanish (CR)', code: 'es-CR', appCode: 'spanish' },
  { name: 'Spanish (PA)', code: 'es-PA', appCode: 'spanish' },
  { name: 'Spanish (GT)', code: 'es-GT', appCode: 'spanish' },
  { name: 'Spanish (CU)', code: 'es-CU', appCode: 'spanish' },
  { name: 'Chinese (Mandarin, Simplified)', code: 'zh-CN', appCode: 'mandarin' },
  { name: 'Chinese (Mandarin, Traditional)', code: 'zh-TW', appCode: 'mandarin' },
  { name: 'Chinese (Cantonese, Traditional)', code: 'zh-HK', appCode: 'mandarin' },
  { name: 'Japanese', code: 'ja-JP', appCode: 'japanese' },
  { name: 'Korean', code: 'ko-KR', appCode: 'korean' },
  { name: 'French (FR)', code: 'fr-FR', appCode: 'french' },
  { name: 'French (CA)', code: 'fr-CA', appCode: 'french' },
  { name: 'French (CH)', code: 'fr-CH', appCode: 'french' },
  { name: 'French (BE)', code: 'fr-BE', appCode: 'french' },
  { name: 'German (DE)', code: 'de-DE', appCode: 'german' },
  { name: 'German (AT)', code: 'de-AT', appCode: 'german' },
  { name: 'German (CH)', code: 'de-CH', appCode: 'german' },
  { name: 'Italian (IT)', code: 'it-IT', appCode: 'italian' },
  { name: 'Italian (CH)', code: 'it-CH', appCode: 'italian' },
  { name: 'Portuguese (BR)', code: 'pt-BR', appCode: 'portuguese' },
  { name: 'Portuguese (PT)', code: 'pt-PT', appCode: 'portuguese' },
  { name: 'Russian', code: 'ru-RU', appCode: 'russian' },
  { name: 'Dutch (NL)', code: 'nl-NL', appCode: 'dutch' },
  { name: 'Dutch (BE)', code: 'nl-BE', appCode: 'dutch' },
  { name: 'Swedish', code: 'sv-SE', appCode: 'swedish' },
  { name: 'Norwegian', code: 'nb-NO', appCode: 'norwegian' },
  { name: 'Danish', code: 'da-DK', appCode: 'danish' },
  { name: 'Finnish', code: 'fi-FI', appCode: 'finnish' },
  { name: 'Polish', code: 'pl-PL', appCode: 'polish' },
  { name: 'Czech', code: 'cs-CZ', appCode: 'czech' },
  { name: 'Hungarian', code: 'hu-HU', appCode: 'hungarian' },
  { name: 'Romanian', code: 'ro-RO', appCode: 'romanian' },
  { name: 'Bulgarian', code: 'bg-BG', appCode: 'bulgarian' },
  { name: 'Croatian', code: 'hr-HR', appCode: 'croatian' },
  { name: 'Slovak', code: 'sk-SK', appCode: 'slovak' },
  { name: 'Slovenian', code: 'sl-SI', appCode: 'slovenian' },
  { name: 'Greek', code: 'el-GR', appCode: 'greek' },
  { name: 'Turkish', code: 'tr-TR', appCode: 'turkish' },
  { name: 'Hebrew', code: 'he-IL', appCode: 'hebrew' },
  { name: 'Arabic (SA)', code: 'ar-SA', appCode: 'arabic' },
  { name: 'Arabic (EG)', code: 'ar-EG', appCode: 'arabic' },
  { name: 'Arabic (AE)', code: 'ar-AE', appCode: 'arabic' },
  { name: 'Arabic (JO)', code: 'ar-JO', appCode: 'arabic' },
  { name: 'Arabic (KW)', code: 'ar-KW', appCode: 'arabic' },
  { name: 'Arabic (QA)', code: 'ar-QA', appCode: 'arabic' },
  { name: 'Arabic (LB)', code: 'ar-LB', appCode: 'arabic' },
  { name: 'Arabic (OM)', code: 'ar-OM', appCode: 'arabic' },
  { name: 'Arabic (IQ)', code: 'ar-IQ', appCode: 'arabic' },
  { name: 'Arabic (MA)', code: 'ar-MA', appCode: 'arabic' },
  { name: 'Arabic (TN)', code: 'ar-TN', appCode: 'arabic' },
  { name: 'Arabic (DZ)', code: 'ar-DZ', appCode: 'arabic' },
  { name: 'Arabic (LY)', code: 'ar-LY', appCode: 'arabic' },
  { name: 'Arabic (SD)', code: 'ar-SD', appCode: 'arabic' },
  { name: 'Arabic (YE)', code: 'ar-YE', appCode: 'arabic' },
  { name: 'Arabic (SY)', code: 'ar-SY', appCode: 'arabic' },
  { name: 'Arabic (BH)', code: 'ar-BH', appCode: 'arabic' },
  { name: 'Hindi', code: 'hi-IN', appCode: 'hindi' },
  { name: 'Thai', code: 'th-TH', appCode: 'thai' },
  { name: 'Vietnamese', code: 'vi-VN', appCode: 'vietnamese' },
  { name: 'Indonesian', code: 'id-ID', appCode: 'indonesian' },
  { name: 'Malay', code: 'ms-MY', appCode: 'malay' },
  { name: 'Filipino', code: 'fil-PH', appCode: 'filipino' },
  { name: 'Ukrainian', code: 'uk-UA', appCode: 'ukrainian' },
  { name: 'Serbian', code: 'sr-RS', appCode: 'serbian' },
  { name: 'Lithuanian', code: 'lt-LT', appCode: 'lithuanian' },
  { name: 'Latvian', code: 'lv-LV', appCode: 'latvian' },
  { name: 'Estonian', code: 'et-EE', appCode: 'estonian' },
  { name: 'Icelandic', code: 'is-IS', appCode: 'icelandic' },
  { name: 'Maltese', code: 'mt-MT', appCode: 'maltese' },
  { name: 'Welsh', code: 'cy-GB', appCode: 'welsh' },
  { name: 'Irish', code: 'ga-IE', appCode: 'irish' },
  { name: 'Basque', code: 'eu-ES', appCode: 'basque' },
  { name: 'Catalan', code: 'ca-ES', appCode: 'catalan' },
  { name: 'Galician', code: 'gl-ES', appCode: 'galician' },
  { name: 'Afrikaans', code: 'af-ZA', appCode: 'afrikaans' },
  { name: 'Swahili', code: 'sw-KE', appCode: 'swahili' },
  { name: 'Amharic', code: 'am-ET', appCode: 'amharic' },
  { name: 'Azerbaijani', code: 'az-AZ', appCode: 'azerbaijani' },
  { name: 'Bengali', code: 'bn-BD', appCode: 'bengali' },
  { name: 'Bosnian', code: 'bs-BA', appCode: 'bosnian' },
  { name: 'Georgian', code: 'ka-GE', appCode: 'georgian' },
  { name: 'Gujarati', code: 'gu-IN', appCode: 'gujarati' },
  { name: 'Kannada', code: 'kn-IN', appCode: 'kannada' },
  { name: 'Kazakh', code: 'kk-KZ', appCode: 'kazakh' },
  { name: 'Khmer', code: 'km-KH', appCode: 'khmer' },
  { name: 'Lao', code: 'lo-LA', appCode: 'lao' },
  { name: 'Macedonian', code: 'mk-MK', appCode: 'macedonian' },
  { name: 'Malayalam', code: 'ml-IN', appCode: 'malayalam' },
  { name: 'Marathi', code: 'mr-IN', appCode: 'marathi' },
  { name: 'Mongolian', code: 'mn-MN', appCode: 'mongolian' },
  { name: 'Myanmar', code: 'my-MM', appCode: 'myanmar' },
  { name: 'Nepali', code: 'ne-NP', appCode: 'nepali' },
  { name: 'Punjabi', code: 'pa-IN', appCode: 'punjabi' },
  { name: 'Sinhala', code: 'si-LK', appCode: 'sinhala' },
  { name: 'Tamil', code: 'ta-IN', appCode: 'tamil' },
  { name: 'Telugu', code: 'te-IN', appCode: 'telugu' },
  { name: 'Urdu', code: 'ur-PK', appCode: 'urdu' },
  { name: 'Uzbek', code: 'uz-UZ', appCode: 'uzbek' },
  { name: 'Zulu', code: 'zu-ZA', appCode: 'zulu' },
];

export default function Languages() {
  const [loading, setLoading] = useState(true);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isAddingLanguage, setIsAddingLanguage] = useState(false);
  const [newLanguage, setNewLanguage] = useState({ name: '', code: '', appCode: '' });
  const [error, setError] = useState('');
  const { dialogState, showConfirm, hideDialog, showSuccess } = useCustomDialog();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        fetchLanguages();
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  const fetchLanguages = async () => {
    try {
      setLoading(true);
      const languagesQuery = query(collection(db, 'languages'), orderBy('name'));
      const snapshot = await getDocs(languagesQuery);
      
      const languagesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Language[];
      
      setLanguages(languagesList);
    } catch (err) {
      console.error('Error fetching languages:', err);
      setError('Failed to load languages');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newLanguage.name || !newLanguage.code || !newLanguage.appCode) {
      setError('Please select a language from the dropdown');
      return;
    }
    
    try {
      setLoading(true);
      await addDoc(collection(db, 'languages'), {
        name: newLanguage.name,
        code: newLanguage.code,
        appCode: newLanguage.appCode,
        levels: ['beginner', 'intermediate'],
        available: true,
        createdAt: new Date().toISOString(),
      });
      
      setNewLanguage({ name: '', code: '', appCode: '' });
      setIsAddingLanguage(false);
      await fetchLanguages();
    } catch (err) {
      console.error('Error adding language:', err);
      setError('Failed to add language');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLanguage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the card click event
    showConfirm(
      'Delete Language',
      'Are you sure you want to delete this language? This will delete all associated data.',
      () => performDeleteLanguage(id),
      undefined,
      'Delete',
      'Cancel'
    );
  };

  const performDeleteLanguage = async (id: string) => {
    try {
      setLoading(true);
      
      // Get language data before deletion for cascade delete
      const languageDoc = await getDoc(doc(db, 'languages', id));
      const languageData = languageDoc.data();
      
      // First, perform cascade deletion of all user assessments for this language
      try {
        const cascadeResponse = await fetch('/api/cascade-delete-content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contentType: 'language',
            contentId: id,
            languageId: id,
            level: 'all',
            contentValue: languageData?.name
          }),
        });
        
        const cascadeResult = await cascadeResponse.json();
        if (cascadeResult.success) {
          console.log('Cascade deletion completed for language:', cascadeResult.details);
        } else {
          console.warn('Cascade deletion failed for language:', cascadeResult.error);
        }
      } catch (cascadeError) {
        console.error('Error performing cascade deletion for language:', cascadeError);
        // Continue with language deletion even if cascade fails
      }
      
      await deleteDoc(doc(db, 'languages', id));
      await fetchLanguages();
      
      showSuccess('Language Deleted', 'Language and all related user assessments have been deleted successfully.');
    } catch (err) {
      console.error('Error deleting language:', err);
      setError('Failed to delete language');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageClick = (languageId: string) => {
    router.push(`/dashboard/languages/${languageId}/characters`);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile menu backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/10 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`hidden lg:block`}><AdminSidebar active="languages" /></div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 bg-gray-50">
        {/* Mobile header */}
        <div className="lg:hidden bg-white shadow-sm border-b border-[#29B6F6]/20">
          <div className="px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path>
              </svg>
            </button>
            <h1 className="text-lg font-bold text-[#0277BD]">Language Management</h1>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>
        </div>

        {/* Dashboard Header */}
        <header className="bg-white shadow hidden lg:block">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0277BD] mb-4 sm:mb-0">Language Management</h1>
            <div>
              <button 
                onClick={() => setIsAddingLanguage(true)}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base"
              >
                Add Language
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Add Button */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
          <button 
            onClick={() => setIsAddingLanguage(true)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            Add Language
          </button>
        </div>

        {/* Main Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
              {error}
            </div>
          )}

          {isAddingLanguage && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-lg font-semibold mb-4">Add New Language</h2>
              <form onSubmit={handleAddLanguage}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Language</label>
                  <select
                    value={newLanguage.name}
                    onChange={(e) => {
                      const selectedLang = AZURE_SUPPORTED_LANGUAGES.find(lang => lang.name === e.target.value);
                      if (selectedLang) {
                        setNewLanguage({
                          name: selectedLang.name,
                          code: selectedLang.code,
                          appCode: selectedLang.appCode
                        });
                      }
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Choose a language...</option>
                    {AZURE_SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.name}>
                        {lang.name} ({lang.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select from Microsoft Azure Speech AI supported languages
                  </p>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingLanguage(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Adding...' : 'Add Language'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Languages List */}
          {loading && !isAddingLanguage ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading languages...</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="divide-y divide-gray-200">
                {languages.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No languages found. Add a language to get started.
                  </div>
                ) : (
                  languages.map((language) => (
                    <div 
                      key={language.id} 
                      className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleLanguageClick(language.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{language.name}</h3>
                          <div className="flex space-x-6 mt-2 text-sm text-gray-500">
                            <span>Azure Code: {language.code}</span>
                            <span>App Code: {language.appCode || 'N/A'}</span>
                            <span>Levels: {language.levels ? language.levels.join(', ') : 'beginner, intermediate'}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => handleDeleteLanguage(language.id, e)}
                            className="px-3 py-1 bg-red-100 text-red-800 rounded-md text-sm hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      
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