import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Plus,
  Building2,
  User,
  Search,
  Trash2,
  ChevronRight,
  Pencil,
  Lock,
  AlertCircle,
} from "lucide-react";
import { apiRequest, ApiError } from "@/services/api";
import type { TipoSetor } from "@/types/auth";

const TIPO_SETOR_LABEL: Record<TipoSetor, string> = {
  GABINETE: "Gabinete",
  SETOR: "Setor administrativo",
  SECRETARIA: "Secretaria",
};

const TIPO_SETOR_CHIP: Record<TipoSetor, string> = {
  GABINETE: "bg-violet-100 text-violet-800",
  SETOR: "bg-blue-100 text-blue-800",
  SECRETARIA: "bg-emerald-100 text-emerald-800",
};

// Setores raízes do sistema: estruturais, não podem ser excluídos (o backend
// também bloqueia com 403). Só o responsável vinculado pode ser alterado.
const SIGLAS_SETORES_RAIZ = new Set(["GAB", "LIC", "FCON", "CMP"]);

const ehSetorRaiz = (sigla?: string) =>
  SIGLAS_SETORES_RAIZ.has((sigla || "").trim().toUpperCase());

const SENHA_PADRAO = "123456";

function mensagemDeErro(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const detalhes = error.details as Record<string, string> | undefined;
    const primeiroDetalhe = detalhes ? Object.values(detalhes)[0] : undefined;
    return primeiroDetalhe || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

interface UsuarioVinculado {
  id: string;
  nome: string;
  email: string;
  funcao?: string;
  isAdmin?: boolean;
  secretariatId: string;
}

interface SetorListado {
  id: string;
  nome: string;
  sigla: string;
  tipo: TipoSetor;
}

interface EdicaoResponsavel {
  id: string;
  nome: string;
  email: string;
  siglaSetor?: string;
  senha: string;
}

export function Secretariats() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"secretarias" | "secretarios">("secretarias");

  // States para Secretariats (Setores)
  const [secretariats, setSecretariats] = useState<SetorListado[]>([]);
  const [isAddSecretariatModalOpen, setIsAddSecretariatModalOpen] = useState(false);
  const [newSecretariatName, setNewSecretariatName] = useState("");
  const [newSecretariatSigla, setNewSecretariatSigla] = useState("");
  const [newSecretariatTipo, setNewSecretariatTipo] = useState<TipoSetor>("SECRETARIA");
  const [secretariatError, setSecretariatError] = useState("");

  // Todos os usuários, incluindo admin/prefeito (usado para achar o responsável
  // de cada setor, inclusive do Gabinete).
  const [usuarios, setUsuarios] = useState<UsuarioVinculado[]>([]);

  // States para Secretaries (Usuários)
  const [isAddSecretaryModalOpen, setIsAddSecretaryModalOpen] = useState(false);
  const [newSecretary, setNewSecretary] = useState({ name: "", email: "", senha: "", secretariatId: "" });
  const [secretaryError, setSecretaryError] = useState("");

  // States para edição do responsável
  const [edicao, setEdicao] = useState<EdicaoResponsavel | null>(null);
  const [edicaoErro, setEdicaoErro] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const [erroGeral, setErroGeral] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [search, setSearch] = useState("");

  const normalizarUsuario = (u: any): UsuarioVinculado => ({
    ...u,
    id: String(u.id),
    nome: u.nome || u.name || "",
    secretariatId: String(u.setor?.id ?? u.idSetor ?? u.secretariatId ?? ""),
  });

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [setores, listaUsuarios] = await Promise.all([
        apiRequest<any[]>("/setores"),
        apiRequest<any[]>("/usuarios"),
      ]);

      setSecretariats(
        setores.map((s: any) => ({
          ...s,
          id: String(s.id),
          nome: s.nome || s.name || "",
          sigla: s.sigla || "",
          tipo: (s.tipo || "SECRETARIA") as TipoSetor,
        }))
      );

      setUsuarios(listaUsuarios.map(normalizarUsuario));
      setErroGeral("");
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      setErroGeral(mensagemDeErro(error, "Não foi possível carregar setores e usuários."));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Aba "Secretários" não lista o admin/prefeito (Gabinete).
  const secretaries = usuarios.filter((u) => u.isAdmin !== true && u.funcao !== "PREFEITO");

  const responsavelDoSetor = (idSetor: string) =>
    usuarios.find((u) => String(u.secretariatId) === String(idSetor));

  const setoresDisponiveis = secretariats.filter(
    (sec) => !ehSetorRaiz(sec.sigla) && !responsavelDoSetor(sec.id)
  );

  const handleAddSecretariat = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecretariatError("");
    if (!newSecretariatName.trim() || !newSecretariatSigla.trim()) return;

    try {
      const novoSetor = await apiRequest<any>("/setores", {
        method: "POST",
        body: JSON.stringify({
          nome: newSecretariatName.trim(),
          sigla: newSecretariatSigla.trim().toUpperCase(),
          tipo: newSecretariatTipo,
        }),
      });

      setSecretariats([
        ...secretariats,
        {
          id: String(novoSetor.id),
          nome: novoSetor.nome || novoSetor.name,
          sigla: novoSetor.sigla,
          tipo: (novoSetor.tipo || newSecretariatTipo) as TipoSetor,
        },
      ]);
      setNewSecretariatName("");
      setNewSecretariatSigla("");
      setNewSecretariatTipo("SECRETARIA");
      setIsAddSecretariatModalOpen(false);
    } catch (error) {
      console.error("Erro ao criar secretaria:", error);
      setSecretariatError(mensagemDeErro(error, "Não foi possível criar a unidade."));
    }
  };

  const handleDeleteSecretariat = async (id: string) => {
    setErroGeral("");
    if (!window.confirm("Tem certeza que deseja excluir esta secretaria?")) return;

    try {
      await apiRequest(`/setores/${id}`, { method: "DELETE" });

      setSecretariats(secretariats.filter((s) => String(s.id) !== String(id)));
    } catch (error) {
      console.error("Erro ao deletar secretaria:", error);
      setErroGeral(mensagemDeErro(error, "Não foi possível excluir o setor."));
    }
  };

  const handleAddSecretary = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecretaryError("");

    if (!newSecretary.name.trim() || !newSecretary.email.trim() || !newSecretary.secretariatId) {
      setSecretaryError("Preencha nome, e-mail e o setor/secretaria.");
      return;
    }

    if (responsavelDoSetor(newSecretary.secretariatId)) {
      setSecretaryError("Este setor já possui um responsável vinculado.");
      return;
    }

    const senha = newSecretary.senha.trim();

    try {
      const novoUsuario = await apiRequest<any>("/usuarios", {
        method: "POST",
        body: JSON.stringify({
          nome: newSecretary.name.trim(),
          email: newSecretary.email.trim(),
          senha: senha || SENHA_PADRAO,
          funcao: "SECRETARIO",
          idSetor: parseInt(newSecretary.secretariatId, 10),
        }),
      });

      setUsuarios([...usuarios, normalizarUsuario(novoUsuario)]);
      setNewSecretary({ name: "", email: "", senha: "", secretariatId: "" });
      setIsAddSecretaryModalOpen(false);
    } catch (error) {
      console.error("Erro ao criar secretário:", error);
      setSecretaryError(mensagemDeErro(error, "Não foi possível criar o secretário."));
    }
  };

  const handleDeleteSecretary = async (id: string) => {
    setErroGeral("");
    if (!window.confirm("Tem certeza que deseja excluir este usuário?")) return;

    try {
      await apiRequest(`/usuarios/${id}`, { method: "DELETE" });
      setUsuarios(usuarios.filter((u) => String(u.id) !== String(id)));
    } catch (error) {
      console.error("Erro ao deletar secretário:", error);
      setErroGeral(mensagemDeErro(error, "Não foi possível excluir o usuário."));
    }
  };

  const abrirEdicaoDoSetor = (setor: SetorListado) => {
    const responsavel = responsavelDoSetor(setor.id);
    setEdicaoErro("");

    if (responsavel) {
      setEdicao({
        id: responsavel.id,
        nome: responsavel.nome,
        email: responsavel.email,
        siglaSetor: setor.sigla,
        senha: "",
      });
      return;
    }

    // Sem responsável: abre a criação já com o setor selecionado.
    setSecretaryError("");
    setNewSecretary({ name: "", email: "", senha: "", secretariatId: setor.id });
    setIsAddSecretaryModalOpen(true);
  };

  const abrirEdicaoDoUsuario = (usuario: UsuarioVinculado) => {
    setEdicaoErro("");
    const setor = secretariats.find((s) => String(s.id) === String(usuario.secretariatId));
    setEdicao({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      siglaSetor: setor?.sigla,
      senha: "",
    });
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edicao) return;

    setEdicaoErro("");
    if (!edicao.nome.trim() || !edicao.email.trim()) {
      setEdicaoErro("Nome e e-mail são obrigatórios.");
      return;
    }
    if (edicao.senha.length > 0 && edicao.senha.length < 6) {
      setEdicaoErro("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setSalvandoEdicao(true);
    try {
      const atualizado = await apiRequest<any>(`/usuarios/${edicao.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nome: edicao.nome.trim(),
          email: edicao.email.trim(),
          ...(edicao.senha.length > 0 ? { senha: edicao.senha } : {}),
        }),
      });

      const normalizado = normalizarUsuario(atualizado);

      setUsuarios(
        usuarios.map((u) =>
          String(u.id) === String(edicao.id)
            ? {
                ...u,
                nome: normalizado.nome || u.nome,
                email: normalizado.email || u.email,
              }
            : u
        )
      );
      setEdicao(null);
    } catch (error) {
      console.error("Erro ao atualizar responsável:", error);
      setEdicaoErro(mensagemDeErro(error, "Não foi possível salvar as alterações."));
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const filteredSecretariats = secretariats.filter(
    (s) =>
      s.nome?.toLowerCase().includes(search.toLowerCase()) ||
      s.sigla?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSecretaries = secretaries.filter(
    (s) =>
      s.nome?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gestão de Setores e Secretarias
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie as secretarias, os setores administrativos e seus respectivos responsáveis
          </p>
        </div>
        <div className="flex gap-3">
          {activeTab === "secretarias" ? (
            <button
              onClick={() => {
                setSecretariatError("");
                setIsAddSecretariatModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Nova Unidade
            </button>
          ) : (
            <button
              onClick={() => {
                setSecretaryError("");
                setNewSecretary({ name: "", email: "", senha: "", secretariatId: "" });
                setIsAddSecretaryModalOpen(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Novo Secretário
            </button>
          )}
        </div>
      </div>

      {erroGeral && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{erroGeral}</span>
          <button
            onClick={() => setErroGeral("")}
            className="text-rose-500 hover:text-rose-700 text-xs font-medium"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 pt-6">
          <div className="flex gap-6">
            <button
              onClick={() => {
                setActiveTab("secretarias");
                setSearch("");
              }}
              className={`pb-4 text-sm font-medium transition-colors relative ${
                activeTab === "secretarias" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Setores e Secretarias
              </div>
              {activeTab === "secretarias" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab("secretarios");
                setSearch("");
              }}
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Buscar ${activeTab === "secretarias" ? "setor ou secretaria" : "responsável"}...`}
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
                    <th className="pb-3 font-medium">Nome</th>
                    <th className="pb-3 font-medium">Tipo</th>
                    <th className="pb-3 font-medium">Responsável Vinculado</th>
                    <th className="pb-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSecretariats.map((sec) => {
                    const responsavel = responsavelDoSetor(sec.id);
                    const raiz = ehSetorRaiz(sec.sigla);
                    return (
                      <tr
                        key={sec.id}
                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                        onClick={() => navigate(`/secretarias/${sec.id}`)}
                      >
                        <td className="py-4 text-slate-500">{String(sec.id).substring(0, 8)}</td>
                        <td className="py-4 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            {sec.nome}{" "}
                            {sec.sigla && (
                              <span className="text-slate-400 font-normal text-xs">({sec.sigla})</span>
                            )}
                            {raiz && (
                              <span
                                title="Setor raiz do sistema — não pode ser excluído"
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5"
                              >
                                <Lock className="w-3 h-3" /> raiz
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </td>
                        <td className="py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              TIPO_SETOR_CHIP[sec.tipo] ?? TIPO_SETOR_CHIP.SECRETARIA
                            }`}
                          >
                            {TIPO_SETOR_LABEL[sec.tipo] ?? TIPO_SETOR_LABEL.SECRETARIA}
                          </span>
                        </td>
                        <td className="py-4">
                          {responsavel ? (
                            <div className="flex items-center gap-2">
                              <div className="min-w-0">
                                <p className="text-slate-900 font-medium truncate">{responsavel.nome}</p>
                                <p className="text-xs text-slate-500 truncate">{responsavel.email}</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirEdicaoDoUsuario(responsavel);
                                }}
                                title="Editar dados do responsável"
                                aria-label={`Editar responsável de ${sec.nome}`}
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirEdicaoDoSetor(sec);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Cadastrar responsável
                            </button>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!raiz && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSecretariat(sec.id);
                                }}
                                title="Excluir setor"
                                aria-label={`Excluir ${sec.nome}`}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSecretariats.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        {carregando ? "Carregando..." : "Nenhum setor ou secretaria encontrado."}
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
                    <th className="pb-3 font-medium">Setor Vinculado</th>
                    <th className="pb-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSecretaries.map((secUser) => {
                    const linkedSec = secretariats.find(
                      (s) => String(s.id) === String(secUser.secretariatId)
                    );
                    return (
                      <tr key={secUser.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-4 font-medium text-slate-900">{secUser.nome}</td>
                        <td className="py-4 text-slate-500">{secUser.email}</td>
                        <td className="py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                            {linkedSec?.sigla || "Não vinculada"}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => abrirEdicaoDoUsuario(secUser)}
                              title="Editar dados do responsável"
                              aria-label={`Editar ${secUser.nome}`}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSecretary(secUser.id)}
                              title="Excluir usuário"
                              aria-label={`Excluir ${secUser.nome}`}
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
                        {carregando ? "Carregando..." : "Nenhum secretário encontrado."}
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
              <h3 className="text-lg font-semibold text-slate-900">Nova Unidade</h3>
            </div>
            <form onSubmit={handleAddSecretariat} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="secTipo" className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo
                  </label>
                  <select
                    id="secTipo"
                    value={newSecretariatTipo}
                    onChange={(e) => setNewSecretariatTipo(e.target.value as TipoSetor)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white"
                  >
                    <option value="SECRETARIA">Secretaria</option>
                    <option value="SETOR">Setor administrativo</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    Setores administrativos (Licitações, Compras, Fiscalização) não são beneficiários de contratos.
                  </p>
                </div>
                <div>
                  <label htmlFor="secName" className="block text-sm font-medium text-slate-700 mb-1">
                    Nome
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
                    Sigla
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
                {secretariatError && (
                  <p className="text-xs text-red-600">{secretariatError}</p>
                )}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddSecretariatModalOpen(false);
                    setNewSecretariatTipo("SECRETARIA");
                    setSecretariatError("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                >
                  Salvar
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
                    placeholder="email@marizopolis.gov.br"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="userSenha" className="block text-sm font-medium text-slate-700 mb-1">
                    Senha inicial
                  </label>
                  <input
                    id="userSenha"
                    type="text"
                    value={newSecretary.senha}
                    onChange={(e) => setNewSecretary({ ...newSecretary, senha: e.target.value })}
                    placeholder={`Opcional — padrão ${SENHA_PADRAO}`}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    O responsável pode alterar essa senha depois pelo botão de editar.
                  </p>
                </div>
                <div>
                  <label htmlFor="secretariatId" className="block text-sm font-medium text-slate-700 mb-1">
                    Vincular ao Setor/Secretaria
                  </label>
                  <select
                    id="secretariatId"
                    required
                    value={newSecretary.secretariatId}
                    onChange={(e) => {
                      setSecretaryError("");
                      setNewSecretary({ ...newSecretary, secretariatId: e.target.value });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white"
                  >
                    <option value="">Selecione um setor...</option>
                    {setoresDisponiveis.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.nome}
                      </option>
                    ))}
                  </select>
                  {setoresDisponiveis.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Todas as unidades já possuem um responsável vinculado.
                    </p>
                  )}
                  {secretaryError && <p className="text-xs text-red-600 mt-1">{secretaryError}</p>}
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddSecretaryModalOpen(false);
                    setSecretaryError("");
                  }}
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

      {/* Edit Responsável Modal */}
      {edicao && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Editar Responsável</h3>
              {edicao.siglaSetor && (
                <p className="text-xs text-slate-500 mt-1">Setor: {edicao.siglaSetor}</p>
              )}
            </div>
            <form onSubmit={handleSalvarEdicao} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="editNome" className="block text-sm font-medium text-slate-700 mb-1">
                    Nome
                  </label>
                  <input
                    id="editNome"
                    type="text"
                    required
                    value={edicao.nome}
                    onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="editEmail" className="block text-sm font-medium text-slate-700 mb-1">
                    E-mail (login)
                  </label>
                  <input
                    id="editEmail"
                    type="email"
                    required
                    value={edicao.email}
                    onChange={(e) => setEdicao({ ...edicao, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    É com este e-mail que o responsável faz login no sistema.
                  </p>
                </div>
                <div>
                  <label htmlFor="editSenha" className="block text-sm font-medium text-slate-700 mb-1">
                    Nova senha
                  </label>
                  <input
                    id="editSenha"
                    type="text"
                    value={edicao.senha}
                    onChange={(e) => setEdicao({ ...edicao, senha: e.target.value })}
                    placeholder="Deixe em branco para manter a atual"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
                {edicaoErro && <p className="text-xs text-red-600">{edicaoErro}</p>}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEdicao(null);
                    setEdicaoErro("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoEdicao}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors shadow-sm"
                >
                  {salvandoEdicao ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
