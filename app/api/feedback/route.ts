import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/src/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rating = Number(body?.rating ?? 0);
    const category = String(body?.category ?? 'General');
    const email = body?.email ? String(body.email) : '';
    const isAnonymous = Boolean(body?.isAnonymous);
    const text = String(body?.text ?? '');
    const userId = String(body?.userId ?? 'anonymous');

    if (!text.trim()) {
      return NextResponse.json({ success: false, error: 'Feedback text required' }, { status: 400 });
    }
    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'Invalid rating' }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Admin not initialized' }, { status: 500 });
    }
    // New canonical path: users/{uid}/feedback/entry
    const docRef = db.collection('users').doc(userId).collection('feedback').doc('entry');
    const snap = await docRef.get();
    if (snap.exists) {
      await docRef.update({
        userId,
        email: isAnonymous ? '' : email,
        isAnonymous,
        rating,
        category,
        text,
        updatedAt: Timestamp.now(),
        userAgent: req.headers.get('user-agent') || '',
        // Any user edit should re-open the feedback for admin review
        resolved: false,
        resolvedAt: null,
        resolvedBy: null,
      });
      return NextResponse.json({ success: true, id: 'entry', updated: true });
    } else {
      await docRef.set({
        userId,
        email: isAnonymous ? '' : email,
        isAnonymous,
        rating,
        category,
        text,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        userAgent: req.headers.get('user-agent') || '',
        resolved: false,
        resolvedAt: null,
        resolvedBy: null,
      });
      return NextResponse.json({ success: true, id: 'entry', created: true });
    }
  } catch (e) {
    console.error('Failed to save feedback', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Admin not initialized' }, { status: 500 });
    }
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '';
    const email = searchParams.get('email') || '';
    if (!userId && !email) {
      return NextResponse.json({ success: false, error: 'userId or email required' }, { status: 400 });
    }
    if (userId) {
      const snap = await db.collection('users').doc(userId).collection('feedback').doc('entry').get();
      if (snap.exists) {
        return NextResponse.json({ success: true, item: { id: 'entry', ...snap.data() } });
      }
      return NextResponse.json({ success: true, item: null });
    }
    // Fallback by email: find user by email if needed (optional; keeping simple -> null)
    return NextResponse.json({ success: true, item: null });
  } catch (e) {
    console.error('Failed to fetch feedback', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}


