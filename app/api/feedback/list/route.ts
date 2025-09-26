import { NextResponse } from 'next/server';
import { getAdminDb } from '@/src/lib/firebase-admin';

export async function GET() {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Admin not initialized' }, { status: 500 });
    }
    // Use collection group query to list all user feedbacks under users/*/feedback
    // Some legacy docs may miss createdAt; avoid orderBy to prevent errors
    const snap = await db.collectionGroup('feedback').limit(500).get();
    const items = snap.docs.map(d => {
      const data = d.data();
      // Try to parse userId from document path: users/{uid}/feedback/entry
      const path = d.ref.path; // e.g., users/UID/feedback/entry
      const parts = path.split('/');
      const userId = parts.length >= 2 ? parts[1] : (data.userId || '');
      // Ensure unique id per user to avoid duplicate 'entry' keys on the client
      const id = `${userId}_entry`;
      return ({ id, userId, ...data });
    });
    return NextResponse.json({ success: true, items });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to list feedback', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}


