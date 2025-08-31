'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type User = {
  id: string;
  name?: string;
  email?: string;
  location?: string;
  profession?: string;
  gender?: string;
  age?: number | string;
  createdAt?: string;
  lastLogin?: string;
  profileImage?: string;
  languages?: string[];
  progress?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  totalPoints?: number;
  featuresUsage?: {
    translator?: number;
    fileTranslator?: number;
    cameraTranslator?: number;
    wordAssessment?: number;
    [key: string]: number | undefined;
  };
  updatedAt?: string;
  preferredLanguage?: string;
  referralSource?: string;
};

interface UseUsersDataReturn {
  users: User[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  debugInfo: string;
}

// Simple in-memory cache
const cache = new Map<string, { data: User[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useUsersData = (): UseUsersDataReturn => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchUsers = useCallback(async (useCache = true) => {
    try {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setLoading(true);
      setError(null);
      setDebugInfo('Fetching users data...');

      // Check cache first
      if (useCache) {
        const cached = cache.get('users-data');
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log('Using cached users data');
          setUsers(cached.data);
          setDebugInfo(`Loaded ${cached.data.length} users from cache`);
          setLoading(false);
          return;
        }
      }

      // Try optimized API first
      try {
        const response = await fetch('/api/users-optimized', {
          signal,
          headers: {
            'Cache-Control': 'max-age=300', // 5 minutes
          },
        });

        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }

        const data = await response.json() as { success: boolean; users: User[]; cached: boolean; source: string };

        if (data.success && data.users) {
          console.log(`Optimized API returned ${data.users.length} users`);
          
          setUsers(data.users);
          setDebugInfo(`Loaded ${data.users.length} users from optimized API (${data.cached ? 'cached' : 'fresh'})`);
          
          // Cache the results
          cache.set('users-data', { data: data.users, timestamp: Date.now() });
          
          setLoading(false);
          return;
        } else {
          throw new Error('API returned unsuccessful response');
        }
      } catch (apiError: unknown) {
        if (apiError instanceof Error && apiError.name === 'AbortError') {
          return; // Request was cancelled
        }
        
        console.error("Error fetching from optimized API:", apiError);
        setDebugInfo(`Optimized API Error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}. Trying fallback...`);
        
        // Fallback to original API
        const fallbackResponse = await fetch('/api/users', {
          signal,
          headers: {
            'Cache-Control': 'max-age=300',
          },
        });

        if (!fallbackResponse.ok) {
          throw new Error(`Fallback API responded with status ${fallbackResponse.status}`);
        }

        const fallbackData = await fallbackResponse.json() as { success: boolean; users: User[] };

        if (fallbackData.success && fallbackData.users) {
          console.log(`Fallback API returned ${fallbackData.users.length} users`);
          
          setUsers(fallbackData.users);
          setDebugInfo(`Loaded ${fallbackData.users.length} users from fallback API`);
          
          // Cache the results
          cache.set('users-data', { data: fallbackData.users, timestamp: Date.now() });
        } else {
          throw new Error('Fallback API returned unsuccessful response');
        }
      }

      setLoading(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Request was cancelled
      }
      
      console.error('Error in fetchUsers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      setDebugInfo(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    // Clear cache and fetch fresh data
    cache.delete('users-data');
    await fetchUsers(false);
  }, [fetchUsers]);

  useEffect(() => {
    fetchUsers();

    // Cleanup function to cancel pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    refetch,
    debugInfo,
  };
};
