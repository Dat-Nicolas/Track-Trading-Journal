import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrackDailyTrade — Trading Journal & Analytics',
  description:
    'Multi-platform Trading Journal with MT5 Auto-Sync, Deep Analytics, and Trade Replay.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
