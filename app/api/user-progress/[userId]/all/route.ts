import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/adminInit';

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    if (!userId) return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });

    const app = await initAdmin();
    const db = getFirestore(app);

    const langsSnap = await db.collection('users').doc(userId).collection('languages').get();
    const languageIds = langsSnap.docs.map(d => d.id);
    const levelsBase = ['beginner','intermediate','advanced'];

    const result: Record<string, unknown> = {};

    for (const lang of languageIds) {
      const levels = lang.toLowerCase() === 'english' ? levelsBase : ['beginner','intermediate'];
      const assessmentCounts: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0 };
      const itemCounts: Record<string, number> = { beginner: 10, intermediate: 10, advanced: 10 };

      const langDoc = await db.collection('users').doc(userId).collection('languages').doc(lang).get();
      const langData = langDoc.exists ? (langDoc.data() as Record<string, unknown>) : {};

      for (const level of levels) {
        try {
          const levelAssessmentsSnap = await db
            .collection('users').doc(userId)
            .collection('languages').doc(lang)
            .collection('assessmentsByLevel').doc(level)
            .collection('assessments').get();
          levelAssessmentsSnap.forEach(d => {
            const data = d.data() as { score?: number | string };
            const raw = data?.score ?? 0;
            const score = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
            if (!isNaN(score) && score > 0) assessmentCounts[level] = (assessmentCounts[level] || 0) + 1;
          });
        } catch {}

        try {
          // @ts-ignore admin SDK count aggregation
          const countSnap = await db.collection('languages').doc(lang).collection('characters').doc(level).collection('items').count().get();
          const c = (countSnap as unknown as { count?: number }).count ?? (countSnap as any)?._data?.count ?? 0;
          if (c > 0) itemCounts[level] = c;
        } catch {}
      }

      const totalCompleted = (assessmentCounts['beginner'] || 0) + (assessmentCounts['intermediate'] || 0) + (lang.toLowerCase() === 'english' ? (assessmentCounts['advanced'] || 0) : 0);

      result[lang] = {
        points: (langData?.points as number) || 0,
        level: (langData?.level as string) || 'beginner',
        completedAssessments: totalCompleted,
        assessmentCounts,
        itemCounts
      };
    }

    return NextResponse.json({ success: true, progress: result });
  } catch (e) {
    console.error('User all progress error', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}


