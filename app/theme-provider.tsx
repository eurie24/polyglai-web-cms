'use client';

import { useEffect, ReactNode } from 'react';

export default function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Force light mode on all pages
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
    document.body.classList.add('light');
    document.body.classList.remove('dark');
  }, []);
  
  return <>{children}</>;
} 