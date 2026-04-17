"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TopNav() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const syncSession = () => {
      const token = localStorage.getItem("access_token");
      setIsLoggedIn(Boolean(token));
    };

    syncSession();
    window.addEventListener("storage", syncSession);
    window.addEventListener("session-changed", syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("session-changed", syncSession);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_name");
    localStorage.removeItem("document_number");
    localStorage.removeItem("full_account_number");
    setIsLoggedIn(false);
    window.dispatchEvent(new Event("session-changed"));
    router.push("/");
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        {isLoggedIn ? (
          <span className="brand brand-static">Banco Simple</span>
        ) : (
          <Link href="/" className="brand">
            Banco Simple
          </Link>
        )}

        <nav className="topbar-actions">
          {isLoggedIn ? (
            <button type="button" className="btn btn-secondary" onClick={handleLogout}>
              Cerrar sesion
            </button>
          ) : (
            <>
              <Link href="/create-account" className="btn btn-secondary">
                Crear cuenta
              </Link>
              <Link href="/login" className="btn btn-primary">
                Iniciar sesion
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
