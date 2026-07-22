import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexio Commerce - لوحة تحكم التاجر',
  description: 'منصة التجارة الإلكترونية متعددة المستأجرين لإدارة المتاجر والمخزون',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased selection:bg-indigo-500 selection:text-white bg-slate-50">
        {children}
      </body>
    </html>
  );
}
