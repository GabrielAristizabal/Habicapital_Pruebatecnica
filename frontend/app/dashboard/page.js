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
  const [targetAccount, setTargetAccount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [transferPassword, setTransferPassword] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const userName = localStorage.getItem("user_name");
    if (!transferDescription && userName) {
      setTransferDescription(`Transferencia de ${userName}`);
    }
  }, [transferDescription]);

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

  const refreshDashboardData = async () => {
    if (!documentNumber) return;
    const [summaryResponse, historyResponse] = await Promise.all([
      fetch(`${API_URL}/api/v1/accounts/summary?document_number=${documentNumber}`),
      fetch(
        `${API_URL}/api/v1/transactions/history?document_number=${documentNumber}&range_type=${rangeType}`
      ),
    ]);
    const summaryData = await summaryResponse.json();
    const historyData = await historyResponse.json();
    if (summaryResponse.ok) setAccount(summaryData);
    if (historyResponse.ok) setHistory(historyData.items || []);
  };

  const hashText = async (text) => {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const signPayload = async (values, secret) => {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(values.join("|"))
    );
    return Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const onTransferSubmit = async (event) => {
    event.preventDefault();
    if (!documentNumber) {
      setTransferMessage("No hay sesion activa.");
      return;
    }
    if (!targetAccount || !transferAmount || !transferPassword) {
      setTransferMessage("Completa cuenta, monto y contrasena.");
      return;
    }

    try {
      setTransferMessage("Iniciando handshake de seguridad...");
      const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const amountString = Number(transferAmount).toString();
      const passwordDigest = await hashText(transferPassword);
      const initSignature = await signPayload(
        [documentNumber, targetAccount, amountString, transferDescription, nonce],
        passwordDigest
      );

      const initResponse = await fetch(`${API_URL}/api/v1/transfers/handshake/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_number: documentNumber,
          target_account_number: targetAccount,
          amount: Number(transferAmount),
          description: transferDescription,
          nonce,
          client_signature: initSignature,
        }),
      });
      const initData = await initResponse.json();
      if (!initResponse.ok) {
        setTransferMessage(initData.detail || "No fue posible iniciar la transferencia.");
        return;
      }

      const finalSignature = await signPayload(
        [initData.handshakeId, initData.challengeNonce, "EXECUTE"],
        passwordDigest
      );
      const executeResponse = await fetch(`${API_URL}/api/v1/transfers/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handshake_id: initData.handshakeId,
          document_number: documentNumber,
          challenge_nonce: initData.challengeNonce,
          client_final_signature: finalSignature,
        }),
      });
      const executeData = await executeResponse.json();
      if (!executeResponse.ok) {
        setTransferMessage(executeData.detail || "No fue posible ejecutar la transferencia.");
        return;
      }

      setTransferMessage("Transferencia realizada correctamente.");
      setTransferAmount("");
      setTargetAccount("");
      setTransferPassword("");
      await refreshDashboardData();
    } catch (error) {
      setTransferMessage("Error de conexion durante la transferencia.");
    }
  };

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
          <form className="form-grid" onSubmit={onTransferSubmit}>
            <input
              value={targetAccount}
              onChange={(event) => setTargetAccount(event.target.value)}
              placeholder="Cuenta objetivo"
              required
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={transferAmount}
              onChange={(event) => setTransferAmount(event.target.value)}
              placeholder="Monto a transferir"
              required
            />
            <input
              value={transferDescription}
              onChange={(event) => setTransferDescription(event.target.value)}
              placeholder="Descripcion"
              required
            />
            <input
              type="password"
              value={transferPassword}
              onChange={(event) => setTransferPassword(event.target.value)}
              placeholder="Contrasena de confirmacion"
              required
            />
            <button type="submit" className="btn btn-primary">
              Transferir
            </button>
          </form>
          {transferMessage ? <p className="feedback">{transferMessage}</p> : null}
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
