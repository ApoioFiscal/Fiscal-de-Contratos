import { Navigate, Outlet } from "react-router";

import { encerrarSessao, obterSessao, tokenExpirado } from "@/services/auth";

export function ProtectedRoute() {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (tokenExpirado(token) || !obterSessao()) {
    encerrarSessao();
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
