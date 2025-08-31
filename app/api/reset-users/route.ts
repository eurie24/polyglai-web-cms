import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Mock user reset functionality has been removed',
    results: []
  });
} 