'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UserProgress {
  [languageName: string]: {
    points: number;
    level: string;
    assessments: unknown[];
    assessmentsByLevel: Record<string, unknown>;
    assessmentCount: number;
    wordAssessment: number;
    completedAssessments: number;
  };
}

interface UseUserProgressReturn {
  progress: UserProgress | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Cache for user progress data
const progressCache = new Map<string, { data: UserProgress; timestamp: number }>();
const PROGRESS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const useUserProgress = (userId: string | null): UseUserProgressReturn => {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProgress = useCallback(async (useCache = true) => {
    if (!userId) {
      setProgress(null);
      return;
    }

    try {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setLoading(true);
      setError(null);

      // Check cache first
      if (useCache) {
        const cached = progressCache.get(`user-progress-${userId}`);
        if (cached && Date.now() - cached.timestamp < PROGRESS_CACHE_DURATION) {
          console.log(`Using cached progress data for user ${userId}`);
          setProgress(cached.data);
          setLoading(false);
          return;
        }
      }

      const response = await fetch(`/api/user-progress/${userId}`, {
        signal,
        headers: {
          'Cache-Control': 'max-age=600', // 10 minutes
        },
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }

      const data = await response.json() as { success: boolean; progress: UserProgress };

      if (data.success) {
        console.log(`Loaded progress data for user ${userId}`);
        
        setProgress(data.progress);
        
        // Cache the results
        progressCache.set(`user-progress-${userId}`, { 
          data: data.progress, 
          timestamp: Date.now() 
        });
      } else {
        throw new Error(data.error || 'API returned unsuccessful response');
      }

      setLoading(false);
    } catch (err: unknown) {
      if (err.name === 'AbortError') {
        return; // Request was cancelled
      }
      
      console.error(`Error fetching progress for user ${userId}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user progress');
      setLoading(false);
    }
  }, [userId]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    
    // Clear cache and fetch fresh data
    progressCache.delete(`user-progress-${userId}`);
    await fetchProgress(false);
  }, [userId, fetchProgress]);

  useEffect(() => {
    fetchProgress();

    // Cleanup function to cancel pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchProgress]);

  return {
    progress,
    loading,
    error,
    refetch,
  };
};
