import { NextResponse } from 'next/server';
import { initAdmin } from '@/firebase/adminInit';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const envSummary = {
      hasProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
      hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
      projectId: process.env.FIREBASE_PROJECT_ID || null,
      nodeVersion: process.version,
    };

    const app = await initAdmin();
    const apps = getApps().map(a => a.name);
    const db = getFirestore(app);
    // simple check: list collections (will throw if not authorized)
    const collections = await db.listCollections();

    return NextResponse.json({
      ok: true,
      env: envSummary,
      apps,
      collectionsCount: collections.length,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV !== 'production' ? (error as Error)?.stack : undefined,
    }, { status: 500 });
  }
}


