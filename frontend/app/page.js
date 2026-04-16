const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function getHealth() {
  try {
    const response = await fetch(`${API_URL}/health`, { cache: "no-store" });
    if (!response.ok) return "error";
    const data = await response.json();
    return data.status || "ok";
  } catch (error) {
    return "no disponible";
  }
}

export default async function HomePage() {
  const status = await getHealth();

  return (
    <main className="container">
      <section className="card">
        <h1>Banco Simple</h1>
        <p>Proyecto de prueba con FastAPI + Next.js</p>
        <p>
          Estado API: <strong>{status}</strong>
        </p>
        <p>
          Usa la barra superior para crear tu cuenta o iniciar sesion.
        </p>
        <small>API URL: {API_URL}</small>
      </section>
    </main>
  );
}
