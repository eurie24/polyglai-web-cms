import { initAdmin } from '../firebase/adminInit';
import { getFirestore } from 'firebase-admin/firestore';

// Usage:
//  npx ts-node scripts/cleanup_orphaned_assessments.ts [languageId] [level]
// If languageId/level are omitted, scans all languages and levels

async function main() {
  const languageFilter = (process.argv[2] || '').toLowerCase();
  const levelFilter = (process.argv[3] || '').toLowerCase();

  await initAdmin();
  const db = getFirestore();

  const levels = ['beginner', 'intermediate', 'advanced'];

  let deleted = 0;
  let scanned = 0;

  console.log('Starting orphaned assessment cleanup...', { languageFilter, levelFilter });

  // Build a set of valid content values per language/level to check existence quickly
  const validContentByLangLevel: Record<string, Set<string>> = {};

  // Helper: load valid character/word values for a language/level
  async function ensureValidSet(languageId: string, level: string): Promise<Set<string>> {
    const key = `${languageId}|${level}`;
    if (validContentByLangLevel[key]) return validContentByLangLevel[key];

    const set = new Set<string>();

    try {
      const charsSnap = await db
        .collection('languages')
        .doc(languageId)
        .collection('characters')
        .doc(level)
        .collection('items')
        .get();

      charsSnap.docs.forEach(d => {
        const v = (d.get('value') as string) || '';
        if (v) set.add(v);
      });
    } catch {}

    // Word trainer (not level-scoped in current schema)
    if (level === 'beginner') {
      try {
        const wtSnap = await db.collection('wordTrainer').where('languageId', '==', languageId).get();
        wtSnap.docs.forEach(d => {
          const q = (d.get('question') as string) || '';
          if (q) set.add(q);
        });
      } catch {}
    }

    validContentByLangLevel[key] = set;
    return set;
  }

  const usersSnap = await db.collection('users').get();
  for (const user of usersSnap.docs) {
    const userId = user.id;
    const langsSnap = await db.collection('users').doc(userId).collection('languages').get();
    for (const langDoc of langsSnap.docs) {
      const languageId = langDoc.id.toLowerCase();
      if (languageFilter && languageId !== languageFilter) continue;

      for (const lvl of levels) {
        if (levelFilter && lvl !== levelFilter) continue;

        const assessmentsRef = db
          .collection('users').doc(userId)
          .collection('languages').doc(languageId)
          .collection('assessmentsByLevel').doc(lvl)
          .collection('assessments');

        const snap = await assessmentsRef.get();
        if (snap.empty) continue;

        const validSet = await ensureValidSet(languageId, lvl);
        const batch = db.batch();
        let batchCount = 0;

        for (const d of snap.docs) {
          scanned++;
          const data = d.data() as Record<string, unknown>;
          const candidateValues: string[] = [];
          if (typeof data.character === 'string') candidateValues.push(data.character);
          if (typeof data.characterValue === 'string') candidateValues.push(data.characterValue);
          if (typeof data.wordValue === 'string') candidateValues.push(data.wordValue);
          const details = (data.details || {}) as Record<string, any>;
          if (details && details.sentence && typeof details.sentence.target === 'string') {
            candidateValues.push(details.sentence.target);
          }

          const isValid = candidateValues.some(v => v && validSet.has(v));
          if (!isValid) {
            batch.delete(d.ref);
            batchCount++;
            deleted++;
            if (batchCount >= 450) {
              await batch.commit();
              batchCount = 0;
            }
          }
        }

        if (batchCount > 0) await batch.commit();
      }
    }
  }

  console.log('Cleanup finished', { scanned, deleted });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


