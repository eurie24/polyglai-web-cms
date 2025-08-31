import { NextResponse } from 'next/server';
import { initAdmin } from '@/firebase/adminInit';
import { getAuth } from 'firebase-admin/auth';

export async function POST(request: Request) {
  try {
    // Initialize the admin SDK
    const admin = await initAdmin();
    
    // Get the UID from the request body
    const { uid, email } = await request.json();
    
    if (!uid || !email) {
      return NextResponse.json({ success: false, error: 'UID and email are required' }, { status: 400 });
    }

    // Check if the email is the admin email
    const adminEmail = 'polyglAITool@gmail.com';
    if (email.toLowerCase() !== adminEmail.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'User is not an admin' }, { status: 403 });
    }

    // Set the admin custom claim
    await getAuth(admin).setCustomUserClaims(uid, { admin: true });
    
    console.log(`Admin claim set for user ${uid} with email ${email}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Admin claim set successfully' 
    });
  } catch (error) {
    console.error('Error setting admin claim:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set admin claim' }, 
      { status: 500 }
    );
  }
} 