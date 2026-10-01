import { Outlet, NavLink, useNavigate, useLocation } from "react-router";
import { LayoutDashboard, FileText, ShoppingCart, Package, Star, RefreshCcw, Users, LogOut, ArrowLeft } from "lucide-react";

import { encerrarSessao, obterSessao } from "@/services/auth";
import type { PerfilAcesso } from "@/types/auth";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}

const navItemsPorPerfil: Record<PerfilAcesso, NavItem[]> = {
  gabinete: [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/pedidos", icon: ShoppingCart, label: "Pedidos e Ordens" },
    { to: "/secretarias", icon: Users, label: "Gestao de Secretarias" },
  ],
  licitacoes: [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/licitacoes", icon: FileText, label: "Licitacoes & Contratos" },
    { to: "/pedidos", icon: ShoppingCart, label: "Pedidos e Ordens" },
    { to: "/renovacoes", icon: RefreshCcw, label: "Renovacoes" },
  ],
  contratos: [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/licitacoes", icon: FileText, label: "Licitacoes & Contratos" },
    { to: "/pedidos", icon: ShoppingCart, label: "Pedidos e Ordens" },
    { to: "/estoque", icon: Package, label: "Estoque" },
    { to: "/avaliacoes", icon: Star, label: "Avaliacoes" },
    { to: "/renovacoes", icon: RefreshCcw, label: "Renovacoes" },
  ],
  secretaria: [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/pedidos", icon: ShoppingCart, label: "Pedidos e Ordens" },
  ],
  fiscal: [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/licitacoes", icon: FileText, label: "Licitacoes & Contratos" },
    { to: "/pedidos", icon: ShoppingCart, label: "Pedidos e Ordens" },
    { to: "/estoque", icon: Package, label: "Estoque" },
    { to: "/avaliacoes", icon: Star, label: "Avaliacoes" },
    { to: "/renovacoes", icon: RefreshCcw, label: "Renovacoes" },
  ],
};

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const sessao = obterSessao();

  const userName = sessao?.nome || "Usuario";
  const userDepartment = sessao?.setor?.nome || "Secretaria Municipal";
  const navItems = navItemsPorPerfil[sessao?.perfil || "secretaria"];

  const handleLogout = () => {
    encerrarSessao();
    navigate("/login");
  };

  // Verifica se a URL atual é a de detalhes da secretaria 
  const isSecretariatDetail = location.pathname.startsWith('/secretarias/') && location.pathname !== '/secretarias';

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight">Fiscal de Contratos</h1>
          <p className="text-xs text-slate-400 mt-1">Gestao de Licitacoes</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm">
              {userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-slate-400 truncate">{userDepartment}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          
          {/* Se for a tela da secretaria, mostra o botão, senão mostra o título normal */}
          {isSecretariatDetail ? (
            <button
              onClick={() => navigate("/secretarias")}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para Gestão de Secretarias
            </button>
          ) : (
            <h2 className="text-lg font-semibold text-slate-800">Sistema Integrado de Gestão</h2>
          )}

          <div className="flex items-center gap-4">
            <button 
              onClick={handleLogout}
              className="text-slate-500 hover:text-slate-700 transition-colors p-2 rounded-md hover:bg-slate-100"
              title="Sair do sistema"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
