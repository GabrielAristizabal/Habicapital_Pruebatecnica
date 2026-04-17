"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function HomePage() {
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Recarga de saldo");
  const [message, setMessage] = useState("");

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("Procesando carga de saldo...");
    try {
      const response = await fetch(`${API_URL}/api/v1/accounts/top-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_number: accountNumber,
          amount: Number(amount),
          description,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.detail || "No fue posible cargar saldo.");
        return;
      }
      setMessage(
        `Saldo actualizado. Nuevo saldo: ${data.currencyCode} ${data.availableBalance}`
      );
      setAmount("");
    } catch (error) {
      setMessage("Error de conexion con el backend.");
    }
  };

  return (
    <main className="container">
      <section className="card">
        <h1>Cargar saldo</h1>
        <p>Simulador de carga manual a una cuenta.</p>
        <form className="form-grid" onSubmit={onSubmit}>
          <input
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
            placeholder="Numero de cuenta"
            required
          />
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Cantidad de dinero"
            required
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descripcion"
          />
          <button type="submit" className="btn btn-primary">
            Cargar saldo
          </button>
        </form>
        {message ? <p className="feedback">{message}</p> : null}
      </section>
    </main>
  );
}
