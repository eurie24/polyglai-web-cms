import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/adminInit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UserData {
  id: string;
  name: string;
  email?: string;
  role: string;
  gender: string;
  age: string | number;
  location: string;
  profession: string;
  createdAt: string;
  lastLogin: string;
  preferredLanguage?: string;
  referralSource?: string;
  status?: string;
}

// Helper function to safely format different date types
function formatDate(date: unknown): string {
  if (!date) return new Date().toISOString();
  
  try {
    // Handle Firestore timestamp
    if (typeof date === 'object' && date !== null && 'toDate' in date && typeof (date as { toDate: () => Date }).toDate === 'function') {
      return (date as { toDate: () => Date }).toDate().toISOString();
    }
    // Handle strings
    else if (typeof date === 'string') {
      return date;
    }
    // Handle Date objects
    else if (date instanceof Date) {
      return date.toISOString();
    }
    // Handle objects with seconds
    else if (typeof date === 'object' && date !== null && '_seconds' in date && typeof (date as { _seconds: number })._seconds === 'number') {
      return new Date((date as { _seconds: number })._seconds * 1000).toISOString();
    }
  } catch (err) {
    console.error('Error formatting date:', err);
  }
  
  return new Date().toISOString();
}

// Helper function to sanitize user data (remove email and sensitive info)
function sanitizeUserData(userData: Record<string, unknown>): UserData {
  const sanitized: UserData = {
    id: (userData.id as string) || '',
    name: (userData.name as string) || (userData.displayName as string) || 'Unnamed User',
    email: (userData.email as string) || '',
    role: (userData.role as string) || 'user',
    gender: (userData.gender as string) || '',
    age: (userData.age as string | number) || '',
    location: (userData.location as string) || '',
    profession: (userData.profession as string) || (userData.userType as string) || '',
    createdAt: formatDate(userData.createdAt),
    lastLogin: formatDate(userData.lastLogin),
    preferredLanguage: (userData.preferredLanguage as string) || '',
    referralSource: (userData.referralSource as string) || '',
    status: (userData.status as string) || 'ACTIVE'
  };


  return sanitized;
}


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'excel';
    const dataType = searchParams.get('type') || 'users';

    console.log(`Exporting ${dataType} data in ${format} format...`);

    // Initialize admin SDK
    const app = await initAdmin();
    const adminDb = getFirestore(app);

    if (dataType === 'users') {
      // Get users data
      const usersSnapshot = await adminDb.collection('users').get();
      console.log(`Found ${usersSnapshot.docs.length} users for export`);

      const users = await Promise.all(usersSnapshot.docs.map(async (doc) => {
        const userId = doc.id;
        const userData = {
          id: userId,
          ...doc.data(),
          email: doc.data().email || '',
          name: doc.data().displayName || doc.data().name || '',
          role: doc.data().role || 'user',
          gender: doc.data().gender || '',
          age: doc.data().age || '',
          location: doc.data().location || '',
          profession: doc.data().userType || doc.data().profession || '',
          createdAt: formatDate(doc.data().createdAt),
          lastLogin: formatDate(doc.data().lastLogin),
          preferredLanguage: doc.data().preferredLanguage || '',
          referralSource: doc.data().referralSource || '',
          status: doc.data().status || 'ACTIVE'
        };

        // Get profile data
        try {
          const profileDoc = await adminDb
            .collection('users')
            .doc(userId)
            .collection('profile')
            .doc('info')
            .get();
            
          if (profileDoc.exists) {
            const profileData = profileDoc.data() as Record<string, unknown>;
            if (profileData.age) userData.age = profileData.age as string | number;
            if (profileData.gender) userData.gender = profileData.gender as string;
            if (profileData.location) userData.location = profileData.location as string;
            if (profileData.name) userData.name = profileData.name as string;
            if (profileData.userType) userData.profession = profileData.userType as string;
            if (profileData.preferredLanguage) userData.preferredLanguage = profileData.preferredLanguage as string;
            if (profileData.referralSource) userData.referralSource = profileData.referralSource as string;
          }
        } catch (err) {
          console.error(`Error getting profile for user ${userId}:`, err);
        }

        // Progress data collection removed since we only export demographics

        return userData;
      }));

      // Filter out admin users and sanitize data
      const sanitizedUsers = users
        .filter(user => {
          // Exclude admin users by checking common admin email patterns
          const email = user.email || '';
          return !email.includes('admin') && !email.includes('polyglai') && email !== '';
        })
        .map(sanitizeUserData);

      console.log(`Exporting ${sanitizedUsers.length} sanitized users`);

      if (format === 'csv') {
        // Generate CSV with only demographics
        const csvData = generateCSV(sanitizedUsers);
        
        return new NextResponse(csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="polyglai_users_${new Date().toISOString().split('T')[0]}.csv"`
          }
        });
      } else {
        // Generate Excel with only demographics
        const excelBuffer = generateExcel(sanitizedUsers);
        
        return new NextResponse(excelBuffer as BodyInit, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="polyglai_users_${new Date().toISOString().split('T')[0]}.xlsx"`
          }
        });
      }
    }

    return NextResponse.json({ error: 'Invalid data type' }, { status: 400 });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function generateCSV(users: UserData[]): string {
  if (users.length === 0) return '';

  // Define CSV headers - only demographics, excluding progress data
  const headers = [
    'User ID',
    'Name',
    'Role',
    'Gender',
    'Age',
    'Location',
    'Profession',
    'Created At',
    'Last Login',
    'Preferred Language',
    'Referral Source',
    'Status'
  ];

  // Generate CSV rows - only demographics
  const rows = users.map(user => {
    return [
      user.id,
      user.name,
      user.role,
      user.gender,
      user.age,
      user.location,
      user.profession,
      user.createdAt,
      user.lastLogin,
      user.preferredLanguage,
      user.referralSource,
      user.status
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function generateExcel(users: UserData[]): Buffer {
  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Main users sheet - only demographics
  const usersData = users.map(user => {
    return {
      'User ID': user.id,
      'Name': user.name,
      'Role': user.role,
      'Gender': user.gender,
      'Age': user.age,
      'Location': user.location,
      'Profession': user.profession,
      'Created At': user.createdAt,
      'Last Login': user.lastLogin,
      'Preferred Language': user.preferredLanguage,
      'Referral Source': user.referralSource,
      'Status': user.status
    };
  });

  const usersSheet = XLSX.utils.json_to_sheet(usersData);
  XLSX.utils.book_append_sheet(workbook, usersSheet, 'Users');

  // Summary statistics sheet - only demographic-based metrics
  const totalUsers = users.length;

  const genderStats = users.reduce((acc, user) => {
    acc[user.gender] = (acc[user.gender] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const locationStats = users.reduce((acc, user) => {
    acc[user.location] = (acc[user.location] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const roleStats = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const languageStats = users.reduce((acc, user) => {
    if (user.preferredLanguage) {
      acc[user.preferredLanguage] = (acc[user.preferredLanguage] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const summaryData = [
    { 'Metric': 'Total Users', 'Value': totalUsers },
    ...Object.entries(genderStats).map(([gender, count]) => ({ 'Metric': `Gender - ${gender}`, 'Value': count })),
    ...Object.entries(locationStats).map(([location, count]) => ({ 'Metric': `Location - ${location}`, 'Value': count })),
    ...Object.entries(roleStats).map(([role, count]) => ({ 'Metric': `Role - ${role}`, 'Value': count })),
    ...Object.entries(languageStats).map(([language, count]) => ({ 'Metric': `Preferred Language - ${language}`, 'Value': count }))
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Convert to buffer
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
