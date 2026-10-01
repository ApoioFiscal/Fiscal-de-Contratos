import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Biddings } from "./pages/Biddings";
import { Requests } from "./pages/Requests";
import { Estoque } from "./pages/Estoque";
import { Avaliacoes } from "./pages/Avaliacoes";
import { Renovacoes } from "./pages/Renovacoes";
import { Login } from "./pages/Login";
import { Secretariats } from "./pages/Secretariats";
import { SecretariatDetail } from "./pages/SecretariatDetail";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    Component: ProtectedRoute,
    children: [
      {
        path: "/",
        Component: Layout,
        children: [
          { index: true, Component: Dashboard },
          { path: "secretarias", Component: Secretariats },
          { path: "secretarias/:id", Component: SecretariatDetail },
          { path: "licitacoes", Component: Biddings },
          { path: "pedidos", Component: Requests },
          { path: "estoque", Component: Estoque },
          { path: "avaliacoes", Component: Avaliacoes },
          { path: "renovacoes", Component: Renovacoes },
        ],
      }
    ],
  },
]);
