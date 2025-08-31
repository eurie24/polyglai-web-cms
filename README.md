# PolyglAI Web CMS

This is the administrative web CMS for the PolyglAI language learning application. It's built with Next.js, TypeScript, and Tailwind CSS, and connects to the same Firebase backend as the Flutter mobile app.

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Firebase project access (same as the Flutter app)

### Installation
1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory with the following content:
```
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBnqpijZa1xc3npOfZAYbnRSInFpyuVk7o
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=polyglai-5591c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=polyglai-5591c
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=polyglai-5591c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=384494047717
NEXT_PUBLIC_FIREBASE_APP_ID=1:384494047717:web:df532a9442d43f64a61f0c
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XE277SYX0R

# Admin Configuration
ADMIN_EMAIL=your-admin-email@example.com
```

3. Run the development server:
```bash
npm run dev
```

## Features

This CMS allows administrators to:
- Manage characters/sentences for each language
- Add phonetics for language learning
- Configure word trainers
- Manage users and their permissions
- View system analytics
- Track user progress

## Connecting to the Flutter App

The CMS connects to the same Firebase backend as the Flutter mobile app. This shared backend architecture ensures that:

1. Changes made in the CMS are immediately reflected in the mobile app
2. User data and progress tracking are synchronized
3. Authentication is consistently managed across platforms

## Technology Stack

- Next.js (React framework)
- TypeScript
- Tailwind CSS
- Firebase (Authentication, Firestore, Storage)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
