'use client';

import { useEffect, useMemo, useState } from 'react';
// import Link from 'next/link';
// import Image from 'next/image';
import AdminSidebar from '../../../src/components/AdminSidebar';
import AdminProtection from '../../../src/components/AdminProtection';

type Feedback = {
  id: string;
  userId: string;
  email?: string;
  isAnonymous?: boolean;
  rating: number;
  category: string;
  text: string;
  createdAt?: { _seconds?: number; seconds?: number } | { seconds?: number } | null;
  resolved?: boolean;
  resolvedAt?: { _seconds?: number; seconds?: number } | { seconds?: number } | null;
  resolvedBy?: string | null;
};

function formatDate(seconds?: number) {
  if (!seconds) return '-';
  try {
    return new Date(seconds * 1000).toLocaleString();
  } catch {
    return '-';
  }
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i < value ? 'text-amber-500' : 'text-gray-300'}`}
          fill={i < value ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.73-2.727a.563.563 0 00-.568 0l-4.73 2.727a.562.562 0 01-.84-.61l1.285-5.385a.563.563 0 00-.182-.557L2.04 10.385a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L10.48 3.5z" />
        </svg>
      ))}
    </div>
  );
}

export default function FeedbacksPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | string>('All');
  const [status, setStatus] = useState<'All' | 'Resolved' | 'Pending'>('All');
  const [sortBy, setSortBy] = useState<'Newest' | 'Oldest' | 'RatingHigh' | 'RatingLow'>('Newest');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/feedback/list', { cache: 'no-store' });
        const json = await res.json();
        if (json && json.success && Array.isArray(json.items)) {
          setItems(json.items);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.category)))], [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = items.filter(i => {
      if (category !== 'All' && i.category !== category) return false;
      if (status !== 'All') {
        const isResolved = Boolean(i.resolved);
        if (status === 'Resolved' && !isResolved) return false;
        if (status === 'Pending' && isResolved) return false;
      }
      if (!q) return true;
      return (
        (i.email || '').toLowerCase().includes(q) ||
        (i.userId || '').toLowerCase().includes(q) ||
        (i.text || '').toLowerCase().includes(q)
      );
    });
    const sorted = [...base].sort((a, b) => {
      const aSec = (a as { createdAt?: { seconds?: number; _seconds?: number } }).createdAt?.seconds || (a as { createdAt?: { _seconds?: number } }).createdAt?._seconds || 0;
      const bSec = (b as { createdAt?: { seconds?: number; _seconds?: number } }).createdAt?.seconds || (b as { createdAt?: { _seconds?: number } }).createdAt?._seconds || 0;
      switch (sortBy) {
        case 'Newest':
          return bSec - aSec;
        case 'Oldest':
          return aSec - bSec;
        case 'RatingHigh':
          return (b.rating || 0) - (a.rating || 0);
        case 'RatingLow':
          return (a.rating || 0) - (b.rating || 0);
        default:
          return 0;
      }
    });
    return sorted;
  }, [items, query, category, status, sortBy]);

  const toggleResolved = async (userId: string, resolved: boolean) => {
    try {
      const res = await fetch('/api/feedback/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, resolved }),
      });
      const json = await res.json();
      if (json?.success) {
        setItems(prev => prev.map(i => i.userId === userId ? { ...i, resolved, resolvedAt: resolved ? { seconds: Math.floor(Date.now()/1000) } as { seconds: number } : null } : i));
      }
    } catch {
      // noop
    }
  };

  return (
    <AdminProtection>
      <div className="flex min-h-screen bg-gray-50">
        {/* Mobile menu backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/10 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <AdminSidebar active="feedbacks" />

        {/* Main Content */}
        <div className="flex-1 bg-gradient-to-br from-[#0277BD]/10 to-[#29B6F6]/5 min-w-0">
          {/* Content */}
          <div className="px-4 py-6 lg:px-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-2xl font-bold text-[#0277BD]">User Feedback</h1>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search email, user, text..."
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent text-sm"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'All' | 'Resolved' | 'Pending')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {['All','Resolved','Pending'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'Newest' | 'Oldest' | 'RatingHigh' | 'RatingLow')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {['Newest','Oldest','RatingHigh','RatingLow'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-gray-700">Loading feedback…</div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[#0277BD]/10 text-[#0277BD] sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">Date</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">User</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">Rating</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">Category</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide w-[50%]">Feedback</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">Status</th>
                        <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((f, idx) => {
                        const s = (f as { createdAt?: { seconds?: number; _seconds?: number } }).createdAt?.seconds || (f as { createdAt?: { _seconds?: number } }).createdAt?._seconds || undefined;
                        return (
                          <tr key={f.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(s)}</td>
                            <td className="px-4 py-3 text-gray-800 max-w-xs truncate" title={f.isAnonymous ? 'Anonymous' : (f.email || f.userId)}>{f.isAnonymous ? 'Anonymous' : (f.email || f.userId)}</td>
                            <td className="px-4 py-3"><Stars value={Math.max(0, Math.min(5, f.rating))} /></td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#29B6F6]/15 text-[#0277BD]">
                                {f.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-800 align-top">
                              <div className="max-w-4xl whitespace-pre-wrap break-words leading-6">{f.text}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {f.resolved ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Resolved</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Pending</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {f.resolved ? (
                                  <button
                                    onClick={() => toggleResolved(f.userId, false)}
                                    className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                                  >
                                    Mark Pending
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => toggleResolved(f.userId, true)}
                                    className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700"
                                  >
                                    Mark Resolved
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-gray-500">No feedback found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminProtection>
  );
}


