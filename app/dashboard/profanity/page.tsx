'use client';

import React, { useState, useEffect } from 'react';
import { ProfanityCounterService, GlobalProfanityStats, ProfanityRecord } from '../../../src/services/profanityCounterService';
import CustomDialog from '../../../src/components/CustomDialog';
import { useCustomDialog } from '../../../src/hooks/useCustomDialog';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ProfanityDashboardProps {}

const ProfanityDashboard: React.FC<ProfanityDashboardProps> = () => {
  const [globalStats, setGlobalStats] = useState<GlobalProfanityStats | null>(null);
  const [recentRecords, setRecentRecords] = useState<ProfanityRecord[]>([]);
  const [, setDailyStats] = useState<Record<string, unknown>[]>([]);
  const [languageStats, setLanguageStats] = useState<Record<string, unknown>[]>([]);
  const [, setTrends] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(30);
  const { dialogState, showConfirm, showSuccess, showError, hideDialog } = useCustomDialog();

  useEffect(() => {
    loadData();
  }, [selectedTimeRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        globalStatsData,
        recentRecordsData,
        dailyStatsData,
        languageStatsData,
        trendsData
      ] = await Promise.all([
        ProfanityCounterService.getGlobalProfanityStats(),
        ProfanityCounterService.getProfanityRecords(20),
        ProfanityCounterService.getDailyProfanityStats(selectedTimeRange),
        ProfanityCounterService.getLanguageProfanityStats(),
        ProfanityCounterService.getProfanityTrends(selectedTimeRange)
      ]);

      setGlobalStats(globalStatsData);
      setRecentRecords(recentRecordsData.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProfanityRecord)));
      setDailyStats(dailyStatsData as Record<string, unknown>[]);
      setLanguageStats(languageStatsData as Record<string, unknown>[]);
      setTrends(trendsData as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profanity data');
    } finally {
      setLoading(false);
    }
  };

  const resetCounters = async () => {
    showConfirm(
      'Reset All Profanity Counters',
      'Are you sure you want to reset ALL profanity counters? This action cannot be undone.',
      async () => {
        try {
          await ProfanityCounterService.resetAllProfanityCounters();
          await loadData();
          showSuccess('Success', 'Profanity counters reset successfully');
        } catch (err) {
          showError('Failed', 'Failed to reset counters: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
      },
      undefined,
      'Reset Counters',
      'Cancel'
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profanity statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Profanity Monitoring Dashboard</h1>
          <p className="text-gray-600">Monitor and analyze profanity usage across the platform</p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Time Range:</label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(Number(e.target.value))}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <button
            onClick={loadData}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
          >
            Refresh Data
          </button>
          <button
            onClick={resetCounters}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
          >
            Reset All Counters
          </button>
        </div>

        {/* Global Stats Cards */}
        {globalStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Profanity Count</p>
                  <p className="text-2xl font-bold text-gray-900">{globalStats.totalProfanityCount.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Recent Records</p>
                  <p className="text-2xl font-bold text-gray-900">{globalStats.recentRecordsCount.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Languages Detected</p>
                  <p className="text-2xl font-bold text-gray-900">{Object.keys(globalStats.languageStats).length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Contexts Detected</p>
                  <p className="text-2xl font-bold text-gray-900">{Object.keys(globalStats.contextStats).length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Language Statistics */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Profanity by Language</h3>
            </div>
            <div className="p-6">
              {languageStats.length > 0 ? (
                <div className="space-y-4">
                  {languageStats
                    .sort((a, b) => (b as { count: number }).count - (a as { count: number }).count)
                    .slice(0, 10)
                    .map((stat) => (
                      <div key={(stat as { language: string }).language} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-600 capitalize">
                            {(stat as { language: string }).language}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                            <div
                              className="bg-red-600 h-2 rounded-full"
                              style={{
                                width: `${((stat as { count: number }).count / Math.max(...languageStats.map(s => (s as { count: number }).count))) * 100}%`
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{(stat as { count: number }).count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No language data available</p>
              )}
            </div>
          </div>

          {/* Context Statistics */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Profanity by Context</h3>
            </div>
            <div className="p-6">
              {globalStats && Object.keys(globalStats.contextStats).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(globalStats.contextStats)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .map(([context, count]) => (
                      <div key={context} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-600 capitalize">
                            {context.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${(count / Math.max(...Object.values(globalStats.contextStats))) * 100}%`
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No context data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Records */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Profanity Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Context
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Language
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Words Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detected Words
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                      {record.context.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                      {record.language}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.wordCount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex flex-wrap gap-1">
                        {record.detectedWords.slice(0, 3).map((word, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                          >
                            {word}
                          </span>
                        ))}
                        {record.detectedWords.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{record.detectedWords.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
};

export default ProfanityDashboard;
