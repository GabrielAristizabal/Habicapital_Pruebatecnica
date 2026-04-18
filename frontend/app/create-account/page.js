"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function CreateAccountPage() {
  const [form, setForm] = useState({
    full_name: "",
    document_number: "",
    email: "",
    phone: "",
    password: "",
    initial_balance: "0",
    account_type: "SAVINGS",
    currency_code: "USD",
  });
  const [message, setMessage] = useState("");

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage("Procesando...");
    try {
      const response = await fetch(`${API_URL}/api/v1/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          initial_balance: Number(form.initial_balance),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.detail || "No fue posible crear la cuenta.");
        return;
      }
      setMessage(
        `Cuenta creada. Numero asignado: ${data.accountNumber}. Titular: ${data.fullName}`
      );
    } catch (error) {
      setMessage("Error de conexion con el backend.");
    }
  };

  return (
    <main className="container">
      <section className="card">
        <h1>Crear cuenta</h1>
        <form className="form-grid" onSubmit={onSubmit}>
          <input name="full_name" placeholder="Nombre completo" onChange={onChange} required />
          <input
            name="document_number"
            placeholder="Cedula"
            onChange={onChange}
            required
          />
          <input name="email" type="email" placeholder="Correo" onChange={onChange} required />
          <input name="phone" placeholder="Celular" onChange={onChange} required />
          <input
            name="initial_balance"
            type="number"
            min="0"
            step="0.01"
            placeholder="Saldo inicial"
            onChange={onChange}
            required
          />
          <select name="account_type" onChange={onChange} value={form.account_type}>
            <option value="SAVINGS">SAVINGS</option>
            <option value="CHECKING">CHECKING</option>
          </select>
          <select name="currency_code" onChange={onChange} value={form.currency_code}>
            <option value="USD">USD</option>
            <option value="COP">COP</option>
          </select>
          <input
            name="password"
            type="password"
            placeholder="Contrasena"
            onChange={onChange}
            required
          />
          <button type="submit" className="btn btn-primary">
            Crear cuenta
          </button>
        </form>
        {message ? <p className="feedback">{message}</p> : null}
      </section>
    </main>
  );
}
