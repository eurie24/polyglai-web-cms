import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PolyglAI - Language Learning Admin",
  description: "Administration portal for PolyglAI language learning platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        {/* Google Sign-In Client ID */}
        <meta name="google-signin-client_id" content="384494047717-mbt8equ74qv39lgi6m5p9j1iffer0r1m.apps.googleusercontent.com" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} antialiased light bg-gray-50`}
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
