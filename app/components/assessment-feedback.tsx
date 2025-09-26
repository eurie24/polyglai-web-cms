import React from 'react';

interface PhonemeEntry {
  phone?: string;
  phoneme?: string;
  pronunciation?: number;
  tone?: number;
}

interface WordEntry {
  phonemes?: PhonemeEntry[];
  word?: string;
  scores?: { overall?: number };
}

interface AssessmentApiResult {
  words?: WordEntry[];
  pronunciation?: number;
  fluency?: number;
  integrity?: number;
  prosody?: number;
  rhythm?: number;
  rear_tone?: string;
}

interface AssessmentApiResponse {
  result?: AssessmentApiResult;
}

interface AssessmentFeedbackProps {
  targetText: string;
  level: string;
  language: string;
  overallScore: number;
  apiResponse: AssessmentApiResponse;
  isHighScore: boolean;
  onClose: () => void;
}

interface PhonemeData {
  phoneme: string;
  pronunciation: number;
  tone?: number;
  feedback: string;
}

interface SentenceMetrics {
  pronunciation: number;
  fluency: number;
  completeness: number;
  prosody: number;
}

const AssessmentFeedback: React.FC<AssessmentFeedbackProps> = ({
  targetText,
  level,
  language,
  overallScore,
  apiResponse,
  isHighScore,
  onClose
}) => {
  const [openMetric, setOpenMetric] = React.useState<null | 'pronunciation' | 'fluency' | 'completeness' | 'prosody'>(null);
  // Ensure scores are within [0, 100]
  const normalizeScore = (score: number | undefined): number => {
    const s = Math.round(typeof score === 'number' ? score : 0);
    return Math.max(0, Math.min(100, s));
  };

  // Extract phonemes from API response
  const getPhonemes = (): PhonemeData[] => {
    console.log('AssessmentFeedback getPhonemes - apiResponse:', apiResponse);
    console.log('AssessmentFeedback getPhonemes - level:', level);
    console.log('AssessmentFeedback getPhonemes - result:', apiResponse?.result);
    console.log('AssessmentFeedback getPhonemes - words:', apiResponse?.result?.words);
    
    const phonemes: PhonemeData[] = [];
    
    // Prefer Azure originalResponse words when available for accuracy
    const anyResponse = apiResponse as unknown as { originalResponse?: any };
    const originalWords: any[] | undefined = anyResponse?.originalResponse?.NBest?.[0]?.Words;

    if (level === 'intermediate' && Array.isArray(originalWords) && originalWords.length > 0) {
      // Build per-word pronunciation entries based on Azure word scores
      originalWords.forEach((w: any) => {
        const wordText: string = typeof w?.Word === 'string' ? w.Word : '';
        const score: number = normalizeScore(w?.AccuracyScore);
        if (wordText) {
          phonemes.push({
            phoneme: wordText,
            pronunciation: score,
            tone: 0,
            feedback: getScoreFeedback(score)
          });
        }
      });
      return phonemes;
    }

    if (apiResponse?.result?.words && apiResponse.result.words.length > 0) {
      const words = apiResponse.result.words;
      
      if (level === 'beginner' && words[0]?.phonemes) {
        // For beginner level, get phonemes from first word
        words[0].phonemes.forEach((phoneme: PhonemeEntry) => {
          const score = normalizeScore(phoneme.pronunciation);
          phonemes.push({
            phoneme: phoneme.phone || phoneme.phoneme || '',
            pronunciation: score,
            tone: phoneme.tone || 0,
            feedback: getScoreFeedback(score)
          });
        });
      } else if (level === 'intermediate') {
        // If no originalResponse, fallback to words[].scores.overall if present
        words.forEach((word: WordEntry) => {
          const wordText = word.word || '';
          const score = normalizeScore(word?.scores?.overall);
          if (wordText) {
            phonemes.push({
              phoneme: wordText,
              pronunciation: score,
              tone: 0,
              feedback: getScoreFeedback(score)
            });
          }
        });
      }
    }
    
    return phonemes;
  };

  // Get sentence-level metrics for intermediate
  const getSentenceMetrics = (): SentenceMetrics => {
    if (level === 'intermediate' && apiResponse?.result) {
      const result = apiResponse.result;
      return {
        pronunciation: normalizeScore(result.pronunciation || 0),
        fluency: normalizeScore(result.fluency || 0),
        completeness: normalizeScore(result.integrity || 0),
        prosody: normalizeScore(result.prosody || result.rhythm || 0)
      };
    }
    return {
      pronunciation: 0,
      fluency: 0,
      completeness: 0,
      prosody: 0
    };
  };

  // Get score feedback message
  const getScoreFeedback = (score: number): string => {
    if (score >= 90) return 'Excellent pronunciation!';
    if (score >= 80) return 'Good pronunciation';
    if (score >= 70) return 'Fair pronunciation';
    if (score >= 60) return 'Needs improvement';
    return 'Practice more';
  };

  // Get score message
  const getScoreMessage = (score: number): string => {
    if (score >= 90) return 'Excellent pronunciation!';
    if (score >= 80) return 'Great pronunciation';
    if (score >= 70) return 'Good pronunciation';
    if (score >= 60) return 'Fair pronunciation';
    return 'Keep practicing';
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

  // Get score color
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  // Get feedback background color
  const getFeedbackBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-orange-100';
    return 'bg-red-100';
  };

  // Get feedback text color
  const getFeedbackTextColor = (score: number): string => {
    if (score >= 80) return 'text-green-700';
    if (score >= 60) return 'text-orange-700';
    return 'text-red-700';
  };

  // Get short feedback
  const getShortFeedback = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 30) return 'Fair';
    return 'Poor';
  };

  const phonemes = getPhonemes();
  const sentenceMetrics = getSentenceMetrics();

  // Advanced helpers aligned with Flutter english_advanced_assessment_sheet.dart
  const hasResult = !!apiResponse?.result;
  const result = apiResponse?.result as (AssessmentApiResult & {
    content?: number;
    vocabulary?: number;
    grammar?: number;
    topic?: number;
    wordCount?: number;
    transcribedText?: string;
    words?: Array<{
      word?: string;
      score?: number;
      scores?: { overall?: number };
      phonemes?: Array<{ phone?: string; phoneme?: string; pronunciation?: number; score?: number }>;
    }>;
  }) | undefined;

  const getAdvancedPronunciationScore = (): number => {
    if (!hasResult || !result) return Math.round(overallScore);
    const pronunciation = Math.round(result.pronunciation ?? 0);
    const fluency = Math.round(result.fluency ?? 0);
    const prosody = Math.round((result.prosody ?? result.rhythm ?? 0));
    const values = [pronunciation, fluency, prosody].filter(v => v > 0);
    if (values.length === 0) return Math.round(overallScore);
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  const getAdvancedContentScore = (): number => {
    if (!hasResult || !result) return Math.round(overallScore * 0.7);
    const content = Math.round(result.content ?? 0);
    const vocabulary = Math.round(result.vocabulary ?? 0);
    const grammar = Math.round(result.grammar ?? 0);
    const topic = Math.round(result.topic ?? 0);
    const values = [content, vocabulary, grammar, topic].filter(v => v > 0);
    if (values.length === 0) return Math.round(overallScore * 0.7);
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  const getAdvancedPronunciationBreakdown = (): Array<{ label: string; score: number }> => {
    if (!hasResult || !result) {
      return [
        { label: 'Accuracy score', score: Math.round(overallScore) },
        { label: 'Fluency score', score: Math.round(overallScore) },
        { label: 'Prosody score', score: Math.round(overallScore) },
      ];
    }
    return [
      { label: 'Accuracy score', score: Math.round(result.pronunciation ?? Math.round(overallScore)) },
      { label: 'Fluency score', score: Math.round(result.fluency ?? Math.round(overallScore)) },
      { label: 'Prosody score', score: Math.round(result.prosody ?? result.rhythm ?? Math.round(overallScore)) },
    ];
  };

  const getAdvancedContentBreakdown = (): Array<{ label: string; score: number }> => {
    if (!hasResult || !result) {
      return [
        { label: 'Vocabulary score', score: Math.round(overallScore * 0.6) },
        { label: 'Grammar score', score: Math.round(overallScore * 0.5) },
        { label: 'Topic score', score: Math.round(overallScore * 0.8) },
      ];
    }
    return [
      { label: 'Vocabulary score', score: Math.round((result.vocabulary as number | undefined) ?? Math.round(overallScore * 0.6)) },
      { label: 'Grammar score', score: Math.round((result.grammar as number | undefined) ?? Math.round(overallScore * 0.5)) },
      { label: 'Topic score', score: Math.round((result.topic as number | undefined) ?? Math.round(overallScore * 0.8)) },
    ];
  };

  const colorForScore = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const bgForScore = (score: number): string => {
    if (score >= 80) return 'bg-green-100 text-green-700';
    if (score >= 60) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {language.charAt(0).toUpperCase() + language.slice(1)} {level.charAt(0).toUpperCase() + level.slice(1)} Assessment
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {level === 'advanced' && (
              <>
                <div className="text-center">
                  <p className="text-lg text-gray-600">English Advanced Assessment</p>
                </div>

                {isHighScore && (
                  <div className="flex justify-center">
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                      New High Score!
                    </div>
                  </div>
                )}

                {/* Pronunciation score (overall only) */}
                <div className="p-4 border rounded-lg">
                  <div className="text-center text-lg font-semibold text-gray-900">Pronunciation score</div>
                  <div className="mt-4 flex items-center justify-center">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-gray-200" />
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="transparent" strokeDasharray={`${2 * Math.PI * 10}`} strokeDashoffset={`${2 * Math.PI * 10 * (1 - getAdvancedPronunciationScore() / 100)}`} className={getScoreColor(getAdvancedPronunciationScore())} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-xl font-bold ${getScoreColor(getAdvancedPronunciationScore())}`}>{getAdvancedPronunciationScore()}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content score (overall only) */}
                <div className="p-4 border rounded-lg">
                  <div className="text-center text-lg font-semibold text-gray-900">Content score</div>
                  <div className="mt-4 flex items-center justify-center">
                    <div className="relative w-20 h-20">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-gray-200" />
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="transparent" strokeDasharray={`${2 * Math.PI * 10}`} strokeDashoffset={`${2 * Math.PI * 10 * (1 - getAdvancedContentScore() / 100)}`} className={getScoreColor(getAdvancedContentScore())} />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-xl font-bold ${getScoreColor(getAdvancedContentScore())}`}>{getAdvancedContentScore()}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed analysis blocks */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="px-4 py-2 font-semibold bg-blue-50 border-b">Pronunciation Analysis</div>
                  <div className="divide-y">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="text-sm text-gray-700">Pronunciation</div>
                      <div className="flex items-center space-x-2">
                        {(() => { const v = Math.round(result?.pronunciation ?? overallScore); return (
                          <>
                            <span className={`text-sm font-semibold ${colorForScore(v)}`}>{v}%</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${getFeedbackBgColor(v)} ${getFeedbackTextColor(v)}`}>{getShortFeedback(v)}</span>
                          </>
                        );})()}
                      </div>
                    </div>
                    {typeof result?.fluency === 'number' && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="text-sm text-gray-700">Fluency</div>
                        <div className="flex items-center space-x-2">
                          {(() => { const v = Math.round(result?.fluency ?? 0); return (
                            <>
                              <span className={`text-sm font-semibold ${colorForScore(v)}`}>{v}%</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${getFeedbackBgColor(v)} ${getFeedbackTextColor(v)}`}>{getShortFeedback(v)}</span>
                            </>
                          );})()}
                        </div>
                      </div>
                    )}
                    {typeof result?.integrity === 'number' && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="text-sm text-gray-700">Completeness</div>
                        <div className="flex items-center space-x-2">
                          {(() => { const v = Math.round(result?.integrity ?? 0); return (
                            <>
                              <span className={`text-sm font-semibold ${colorForScore(v)}`}>{v}%</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${getFeedbackBgColor(v)} ${getFeedbackTextColor(v)}`}>{getShortFeedback(v)}</span>
                            </>
                          );})()}
                        </div>
                      </div>
                    )}
                    {(typeof result?.prosody === 'number' || typeof result?.rhythm === 'number') && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="text-sm text-gray-700">Prosody</div>
                        <div className="flex items-center space-x-2">
                          {(() => { const v = Math.round((result?.prosody ?? result?.rhythm) ?? 0); return (
                            <>
                              <span className={`text-sm font-semibold ${colorForScore(v)}`}>{v}%</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${getFeedbackBgColor(v)} ${getFeedbackTextColor(v)}`}>{getShortFeedback(v)}</span>
                            </>
                          );})()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="px-4 py-2 font-semibold bg-blue-50 border-b">Content Analysis</div>
                  <div className="divide-y">
                    {getAdvancedContentBreakdown().map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-4 py-3">
                        <div className="text-sm text-gray-700">{row.label}</div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-semibold ${row.score >= 80 ? 'text-green-600' : row.score >= 60 ? 'text-orange-600' : 'text-red-600'}`}>{row.score}%</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${getFeedbackBgColor(row.score)} ${getFeedbackTextColor(row.score)}`}>{getShortFeedback(row.score)}</span>
                        </div>
                      </div>
                    ))}
                    {typeof result?.wordCount === 'number' && (
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="text-sm text-gray-700">Word Count</div>
                        <span className="text-sm font-semibold text-gray-800">{result.wordCount}</span>
                      </div>
                    )}
                    {result?.transcribedText && result.transcribedText.trim().length > 0 && (
                      <div className="px-4 py-3">
                        <div className="flex items-center space-x-2 mb-2 text-sm font-semibold text-gray-800">
                          <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                          <span>Your Response:</span>
                        </div>
                        <div className="p-3 bg-gray-50 rounded border border-gray-200 text-sm italic text-gray-700">{result.transcribedText}</div>
                      </div>
                    )}
                  </div>
                </div>

                {Array.isArray(result?.words) && result!.words!.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 font-semibold bg-blue-50">Word Analysis ({result!.words!.length} words)</div>
                    <div className="divide-y">
                      {result!.words!.map((w, idx) => {
                        const wordText = w.word ?? '';
                        const score = Math.round(w.scores?.overall ?? (w as any).score ?? 0);
                        const phs = Array.isArray(w.phonemes) ? w.phonemes : [];
                        return (
                          <div key={idx}>
                            <div className={`flex items-center justify-between px-4 py-3 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                              <div className="text-gray-900 font-semibold">{wordText}</div>
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${bgForScore(score)}`}>{score}</span>
                            </div>
                            {phs.length > 0 && (
                              <div className={`px-6 py-2 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                                <div className="text-xs font-semibold text-gray-600 mb-2">Phoneme Breakdown:</div>
                                <div className="flex flex-wrap gap-2">
                                  {phs.map((p, i) => {
                                    const phone = p.phone ?? p.phoneme ?? '';
                                    const pScore = Math.round((p as any).pronunciation ?? (p as any).score ?? 0);
                                    return (
                                      <span key={i} className={`text-[11px] px-2 py-0.5 rounded border ${pScore >= 80 ? 'bg-green-50 text-green-700 border-green-400' : pScore >= 60 ? 'bg-orange-50 text-orange-700 border-orange-400' : 'bg-red-50 text-red-700 border-red-400'}`}>
                                        {phone} ({pScore})
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
            {/* Score Message */}
            <div className="text-center">
              <p className="text-lg text-gray-600">{getScoreMessage(overallScore)}</p>
            </div>

            {/* Overall score circle removed as redundant */}

            {/* High Score Badge */}
            {isHighScore && (
              <div className="flex justify-center">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  New High Score!
                </div>
              </div>
            )}

            {/* Sentence Metrics for Intermediate Level */}
            {level === 'intermediate' && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Sentence Metrics</h3>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setOpenMetric(openMetric === 'pronunciation' ? null : 'pronunciation')}
                    className="w-full text-left"
                  >
                    <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Pronunciation:</span>
                    <div className="flex items-center space-x-2">
                      <span className={`font-semibold ${getScoreColor(sentenceMetrics.pronunciation)}`}>
                        {sentenceMetrics.pronunciation}%
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFeedbackBgColor(sentenceMetrics.pronunciation)} ${getFeedbackTextColor(sentenceMetrics.pronunciation)}`}>
                        {getShortFeedback(sentenceMetrics.pronunciation)}
                      </span>
                    </div>
                    </div>
                    {openMetric === 'pronunciation' && (
                      <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">{getMetricInfo('pronunciation')}</div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenMetric(openMetric === 'fluency' ? null : 'fluency')}
                    className="w-full text-left"
                  >
                    <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Fluency:</span>
                    <div className="flex items-center space-x-2">
                      <span className={`font-semibold ${getScoreColor(sentenceMetrics.fluency)}`}>
                        {sentenceMetrics.fluency}%
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFeedbackBgColor(sentenceMetrics.fluency)} ${getFeedbackTextColor(sentenceMetrics.fluency)}`}>
                        {getShortFeedback(sentenceMetrics.fluency)}
                      </span>
                    </div>
                    </div>
                    {openMetric === 'fluency' && (
                      <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">{getMetricInfo('fluency')}</div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenMetric(openMetric === 'completeness' ? null : 'completeness')}
                    className="w-full text-left"
                  >
                    <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Completeness:</span>
                    <div className="flex items-center space-x-2">
                      <span className={`font-semibold ${getScoreColor(sentenceMetrics.completeness)}`}>
                        {sentenceMetrics.completeness}%
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFeedbackBgColor(sentenceMetrics.completeness)} ${getFeedbackTextColor(sentenceMetrics.completeness)}`}>
                        {getShortFeedback(sentenceMetrics.completeness)}
                      </span>
                    </div>
                    </div>
                    {openMetric === 'completeness' && (
                      <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">{getMetricInfo('completeness')}</div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenMetric(openMetric === 'prosody' ? null : 'prosody')}
                    className="w-full text-left"
                  >
                    <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">Prosody:</span>
                    <div className="flex items-center space-x-2">
                      <span className={`font-semibold ${getScoreColor(sentenceMetrics.prosody)}`}>
                        {sentenceMetrics.prosody}%
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFeedbackBgColor(sentenceMetrics.prosody)} ${getFeedbackTextColor(sentenceMetrics.prosody)}`}>
                        {getShortFeedback(sentenceMetrics.prosody)}
                      </span>
                    </div>
                    </div>
                    {openMetric === 'prosody' && (
                      <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700">{getMetricInfo('prosody')}</div>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Pronunciation Analysis */}
            {phonemes.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Pronunciation Analysis</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Phoneme</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Score</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Quality</th>
                        <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Feedback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phonemes.map((phoneme, index) => (
                        <tr key={index} className="border-b border-gray-200">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {phoneme.phoneme}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${getScoreColor(phoneme.pronunciation)}`}>
                              {phoneme.pronunciation}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center">
                              {phoneme.pronunciation >= 80 ? (
                                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              ) : phoneme.pronunciation >= 60 ? (
                                <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFeedbackBgColor(phoneme.pronunciation)} ${getFeedbackTextColor(phoneme.pronunciation)}`}>
                              {phoneme.feedback}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tone Analysis for Intermediate */}
            {level === 'intermediate' && apiResponse?.result?.rear_tone && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Tone</h3>
                <div className="p-4 bg-white rounded-lg">
                  <p className="text-gray-700">
                    {apiResponse.result.rear_tone === "fall" 
                      ? "• You used falling tone at the end of the sentence."
                      : apiResponse.result.rear_tone === "rise"
                      ? "• You used rising tone at the end of the sentence."
                      : "• Your tone at the end of the sentence was neutral."
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Practice Suggestions */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Practice Suggestion</h3>
              <p className="text-blue-700">
                {level === 'beginner'
                  ? "Focus on sounds with lower scores. Practice slow repetition of those specific sounds to improve your pronunciation."
                  : "Practice the sentence with natural rhythm and intonation. Pay attention to word stress and the rise and fall of your voice throughout the sentence."
                }
              </p>
            </div>

            {/* Language-Specific Tips */}
            <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
              <h3 className="text-lg font-semibold text-teal-800 mb-2">
                {level === 'beginner' ? 'English Sound Tips' : 'English Sentence Tips'}
              </h3>
              <p className="text-teal-700">
                {level === 'beginner'
                  ? "English has many vowel sounds that may not exist in your language. Pay attention to the difference between similar sounds like 'i' in 'ship' and 'ee' in 'sheep'. Practice consonant clusters like 'str' or 'spl' which can be challenging."
                  : "English is a stress-timed language, meaning stressed syllables occur at regular intervals. Focus on reducing unstressed syllables and linking words together naturally. In questions, your pitch should typically rise at the end for yes/no questions, and fall for wh-questions."
                }
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentFeedback;
