"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildTransactionInsights } from "../../lib/transactionInsights";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const FILTER_OPTIONS = [
  { value: "all", label: "Todos los tiempos" },
  { value: "ytd", label: "Este año" },
  { value: "30d", label: "Ultimos 30 dias" },
  { value: "15d", label: "Ultimos 15 dias" },
];

export default function InsightsPage() {
  const router = useRouter();
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [rangeType, setRangeType] = useState("all");
  const [message, setMessage] = useState("");

  const documentNumber =
    typeof window !== "undefined" ? localStorage.getItem("document_number") : null;

  useEffect(() => {
    if (!documentNumber) {
      router.replace("/login");
    }
  }, [documentNumber, router]);

  useEffect(() => {
    if (!documentNumber) return;

    const loadAccountSummary = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/v1/accounts/summary?document_number=${documentNumber}`
        );
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.detail || "No se pudo cargar la cuenta.");
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

  const insights = useMemo(() => buildTransactionInsights(history), [history]);
  const currencyCode = account?.currencyCode || "USD";

  if (!documentNumber) {
    return null;
  }

  return (
    <main className="insights-page">
      <div className="insights-page-inner">
        <p className="insights-back">
          <Link href="/dashboard" className="text-link">
            Volver al panel
          </Link>
        </p>
        <h1>Resumen por categoria</h1>
        <p className="muted insights-lead">
          Clasificacion automatica segun la descripcion de tus movimientos en el periodo elegido.
        </p>

        <div className="insights-toolbar">
          <label className="insights-filter-label" htmlFor="insights-range">
            Periodo
          </label>
          <select
            id="insights-range"
            value={rangeType}
            onChange={(event) => setRangeType(event.target.value)}
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <section className="insights-block insights-block-standalone" aria-label="Resumen por categorias">
          {history.length === 0 ? (
            <p className="muted">No hay datos para analizar en este periodo.</p>
          ) : (
            <>
              <div className="insights-summary">
                <div className="insights-pill insights-pill-in">
                  <span className="insights-pill-label">Entradas</span>
                  <strong>
                    {currencyCode} {insights.totalIn}
                  </strong>
                  <span className="insights-pill-meta">{insights.pctMovementIn}% del volumen</span>
                </div>
                <div className="insights-pill insights-pill-out">
                  <span className="insights-pill-label">Salidas</span>
                  <strong>
                    {currencyCode} {insights.totalOut}
                  </strong>
                  <span className="insights-pill-meta">{insights.pctMovementOut}% del volumen</span>
                </div>
              </div>
              <div className="insights-columns">
                <div className="insights-column">
                  <h2 className="insights-subtitle">Entradas por categoria</h2>
                  {insights.totalIn <= 0 ? (
                    <p className="muted">Sin ingresos en este periodo.</p>
                  ) : (
                    <ul className="flow-bar-list">
                      {insights.inCategories.map((row) => (
                        <li key={row.id} className="flow-bar-row">
                          <div className="flow-bar-head">
                            <span>{row.label}</span>
                            <span>
                              {currencyCode} {row.amount}{" "}
                              <span className="flow-bar-pct">({row.pctOfSide}%)</span>
                            </span>
                          </div>
                          <div className="flow-bar-track flow-bar-track-in">
                            <div
                              className="flow-bar-fill flow-bar-fill-in"
                              style={{ width: `${Math.min(100, row.pctOfSide)}%` }}
                            />
                          </div>
                          <span className="flow-bar-meta">{row.count} mov.</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="insights-column">
                  <h2 className="insights-subtitle">Salidas por categoria</h2>
                  {insights.totalOut <= 0 ? (
                    <p className="muted">Sin egresos en este periodo.</p>
                  ) : (
                    <ul className="flow-bar-list">
                      {insights.outCategories.map((row) => (
                        <li key={row.id} className="flow-bar-row">
                          <div className="flow-bar-head">
                            <span>{row.label}</span>
                            <span>
                              {currencyCode} {row.amount}{" "}
                              <span className="flow-bar-pct">({row.pctOfSide}%)</span>
                            </span>
                          </div>
                          <div className="flow-bar-track flow-bar-track-out">
                            <div
                              className="flow-bar-fill flow-bar-fill-out"
                              style={{ width: `${Math.min(100, row.pctOfSide)}%` }}
                            />
                          </div>
                          <span className="flow-bar-meta">{row.count} mov.</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <p className="insights-footnote muted">
                Clasificacion por palabras clave (prototipo). En produccion se usaria un modelo de
                aprendizaje entrenado con mas datos y descripciones mas homogeneas para mayor
                precision y auditoria.
              </p>
            </>
          )}
        </section>

        {message ? <p className="feedback">{message}</p> : null}
      </div>
    </main>
  );
}
