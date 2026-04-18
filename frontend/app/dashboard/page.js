"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { categoryBadgeForItem, flowForTransactionType } from "../../lib/transactionInsights";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const FILTER_OPTIONS = [
  { value: "all", label: "Todos los tiempos" },
  { value: "ytd", label: "Este año" },
  { value: "30d", label: "Ultimos 30 dias" },
  { value: "15d", label: "Ultimos 15 dias" },
];

const PAGE_SIZE = 5;

export default function DashboardPage() {
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  /** null = aun no cargado */
  const [historyTotal, setHistoryTotal] = useState(null);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
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
          `${API_URL}/api/v1/transactions/history?document_number=${documentNumber}&range_type=${rangeType}&page=${historyPage}&page_size=${PAGE_SIZE}`
        );
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.detail || "No se pudo cargar el historial.");
          return;
        }
        setHistory(data.items || []);
        setHistoryTotal(typeof data.total === "number" ? data.total : 0);
        setHistoryTotalPages(typeof data.total_pages === "number" ? data.total_pages : 1);
      } catch (error) {
        setMessage("No se pudo cargar el historial.");
        setHistoryTotal(0);
        setHistory([]);
      }
    };

    loadHistory();
  }, [documentNumber, rangeType, historyPage]);

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
        `${API_URL}/api/v1/transactions/history?document_number=${documentNumber}&range_type=${rangeType}&page=1&page_size=${PAGE_SIZE}`
      ),
    ]);
    const summaryData = await summaryResponse.json();
    const historyData = await historyResponse.json();
    if (summaryResponse.ok) setAccount(summaryData);
    if (historyResponse.ok) {
      setHistory(historyData.items || []);
      setHistoryTotal(typeof historyData.total === "number" ? historyData.total : 0);
      setHistoryTotalPages(typeof historyData.total_pages === "number" ? historyData.total_pages : 1);
    }
    if (historyPage !== 1) {
      setHistoryPage(1);
    }
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

      if (
        initData.sourceCurrency &&
        initData.targetCurrency &&
        initData.amountCreditedInTargetCurrency
      ) {
        setTransferMessage(
          `Handshake OK. Se debitaran ${initData.amountDebitedInSourceCurrency} ${initData.sourceCurrency} ` +
            `(destino recibe ${initData.amountCreditedInTargetCurrency} ${initData.targetCurrency}; ` +
            `TC 1 USD = ${initData.fxRateUsdCop} COP). Ejecutando...`
        );
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
          <p className="muted">
            El monto se debita en la moneda de tu cuenta ({account?.currencyCode || "..."}). Si el
            destino es otra moneda, el banco acredita el equivalente (1 USD = 4000 COP por defecto,
            configurable con USD_COP_RATE en el backend).
          </p>
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
            <div className="history-header-actions">
              <Link href="/insights" className="btn btn-primary">
                Ver resumen por categorias
              </Link>
              <select
                value={rangeType}
                onChange={(event) => {
                  setRangeType(event.target.value);
                  setHistoryPage(1);
                }}
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {historyTotal === null ? (
            <p className="muted">Cargando historial...</p>
          ) : historyTotal === 0 ? (
            <p className="muted">No hay transacciones para este filtro.</p>
          ) : (
            <>
              <div className="history-list">
                {history.map((item, index) => {
                  const flow = flowForTransactionType(item.transactionType);
                  const flowLabel = flow === "in" ? "Ingreso" : flow === "out" ? "Egreso" : "—";
                  const badge = categoryBadgeForItem(item);
                  const rowFrom = (historyPage - 1) * PAGE_SIZE + index + 1;
                  return (
                    <div
                      key={`${item.date}-${item.targetAccount}-${item.amount}-${historyPage}-${index}`}
                      className="history-item"
                    >
                      <span className="history-row-num muted">#{rowFrom}</span>
                      <span>{new Date(item.date).toLocaleDateString("es-CO")}</span>
                      <span className="history-flow">
                        {flowLabel}
                        {badge ? (
                          <span className="category-badge" title="Categoria inferida por palabras clave">
                            {badge.label}
                          </span>
                        ) : null}
                      </span>
                      <span>Referencia: {item.targetAccount}</span>
                      <span>Descripcion: {item.description}</span>
                      <strong>
                        {flow === "out" ? "-" : flow === "in" ? "+" : ""}
                        {item.amount}
                      </strong>
                    </div>
                  );
                })}
              </div>
              <div className="history-pagination">
                <p className="history-pagination-meta muted">
                  Mostrando{" "}
                  <strong>
                    {historyTotal === 0 ? 0 : (historyPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(historyPage * PAGE_SIZE, historyTotal)}
                  </strong>{" "}
                  de <strong>{historyTotal}</strong> ({PAGE_SIZE} por pagina)
                </p>
                <div className="history-pagination-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span className="history-page-indicator">
                    Pagina {historyPage} de {historyTotalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </article>
      </section>
      {message ? <p className="feedback">{message}</p> : null}
    </main>
  );
}
