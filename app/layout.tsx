import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { I18nProvider } from '@/components/I18nProvider';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Liquid Fast Download',
  description: 'Motor avanzado de rastreo, extracción y descarga para Manga, Video e Imágenes.',
  openGraph: {
    title: 'Liquid Fast Download',
    description: 'Motor avanzado de rastreo, extracción y descarga para Manga, Video e Imágenes.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Liquid Fast Download',
    description: 'Motor avanzado de rastreo, extracción y descarga para Manga, Video e Imágenes.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('liquid_theme') || 'dark';
                document.documentElement.setAttribute('data-theme', t);
                document.documentElement.classList.toggle('light', t === 'light');
                document.documentElement.classList.toggle('dark', t === 'dark');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <I18nProvider>
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

