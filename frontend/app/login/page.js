"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function LoginPage() {
  const router = useRouter();
  const [documentNumber, setDocumentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("Validando...");
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_number: documentNumber,
          password,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.detail || "Credenciales invalidas.");
        return;
      }
      localStorage.setItem("access_token", data.accessToken);
      localStorage.setItem("user_name", data.user.fullName);
      router.push("/dashboard");
    } catch (error) {
      setMessage("Error de conexion con el backend.");
    }
  };

  return (
    <main className="container">
      <section className="card">
        <h1>Iniciar sesion</h1>
        <form className="form-grid" onSubmit={onSubmit}>
          <input
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            placeholder="Cedula"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contrasena"
            required
          />
          <button type="submit" className="btn btn-primary">
            Entrar
          </button>
        </form>
        <div className="helper-row">
          <Link href="/reset-password" className="text-link">
            Olvidaste tu contrasena?
          </Link>
        </div>
        {message ? <p className="feedback">{message}</p> : null}
      </section>
    </main>
  );
}
