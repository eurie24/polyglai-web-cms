import { initAdmin } from '../firebase/adminInit';
import { getFirestore, CollectionReference, DocumentData } from 'firebase-admin/firestore';

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: ts-node scripts/find_redundant_assessments.ts <USER_ID>');
    process.exit(1);
  }

  await initAdmin();
  const db = getFirestore();

  // Helper to normalize target keys to detect duplicates across structures
  const normalize = (s: unknown): string => String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u00C0-\u024F\u4E00-\u9FFF\u3040-\u30FF\u3130-\u318F\uAC00-\uD7AF]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);

  const levels = ['beginner', 'intermediate', 'advanced'];
  const languagesSnap = await db.collection('users').doc(userId).collection('languages').get();

  const duplicates: Array<{ language: string; level?: string; docId: string; reason: string }> = [];
  const counts: Record<string, number> = {};
  const keysSeen: Record<string, { path: string; id: string }[]> = {};

  for (const lang of languagesSnap.docs) {
    const languageId = lang.id.toLowerCase();

    // New structure: assessmentsByLevel/<level>/assessments
    for (const level of levels) {
      const ref: CollectionReference<DocumentData> = db
        .collection('users').doc(userId)
        .collection('languages').doc(languageId)
        .collection('assessmentsByLevel').doc(level)
        .collection('assessments');

      const snap = await ref.get();
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const keyCandidates = [data.normalizedTarget, data.character, data.targetText, data.refText, (data.sentence as any)?.target, d.id];
        const key = normalize(keyCandidates.find(v => typeof v === 'string' && v) as string);
        const score = typeof data.score === 'number' ? data.score : (typeof data.score === 'string' ? parseInt(data.score, 10) : 0);
        const bucket = `${languageId}|${key}|${level}`;
        counts[bucket] = (counts[bucket] || 0) + 1;
        if (!keysSeen[bucket]) keysSeen[bucket] = [];
        keysSeen[bucket].push({ path: `languages/${languageId}/assessmentsByLevel/${level}/assessments`, id: d.id });
        if (counts[bucket] > 1) {
          duplicates.push({ language: languageId, level, docId: d.id, reason: 'Duplicate within new structure' });
        }
      }
    }

    // Legacy structure: assessmentsData
    const legacyRef: CollectionReference<DocumentData> = db
      .collection('users').doc(userId)
      .collection('languages').doc(languageId)
      .collection('assessmentsData');
    try {
      const legacySnap = await legacyRef.get();
      for (const d of legacySnap.docs) {
        const data = d.data() as Record<string, unknown>;
        const keyCandidates = [data.normalizedTarget, data.character, data.targetText, data.refText, (data.sentence as any)?.target, d.id];
        const key = normalize(keyCandidates.find(v => typeof v === 'string' && v) as string);
        const level = typeof data.level === 'string' ? data.level.toLowerCase() : 'beginner';
        const bucket = `${languageId}|${key}|${level}`;
        // Mark cross-structure duplicates
        if (keysSeen[bucket]) {
          duplicates.push({ language: languageId, level, docId: d.id, reason: 'Duplicate across legacy and new structures' });
        }
        if (!keysSeen[bucket]) keysSeen[bucket] = [];
        keysSeen[bucket].push({ path: `languages/${languageId}/assessmentsData`, id: d.id });
      }
    } catch {}
  }

  // Report
  if (duplicates.length === 0) {
    console.log('No redundant assessment documents found.');
  } else {
    console.log(`Found ${duplicates.length} redundant assessment documents:`);
    duplicates.forEach((dup, idx) => {
      console.log(`${idx + 1}. language=${dup.language} level=${dup.level || ''} id=${dup.docId} reason=${dup.reason}`);
    });
    // Also print groups with more than one entry
    console.log('\nGroups with duplicates:');
    Object.entries(keysSeen).forEach(([bucket, entries]) => {
      if (entries.length > 1) {
        console.log(`- ${bucket}`);
        entries.forEach(e => console.log(`  • ${e.path}/${e.id}`));
      }
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


