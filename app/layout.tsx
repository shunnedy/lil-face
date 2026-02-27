import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MeiTu Retouch — Advanced Web Retoucher',
  description: 'ポートレート・グラビア特化の高精度ブラウザレタッチツール',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
