"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [documentNumber, setDocumentNumber] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage("La nueva contrasena y la confirmacion no coinciden.");
      return;
    }

    setMessage("Actualizando...");
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_number: documentNumber,
          new_password: newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.detail || "No se pudo actualizar la contrasena.");
        return;
      }
      setMessage("Contrasena actualizada. Redirigiendo a iniciar sesion...");
      setTimeout(() => router.push("/login"), 1200);
    } catch (error) {
      setMessage("Error de conexion con el backend.");
    }
  };

  return (
    <main className="container">
      <section className="card">
        <h1>Cambiar contrasena</h1>
        <form className="form-grid" onSubmit={onSubmit}>
          <input
            value={documentNumber}
            onChange={(event) => setDocumentNumber(event.target.value)}
            placeholder="Cedula"
            required
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Nueva contrasena"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirmar nueva contrasena"
            required
          />
          <button type="submit" className="btn btn-primary">
            Guardar contrasena
          </button>
        </form>
        {message ? <p className="feedback">{message}</p> : null}
      </section>
    </main>
  );
}
