import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/src/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body?.userId || '').trim();
    const resolved = Boolean(body?.resolved);
    const adminUser = String(body?.adminUser || '').trim();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: 'Admin not initialized' }, { status: 500 });
    }

    const docRef = db.collection('users').doc(userId).collection('feedback').doc('entry');
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Feedback not found' }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      resolved,
      updatedAt: Timestamp.now(),
    };
    if (resolved) {
      update.resolvedAt = Timestamp.now();
      if (adminUser) update.resolvedBy = adminUser;
    } else {
      update.resolvedAt = null;
      update.resolvedBy = null;
    }

    await docRef.update(update);

    return NextResponse.json({ success: true, userId, resolved });
  } catch (e) {
    console.error('Failed to update feedback resolved status', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}


