import './globals.css';

export const metadata = {
  title: 'Mesa de Galanes',
  description: 'La Cuenta de Mesa de Galanes — Dividí los gastos de la cena',
  openGraph: {
    title: '🍷 Mesa de Galanes',
    description: 'Cargá tus gastos de la cena',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-stone-100 text-stone-900 min-h-screen antialiased">
        <div className="max-w-lg mx-auto min-h-screen">{children}</div>
      </body>
    </html>
  );
}
