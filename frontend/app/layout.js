import "./globals.css";

export const metadata = {
  title: "Habicapital Frontend",
  description: "Frontend web con Next.js conectado a FastAPI",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
