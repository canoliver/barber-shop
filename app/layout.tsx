import './globals.css';
import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { QueryProvider } from '@/lib/query-provider';
import { Toaster } from '@/components/ui/sonner';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'BarberPro — Sistema de Gestão para Barbearias',
  description: 'Sistema completo de gestão para barbearias: agendamentos, vendas, estoque, financeiro e mais.',
  openGraph: {
    title: 'BarberPro',
    description: 'Sistema de gestão para barbearias',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${manrope.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <AuthProvider>
          <QueryProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'hsl(222 25% 13%)',
                  border: '1px solid hsl(222 20% 20%)',
                  color: 'hsl(45 30% 95%)',
                },
              }}
            />
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
