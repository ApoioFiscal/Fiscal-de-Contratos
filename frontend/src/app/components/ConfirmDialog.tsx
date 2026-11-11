import { useEffect, useRef, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Card de confirmação dentro do app — substitui o `window.confirm` nativo.
 * Fecha com Esc ou clique no fundo; a ação confirmada só dispara pelo botão.
 */
export function ConfirmDialog({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar = "Excluir",
  rotuloCancelar = "Cancelar",
  processando = false,
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: ReactNode;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  processando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const onCancelarRef = useRef(onCancelar);
  onCancelarRef.current = onCancelar;
  const processandoRef = useRef(processando);
  processandoRef.current = processando;

  useEffect(() => {
    if (!aberto) return;

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !processandoRef.current) {
        onCancelarRef.current();
      }
    };

    document.addEventListener("keydown", aoTeclar);
    // Foco no "Cancelar" é o padrão seguro para ação destrutiva.
    cancelarRef.current?.focus();

    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !processando) onCancelar();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-titulo"
        aria-describedby="confirm-dialog-descricao"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start gap-3 p-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-dialog-titulo" className="text-base font-semibold text-slate-900">
              {titulo}
            </h2>
            <div id="confirm-dialog-descricao" className="mt-1 text-sm text-slate-600">
              {descricao}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelarRef}
            type="button"
            onClick={onCancelar}
            disabled={processando}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 rounded-xl transition-colors"
          >
            {rotuloCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={processando}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-xl transition-colors shadow-sm"
          >
            {processando && <Loader2 className="h-4 w-4 animate-spin" />}
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
