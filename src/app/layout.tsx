import type { Metadata } from 'next';
import { Sofia_Sans, Geist_Mono } from 'next/font/google';
import { AppProviders } from '@/components/providers/AppProviders';
import './globals.css';

const sofiaSans = Sofia_Sans({
  variable: '--font-sans',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'VIP Agent Workspace',
  description: 'Grounded customer-care co-pilot workspace — Mastercard Theme',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sofiaSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
