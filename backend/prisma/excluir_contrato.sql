-- Script para excluir o contrato semeado (00141/2026-SDC) e todos os seus dependentes.
-- Execute com: psql -d prefeitura -f backend/prisma/excluir_contrato.sql

-- 1. Identificar o contrato
DO $$
DECLARE
  v_id INTEGER;
BEGIN
  SELECT id INTO v_id FROM contrato WHERE numero = '00141/2026-SDC';
  IF v_id IS NULL THEN
    RAISE NOTICE 'Contrato 00141/2026-SDC nao encontrado.';
    RETURN;
  END IF;

  -- 2. Excluir dependentes (ordem: folhas primeiro)
  DELETE FROM termo_renovacao WHERE id_contrato = v_id;
  DELETE FROM avaliacao WHERE id_contrato = v_id;
  DELETE FROM nota_fiscal_item WHERE id_nota_fiscal IN (SELECT id FROM nota_fiscal WHERE id_contrato = v_id);
  DELETE FROM nota_fiscal WHERE id_contrato = v_id;
  DELETE FROM movimentacao_estoque WHERE id_contrato_item IN (SELECT id FROM contrato_item WHERE id_contrato = v_id);
  DELETE FROM pedido_item WHERE id_pedido IN (SELECT id FROM pedido WHERE id_contrato = v_id);
  DELETE FROM pedido WHERE id_contrato = v_id;
  DELETE FROM contrato_setor WHERE id_contrato = v_id;
  DELETE FROM contrato_dotacao WHERE id_contrato = v_id;
  DELETE FROM contrato_item WHERE id_contrato = v_id;
  DELETE FROM contrato_signatario WHERE id_contrato = v_id;
  DELETE FROM contrato_parte WHERE id_contrato = v_id;
  DELETE FROM contrato WHERE id = v_id;

  RAISE NOTICE 'Contrato % (id=%) excluido com sucesso.', '00141/2026-SDC', v_id;
END $$;
