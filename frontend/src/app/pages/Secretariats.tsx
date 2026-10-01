import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Plus, Building2, User, Search, Trash2, ChevronRight } from "lucide-react";
import { apiRequest, ApiError } from "@/services/api";

export function Secretariats() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"secretarias" | "secretarios">("secretarias");

  // States para Secretariats (Setores)
  const [secretariats, setSecretariats] = useState<any[]>([]);
  const [isAddSecretariatModalOpen, setIsAddSecretariatModalOpen] = useState(false);
  const [newSecretariatName, setNewSecretariatName] = useState("");
  const [newSecretariatSigla, setNewSecretariatSigla] = useState("");

  // States para Secretaries (Usuários)
  const [secretaries, setSecretaries] = useState<any[]>([]);
  const [isAddSecretaryModalOpen, setIsAddSecretaryModalOpen] = useState(false);
  const [newSecretary, setNewSecretary] = useState({ name: "", email: "", secretariatId: "" });
  const [secretaryError, setSecretaryError] = useState("");

  // Buscar dados do backend ao montar o componente
  useEffect(() => {
    const fetchDados = async () => {
      try {
        const [setores, usuarios] = await Promise.all([
          apiRequest<any[]>("/setores"),
          apiRequest<any[]>("/usuarios"),
        ]);

        setSecretariats(
          setores
            .filter((s: any) => s.sigla !== "GAB") // Ignora o Gabinete
            .map((s: any) => ({
              ...s,
              id: String(s.id),
              name: s.nome || s.name,
              sigla: s.sigla || "",
            }))
        );

        setSecretaries(
          usuarios
            .filter((u: any) => u.isAdmin !== true && u.funcao !== "PREFEITO") // Ignora o Prefeito
            .map((u: any) => ({
              ...u,
              id: String(u.id),
              name: u.nome || u.name,
              secretariatId: String(u.setor?.id || u.idSetor || u.secretariatId || ""),
            }))
        );
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      }
    };

    fetchDados();
  }, []);

  const assignedSecretariatIds = new Set(secretaries.map(s => String(s.secretariatId)));

  const handleAddSecretariat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretariatName.trim() || !newSecretariatSigla.trim()) return;

    try {
      const novoSetor = await apiRequest<any>("/setores", {
        method: "POST",
        body: JSON.stringify({
          nome: newSecretariatName.trim(),
          sigla: newSecretariatSigla.trim().toUpperCase(),
        }),
      });

      setSecretariats([...secretariats, {
        ...novoSetor,
        id: String(novoSetor.id),
        name: novoSetor.nome || novoSetor.name,
        sigla: novoSetor.sigla,
      }]);
      setNewSecretariatName("");
      setNewSecretariatSigla("");
      setIsAddSecretariatModalOpen(false);
    } catch (error) {
      console.error("Erro ao criar secretaria:", error);
    }
  };

  const handleDeleteSecretariat = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta secretaria?")) return;
    
    try {
      await apiRequest(`/setores/${id}`, { method: "DELETE" });

      setSecretariats(secretariats.filter(s => String(s.id) !== String(id)));
      setSecretaries(secretaries.filter(s => String(s.secretariatId) !== String(id)));
    } catch (error) {
      console.error("Erro ao deletar secretaria:", error);
    }
  };

  const handleAddSecretary = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecretaryError("");

    if (!newSecretary.name.trim() || !newSecretary.email.trim() || !newSecretary.secretariatId) return;

    if (assignedSecretariatIds.has(String(newSecretary.secretariatId))) {
      setSecretaryError("Esta secretaria já possui um secretário vinculado.");
      return;
    }

    try {
      const novoUsuario = await apiRequest<any>("/usuarios", {
        method: "POST",
        body: JSON.stringify({
          nome: newSecretary.name,
          email: newSecretary.email,
          senha: "123456",
          funcao: "SECRETARIO",
          idSetor: parseInt(newSecretary.secretariatId, 10),
        }),
      });

      setSecretaries([...secretaries, {
        ...novoUsuario,
        id: String(novoUsuario.id),
        name: novoUsuario.nome || novoUsuario.name,
        secretariatId: String(novoUsuario.idSetor || newSecretary.secretariatId),
      }]);
      setNewSecretary({ name: "", email: "", secretariatId: "" });
      setIsAddSecretaryModalOpen(false);
    } catch (error) {
      console.error("Erro ao criar secretário:", error);
    }
  };

  const handleDeleteSecretary = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este usuário?")) return;
    
    try {
      await apiRequest(`/usuarios/${id}`, { method: "DELETE" });

      setSecretaries(secretaries.filter(s => String(s.id) !== String(id)));
    } catch (error) {
      console.error("Erro ao deletar secretário:", error);
      if (error instanceof ApiError && error.status === 401) {
        alert("Erro de autorização. Faça login novamente.");
      }
    }
  };

  const [search, setSearch] = useState("");

  const filteredSecretariats = secretariats.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.sigla?.toLowerCase().includes(search.toLowerCase()) // Permitindo buscar pela sigla também
  );

  const filteredSecretaries = secretaries.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Secretarias</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie as secretarias e seus respectivos responsáveis
          </p>
        </div>
        <div className="flex gap-3">
          {activeTab === "secretarias" ? (
            <button
              onClick={() => setIsAddSecretariatModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Nova Secretaria
            </button>
          ) : (
            <button
              onClick={() => { setSecretaryError(""); setIsAddSecretaryModalOpen(true); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Novo Secretário
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 pt-6">
          <div className="flex gap-6">
            <button
              onClick={() => { setActiveTab("secretarias"); setSearch(""); }}
              className={`pb-4 text-sm font-medium transition-colors relative ${
                activeTab === "secretarias" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Secretarias
              </div>
              {activeTab === "secretarias" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
            <button
              onClick={() => { setActiveTab("secretarios"); setSearch(""); }}
              className={`pb-4 text-sm font-medium transition-colors relative ${
                activeTab === "secretarios" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Secretários
              </div>
              {activeTab === "secretarios" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Buscar ${activeTab === "secretarias" ? "secretaria" : "secretário"}...`}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === "secretarias" ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">Nome da Secretaria</th>
                    <th className="pb-3 font-medium">Secretário Vinculado</th>
                    <th className="pb-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSecretariats.map((sec) => {
                    const linkedSecretary = secretaries.find(s => String(s.secretariatId) === String(sec.id));
                    return (
                      <tr
                        key={sec.id}
                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                        onClick={() => navigate(`/secretarias/${sec.id}`)}
                      >
                        <td className="py-4 text-slate-500">{String(sec.id).substring(0,8)}</td>
                        <td className="py-4 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            {sec.name} {sec.sigla && <span className="text-slate-400 font-normal text-xs">({sec.sigla})</span>}
                            <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </td>
                        <td className="py-4">
                          {linkedSecretary ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              {linkedSecretary.name} {/* NOME do secretário */}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                              Sem secretário
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteSecretariat(sec.id); }}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSecretariats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        Nenhuma secretaria encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 font-medium">Nome</th>
                    <th className="pb-3 font-medium">E-mail</th>
                    <th className="pb-3 font-medium">Secretaria Vinculada</th>
                    <th className="pb-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSecretaries.map((secUser) => {
                    const linkedSec = secretariats.find(s => String(s.id) === String(secUser.secretariatId));
                    return (
                      <tr key={secUser.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-4 font-medium text-slate-900">{secUser.name}</td>
                        <td className="py-4 text-slate-500">{secUser.email}</td>
                        <td className="py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                            {linkedSec?.sigla || "Não vinculada"} {/* SIGLA da secretaria */}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDeleteSecretary(secUser.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSecretaries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        Nenhum secretário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add Secretariat Modal */}
      {isAddSecretariatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Nova Secretaria</h3>
            </div>
            <form onSubmit={handleAddSecretariat} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="secName" className="block text-sm font-medium text-slate-700 mb-1">
                    Nome da Secretaria
                  </label>
                  <input
                    id="secName"
                    type="text"
                    required
                    value={newSecretariatName}
                    onChange={(e) => setNewSecretariatName(e.target.value)}
                    placeholder="Ex: Secretaria de Saúde"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="secSigla" className="block text-sm font-medium text-slate-700 mb-1">
                    Sigla da Secretaria
                  </label>
                  <input
                    id="secSigla"
                    type="text"
                    required
                    value={newSecretariatSigla}
                    onChange={(e) => setNewSecretariatSigla(e.target.value)}
                    placeholder="Ex: SESAU"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm uppercase"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddSecretariatModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                >
                  Salvar Secretaria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Secretary Modal */}
      {isAddSecretaryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Novo Secretário</h3>
            </div>
            <form onSubmit={handleAddSecretary} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="userName" className="block text-sm font-medium text-slate-700 mb-1">
                    Nome Completo
                  </label>
                  <input
                    id="userName"
                    type="text"
                    required
                    value={newSecretary.name}
                    onChange={(e) => setNewSecretary({ ...newSecretary, name: e.target.value })}
                    placeholder="Nome do responsável"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="userEmail" className="block text-sm font-medium text-slate-700 mb-1">
                    E-mail
                  </label>
                  <input
                    id="userEmail"
                    type="email"
                    required
                    value={newSecretary.email}
                    onChange={(e) => setNewSecretary({ ...newSecretary, email: e.target.value })}
                    placeholder="email@maripa.gov.br"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="secretariatId" className="block text-sm font-medium text-slate-700 mb-1">
                    Vincular à Secretaria
                  </label>
                  <select
                    id="secretariatId"
                    required
                    value={newSecretary.secretariatId}
                    onChange={(e) => { setSecretaryError(""); setNewSecretary({ ...newSecretary, secretariatId: e.target.value }); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white"
                  >
                    <option value="">Selecione uma secretaria...</option>
                    {secretariats
                      .filter(sec => !assignedSecretariatIds.has(String(sec.id)))
                      .map(sec => (
                        <option key={sec.id} value={sec.id}>{sec.name}</option>
                      ))
                    }
                  </select>
                  {secretariats.filter(sec => !assignedSecretariatIds.has(String(sec.id))).length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">Todas as secretarias já possuem um secretário vinculado.</p>
                  )}
                  {secretaryError && (
                    <p className="text-xs text-red-600 mt-1">{secretaryError}</p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setIsAddSecretaryModalOpen(false); setSecretaryError(""); }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                >
                  Salvar Secretário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}