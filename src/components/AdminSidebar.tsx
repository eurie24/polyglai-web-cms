'use client';

import Link from 'next/link';
import React from 'react';
import Image from 'next/image';

type AdminSidebarProps = {
  active?: 'dashboard' | 'languages' | 'word-trainer' | 'users' | 'feedbacks';
  className?: string;
};

export default function AdminSidebar({ active, className }: AdminSidebarProps) {
  const item = (href: string, label: string, icon: React.ReactElement, key: AdminSidebarProps['active']) => (
    <Link
      href={href}
      className={`flex items-center px-4 py-3 rounded-md text-white hover:bg-[#29B6F6]/20 ${active === key ? 'bg-[#29B6F6]/20' : ''}`}
    >
      {icon}
      <span className="ml-3">{label}</span>
    </Link>
  );

  return (
    <div className={`w-64 h-screen sticky top-0 bg-[#0277BD] shadow-md text-white shrink-0 overflow-hidden ${className || ''}`}>
      <div className="p-6 border-b border-[#29B6F6]/30">
        <Link href="/dashboard" aria-label="Go to Dashboard">
          <Image src="/logo_txt.png" alt="PolyglAI" width={140} height={45} className="h-10 w-auto cursor-pointer" />
        </Link>
      </div>
      <nav className="mt-6">
        <div className="px-4 space-y-1">
          {item('/dashboard', 'Dashboard', (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"/></svg>
          ), 'dashboard')}
          {item('/dashboard/languages', 'Language Management', (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          ), 'languages')}
          {item('/dashboard/word-trainer', 'Word Trainer', (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
          ), 'word-trainer')}
          {item('/dashboard/users', 'Users', (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          ), 'users')}
                {item('/dashboard/feedbacks', 'Feedbacks', (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                ), 'feedbacks')}
        </div>
      </nav>
    </div>
  );
}


