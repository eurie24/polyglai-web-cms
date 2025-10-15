'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SignInDialog from '../components/SignInDialog';

type Mode = 'user' | 'admin';

type Ctx = {
  open: (mode?: Mode) => void;
  close: () => void;
};

const SignInDialogContext = createContext<Ctx | null>(null);

export function SignInDialogProvider({ children }: { children: React.ReactNode }) {
  const [openState, setOpenState] = useState(false);
  const [mode, setMode] = useState<Mode>('user');
  const searchParams = useSearchParams();

  const open = useCallback((m: Mode = 'user') => {
    setMode(m);
    setOpenState(true);
  }, []);

  const close = useCallback(() => setOpenState(false), []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  // Auto-open from query string ?auth=user|admin
  useEffect(() => {
    const authParam = searchParams.get('auth');
    if (authParam === 'user' || authParam === 'admin') {
      open(authParam);
      // Clean the URL so refresh doesn't keep reopening
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <SignInDialogContext.Provider value={value}>
      {children}
      <SignInDialog isOpen={openState} onClose={close} mode={mode} />
    </SignInDialogContext.Provider>
  );
}

export function useSignInDialog() {
  const ctx = useContext(SignInDialogContext);
  if (!ctx) throw new Error('useSignInDialog must be used within SignInDialogProvider');
  return ctx;
}


