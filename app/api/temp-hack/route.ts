import { NextResponse } from 'next/server';

// This is a temporary solution to bypass Firebase permissions issues
// A proper solution would involve setting up Firebase Admin SDK with a service account
export async function GET() {
  // Return hardcoded user data to demonstrate the UI
  const users = [
    {
      id: 'sample-user-1',
      name: 'Sample User',
      email: 'sample@example.com',
      role: 'user',
      gender: 'Male',
      age: 30,
      location: 'Sample Location',
      profession: 'Developer',
      createdAt: '2025-05-19T19:01:04.328Z',
      lastLogin: '2025-05-19T19:01:04.328Z'
    },
    {
      id: '4fYiosMKA0U49ITZVdcAumyCtH33',
      name: 'Real User 1',
      email: 'user1@polyglai.app',
      role: 'user',
      gender: 'Male',
      age: 28,
      location: 'Manila',
      profession: 'Student',
      createdAt: '2025-01-15T14:22:11.000Z'
    },
    {
      id: 'F7qUbUeUnKNV3LxRkjNNyMtM8J62',
      name: 'Real User 2',
      email: 'user2@polyglai.app',
      role: 'user',
      gender: 'Female',
      age: 32,
      location: 'Cebu',
      profession: 'Teacher',
      createdAt: '2025-02-23T09:15:33.000Z'
    },
    {
      id: 'jA4Sdb1O7aX8FVry3IoHNKuS4ob2',
      name: 'Real User 3',
      email: 'user3@polyglai.app',
      role: 'user',
      gender: 'Male',
      age: 25,
      location: 'Davao',
      profession: 'Engineer',
      createdAt: '2025-03-10T16:45:22.000Z'
    }
  ];

  // Return the hardcoded data
  return NextResponse.json({ 
    success: true, 
    users: users,
    count: users.length,
    note: "This is hardcoded data to demonstrate the UI while Firebase permissions are being resolved"
  });
} 