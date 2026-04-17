"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const FILTER_OPTIONS = [
  { value: "all", label: "Todos los tiempos" },
  { value: "30d", label: "Ultimos 30 dias" },
  { value: "15d", label: "Ultimos 15 dias" },
];

export default function DashboardPage() {
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [rangeType, setRangeType] = useState("all");
  const [showFullAccountNumber, setShowFullAccountNumber] = useState(false);
  const [message, setMessage] = useState("");

  const documentNumber =
    typeof window !== "undefined" ? localStorage.getItem("document_number") : null;

  useEffect(() => {
    if (!documentNumber) {
      setMessage("No hay sesion activa. Inicia sesion primero.");
      return;
    }

    const loadAccountSummary = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/v1/accounts/summary?document_number=${documentNumber}`
        );
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.detail || "No se pudo cargar el saldo.");
          return;
        }
        setAccount(data);
      } catch (error) {
        setMessage("No se pudo conectar con el backend.");
      }
    };

    loadAccountSummary();
  }, [documentNumber]);

  useEffect(() => {
    if (!documentNumber) return;

    const loadHistory = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/v1/transactions/history?document_number=${documentNumber}&range_type=${rangeType}`
        );
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.detail || "No se pudo cargar el historial.");
          return;
        }
        setHistory(data.items || []);
      } catch (error) {
        setMessage("No se pudo cargar el historial.");
      }
    };

    loadHistory();
  }, [documentNumber, rangeType]);

  const balanceLabel = useMemo(() => {
    if (!account) return "-";
    return `${account.currencyCode} ${account.availableBalance}`;
  }, [account]);

  const accountNumberToShow = useMemo(() => {
    if (!account) return "-";
    if (showFullAccountNumber) {
      return (
        account.accountNumber ||
        (typeof window !== "undefined" ? localStorage.getItem("full_account_number") : null) ||
        account.maskedAccountNumber
      );
    }
    return account.maskedAccountNumber;
  }, [account, showFullAccountNumber]);

  return (
    <main className="dashboard-container">
      <section className="dashboard-grid">
        <article className="panel panel-balance">
          <h2>Saldo</h2>
          <p className="muted">
            Moneda: <strong>{account?.currencyCode || "-"}</strong>
          </p>
          <p className="balance-number">{balanceLabel}</p>
          <p className="muted">Cuenta: {accountNumberToShow}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowFullAccountNumber((prev) => !prev)}
          >
            {showFullAccountNumber ? "Ocultar numero completo" : "Revelar numero completo"}
          </button>
        </article>

        <article className="panel panel-transfer">
          <h2>Transferir</h2>
          <p className="muted">Seccion en construccion.</p>
        </article>

        <article className="panel panel-history">
          <div className="history-header">
            <h2>Historial de transacciones</h2>
            <select value={rangeType} onChange={(event) => setRangeType(event.target.value)}>
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {history.length === 0 ? (
            <p className="muted">No hay transacciones para este filtro.</p>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <div key={`${item.date}-${item.targetAccount}-${item.amount}`} className="history-item">
                  <span>{new Date(item.date).toLocaleDateString("es-CO")}</span>
                  <span>Cuenta destino: {item.targetAccount}</span>
                  <span>Descripcion: {item.description}</span>
                  <strong>{item.amount}</strong>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
      {message ? <p className="feedback">{message}</p> : null}
    </main>
  );
}
