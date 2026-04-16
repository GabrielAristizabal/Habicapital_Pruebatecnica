import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Habicapital Frontend",
  description: "Frontend web con Next.js conectado a FastAPI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">
              Banco Simple
            </Link>
            <nav className="topbar-actions">
              <Link href="/create-account" className="btn btn-secondary">
                Crear cuenta
              </Link>
              <Link href="/login" className="btn btn-primary">
                Iniciar sesion
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
