import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildContratoSummary, extractContrato, isContrato } from './contratoService';
import { extractWithRules } from './rulesParserService';

/**
 * Texto cru que o pdf-parse extrai de CONTRATO_DV_00014-2026.pdf (PDF escaneado + OCR).
 * Mantido com TODO o ruído de propósito: `N"`, `289,06`, `N42`, `7.455,0(1`, bloco de assinatura ilegível...
 */
const OCR_FIXTURE = readFileSync(
  path.join(__dirname, '__fixtures__', 'contrato_dv00014_2026.ocr.txt'),
  'utf8',
);

// ------------------------------------------------------------------ PDF real (com ruído de OCR)

test('contrato real: identificação, modalidade e objeto', () => {
  const c = extractContrato(OCR_FIXTURE);

  assert.equal(c.numero_contrato, '00141/2026-SDC');
  assert.equal(c.numero_processo, '260803DV00014');
  assert.equal(c.modalidade, 'Dispensa de Licitação');
  assert.equal(c.numero_modalidade, 'DV00014/2026');
  assert.match(c.objeto ?? '', /^CONTRATAÇÃO DE EMPRESA ESPECIALIZADA PARA A CONFECÇÃO/);
  assert.match(c.objeto ?? '', /INDICADOS PELA ADMINISTRAÇÃO\.$/);
});

test('contrato real: contratante (prefeitura) e seu representante', () => {
  const { contratante } = extractContrato(OCR_FIXTURE);

  assert.equal(contratante.nome, 'Prefeitura Municipal de Marizópolis');
  assert.equal(contratante.documento, '01.612.941/0001-49');
  assert.equal(contratante.tipo_documento, 'CNPJ');
  assert.equal(contratante.endereco, 'Rua João Vicente de Almeida, SN - Edilson Alves - Marizopolis - PB');

  const rep = contratante.representante;
  assert.ok(rep);
  assert.equal(rep.nome, 'Lucas Gonçalves Braga');
  assert.equal(rep.cargo, 'Prefeito');
  assert.equal(rep.cpf, '009.910.544-66');
  assert.equal(rep.rg, '2631985');
  assert.equal(rep.orgao_emissor_rg, 'SSP/PB');
  assert.equal(rep.nacionalidade, 'Brasileiro');
  assert.equal(rep.estado_civil, 'Casado');
  assert.equal(rep.profissao, 'Arquiteto');
});

test('contrato real: contratado é o CNPJ da empresa, não o da prefeitura', () => {
  const { contratado } = extractContrato(OCR_FIXTURE);

  assert.equal(contratado.nome, 'RENATA RODRIGUES LOURENCO DE ALMEIDA');
  assert.equal(contratado.documento, '35.848.636/0001-72');
  assert.equal(contratado.tipo_documento, 'CNPJ');
  // "MAR1ZOPOLIS" (OCR) deve voltar a ser "MARIZOPOLIS"
  assert.equal(contratado.endereco, 'RUA OTAVIO MARIZ, 41 - CENTRO - MARIZOPOLIS - PB');
  assert.equal(contratado.representante, null);
});

test('contrato real: itens reconciliados contra ruído de OCR', () => {
  const c = extractContrato(OCR_FIXTURE);

  assert.equal(c.itens.length, 5);
  assert.deepEqual(
    c.itens.map((i) => [i.codigo, i.unidade, i.quantidade, i.valor_unitario, i.valor_total]),
    [
      [1, 'm²', 50, 289, 14450], // OCR leu 289,06
      [2, 'm²', 10, 859, 8590],
      [3, 'm²', 10, 267, 2670], // OCR leu unidade "N42"
      [4, 'm²', 15, 497, 7455], // OCR leu total "7.455,0(1"
      [5, 'm²', 10, 397, 3970],
    ],
  );

  // descrição que o OCR embaralhou ("/GALVANIZADA" antes do parágrafo)
  assert.equal(
    c.itens[0].descricao,
    'PLACA EM ACM COM ESTRUTURA METÁLICA GALVANIZADA COM INSTALAÇÃO NO LOCAL.',
  );
  assert.ok(c.itens[0].correcoes.includes('descricao_reordenada_por_ocr'));
  assert.ok(c.itens[0].correcoes.some((x) => x.startsWith('valor_unitario_corrigido_de_289,06')));
  assert.ok(c.itens[3].correcoes.some((x) => x.startsWith('valor_total_recalculado_de_')));

  // item limpo não deve acusar correção alguma
  assert.deepEqual(c.itens[1].correcoes, []);
  assert.deepEqual(c.itens[4].correcoes, []);
});

test('contrato real: valor total e validações de soma', () => {
  const c = extractContrato(OCR_FIXTURE);

  assert.equal(c.valor_total, 37135);
  assert.equal(c.validacoes.soma_itens_confere_total_da_tabela, true);
  assert.equal(c.validacoes.soma_itens_confere_valor_do_contrato, true);
});

test('contrato real: vigência, assinatura e assinatura digital', () => {
  const c = extractContrato(OCR_FIXTURE);

  assert.equal(c.vigencia.data_inicio, '2026-08-19');
  assert.equal(c.vigencia.data_fim, '2026-12-31');
  assert.equal(c.vigencia.data_fim_calculada, false);

  assert.equal(c.assinatura.local, 'Marizópolis - PB');
  // o carimbo gov.br saiu como "19/08/2076" no OCR: a data vem do texto por extenso
  assert.equal(c.assinatura.data, '2026-08-19');
  assert.deepEqual(c.assinatura.assinatura_digital, {
    detectada: true,
    plataforma: 'gov.br',
    assinante: 'RENATA RODRIGUES LOURENCO DE ALMEIDA',
  });
});

test('contrato real: signatários — nunca inventa o que o OCR não leu', () => {
  const c = extractContrato(OCR_FIXTURE);
  const porPapel = (papel: string) => c.signatarios.filter((s) => s.papel === papel);

  const [contratante] = porPapel('CONTRATANTE');
  assert.equal(contratante.nome, 'Lucas Gonçalves Braga');
  assert.equal(contratante.cpf, '009.910.544-66');
  assert.equal(contratante.confirmado_no_bloco_de_assinatura, false); // bloco ilegível no OCR

  const [contratado] = porPapel('CONTRATADO');
  assert.equal(contratado.nome, 'RENATA RODRIGUES LOURENCO DE ALMEIDA');
  assert.equal(contratado.cnpj, '35.848.636/0001-72');
  assert.equal(contratado.confirmado_no_bloco_de_assinatura, true);

  // testemunhas são manuscritas: 2 esperadas, 0 legíveis, sem nome/CPF inventado
  const testemunhas = porPapel('TESTEMUNHA');
  assert.equal(testemunhas.length, 2);
  for (const t of testemunhas) {
    assert.equal(t.legivel, false);
    assert.equal(t.nome, null);
    assert.equal(t.cpf, null);
  }

  assert.ok(c.avisos.some((a) => /testemunha/i.test(a)));
  assert.ok(c.avisos.some((a) => /assinatura do contratante/i.test(a)));
});

test('contrato real: dotações, condições, fundamentação e foro', () => {
  const c = extractContrato(OCR_FIXTURE);

  assert.deepEqual(
    c.dotacoes.map((d) => [d.unidade_codigo, d.unidade]),
    [
      ['02.010', 'GABINETE DO PREFEITO'],
      ['02.120', 'SECRETARIA DE EDUCAÇÃO'],
      ['02.110', 'SECRETARIA DE SAUDE'],
      ['02.190', 'FUNDO MUNICIPAL DE ASSSITENCIA SOCIAL-FMAS'],
    ],
  );
  assert.equal(c.dotacoes[0].funcional_programatica, '04 122 0020 2002');
  assert.equal(c.dotacoes[0].ficha, '000021');
  assert.equal(c.dotacoes[0].natureza_codigo, '3390.39');
  assert.match(c.dotacoes[3].complemento ?? '', /FNAS APLICAÇÕES DIRETAS$/);

  assert.deepEqual(c.condicoes.prazo_execucao, { quantidade: 15, unidade: 'dias úteis', marco: 'Ordem de Fornecimento' });
  assert.deepEqual(c.condicoes.prazo_pagamento, { quantidade: 30, unidade: 'dias corridos' });
  assert.deepEqual(c.condicoes.reajuste, { prazo: 'um ano', indice: 'IPCA' });

  // só as leis da cláusula de fundamentos — a LGPD (cláusula 14) não entra
  assert.deepEqual(c.fundamentacao_legal, ['Lei Federal nº 14.133/2021', 'Lei Complementar nº 123/2006']);
  assert.equal(c.foro, 'Sousa');
});

test('contrato real: o documento é classificado como contrato (e não "licitacao")', () => {
  assert.equal(isContrato(OCR_FIXTURE), true);
  assert.equal(extractWithRules(OCR_FIXTURE).dados.tipo_documento, 'contrato');
});

test('contrato real: resumo legível', () => {
  assert.equal(
    buildContratoSummary(extractContrato(OCR_FIXTURE)),
    'Contrato 00141/2026-SDC, Dispensa de Licitação DV00014/2026, processo 260803DV00014, ' +
      'Prefeitura Municipal de Marizópolis × RENATA RODRIGUES LOURENCO DE ALMEIDA, ' +
      `valor ${(37135).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, 5 itens, vigência até 31/12/2026.`,
  );
});

// ------------------------------------------------------------------ contrato sintético (texto limpo, outro formato)

const SINTETICO = `
PREGÃO ELETRÔNICO Nº 012/2026
PROCESSO ADMINISTRATIVO Nº 2026/0456
CONTRATO Nº 045/2026
TERMO DE CONTRATO QUE ENTRE SI CELEBRAM O MUNICÍPIO DE EXEMPLO E ACME COMERCIO LTDA
Pelo presente instrumento de contrato, de um lado Município de Exemplo - Praça da Matriz, 10 - Centro - Exemplo - PB, CNPJ nº 12.345.678/0001-90, neste ato representado pelo Secretário Municipal João da Silva, brasileiro, solteiro, servidor público, residente e domiciliado na Rua A, 100 - Centro - Exemplo - PB, CPF nº 123.456.789-09, Carteira de Identidade nº 1234567 SSP/PB, doravante simplesmente CONTRATANTE, e do outro lado ACME COMERCIO LTDA - AVENIDA BRASIL, 500 - BAIRRO NOVO - EXEMPLO - PB, CNPJ nº 98.765.432/0001-10, neste ato representada por Maria Souza, brasileira, casada, empresária, residente e domiciliada na Rua B, 20 - Centro - Exemplo - PB, CPF nº 987.654.321-00, Carteira de Identidade nº 7654321 SSP/PB, doravante simplesmente CONTRATADA, decidiram as partes assinar o presente contrato:
CLÁUSULA PRIMEIRA - DOS FUNDAMENTOS:
Este contrato decorre do Pregão Eletrônico nº 012/2026, processado nos termos da Lei Federal nº 14.133, de 1º de Abril de 2021.
CLÁUSULA SEGUNDA - DO OBJETO:
O presente contrato tem por objeto: AQUISIÇÃO DE MATERIAL DE EXPEDIENTE PARA AS SECRETARIAS.
O fornecimento do objeto deverá ser executado conforme este instrumento.
CLÁUSULA TERCEIRA - DO VALOR E PREÇOS:
CÓDIGO DISCRIMINAÇÃO UNIDADE QUANTIDADE P.UNITÁRIO P. TOTAL
1 CANETA ESFEROGRÁFICA AZUL CX 100 12,50 1.250,00
2 PAPEL A4 75G
BRANCO
RESMA 200 25,00 5.000,00
Total: 6.250,00
O valor total deste contrato, a base do preço proposto, é de R$ 6.250,00 (SEIS MIL DUZENTOS E CINQUENTA REAIS).
CLÁUSULA QUARTA - DO PRAZO E DA VIGÊNCIA:
O prazo de vigência do presente contrato será de 12 (doze) meses, contados da data de sua assinatura.
CLÁUSULA QUINTA - DO PAGAMENTO:
O prazo para pagamento será de até 20 (vinte) dias corridos, contados a partir da data do atesto da nota fiscal.
CLÁUSULA SEXTA - DO FORO:
Para dirimir as questões, as partes elegem o Foro da Comarca de Cajazeiras.
E, por estarem de pleno acordo, foi lavrado o presente contrato, assinado pelas partes e por duas testemunhas.
Exemplo - PB, 10 de março de 2026.
TESTEMUNHAS
Pedro Alves 111.222.333-44
Ana Lima 555.666.777-88
PELO CONTRATANTE
JOÃO DA SILVA
PELO CONTRATADO
MARIA SOUZA
`;

test('contrato sintético: outra modalidade, contratado com representante, vigência por duração', () => {
  const c = extractContrato(SINTETICO);

  assert.equal(c.numero_contrato, '045/2026');
  assert.equal(c.numero_processo, '2026/0456');
  assert.equal(c.modalidade, 'Pregão Eletrônico');
  assert.equal(c.numero_modalidade, '012/2026');

  assert.equal(c.contratante.nome, 'Município de Exemplo');
  assert.equal(c.contratante.documento, '12.345.678/0001-90');
  assert.equal(c.contratante.representante?.cargo, 'Secretário Municipal');
  assert.equal(c.contratante.representante?.nome, 'João da Silva');
  assert.equal(c.contratante.representante?.rg, '1234567');

  // empresa com representante legal (≠ do caso do PDF real, onde o titular assina)
  assert.equal(c.contratado.nome, 'ACME COMERCIO LTDA');
  assert.equal(c.contratado.documento, '98.765.432/0001-10');
  assert.equal(c.contratado.endereco, 'AVENIDA BRASIL, 500 - BAIRRO NOVO - EXEMPLO - PB');
  assert.equal(c.contratado.representante?.nome, 'Maria Souza');
  assert.equal(c.contratado.representante?.cpf, '987.654.321-00');
  assert.equal(c.contratado.representante?.profissao, 'empresária');

  assert.equal(c.assinatura.data, '2026-03-10');
  assert.equal(c.vigencia.data_inicio, '2026-03-10');
  assert.equal(c.vigencia.data_fim, '2027-03-10');
  assert.equal(c.vigencia.data_fim_calculada, true);
  assert.ok(c.avisos.some((a) => /calculada/i.test(a)));

  assert.deepEqual(
    c.itens.map((i) => [i.descricao, i.unidade, i.quantidade, i.valor_unitario, i.valor_total, i.correcoes.length]),
    [
      ['CANETA ESFEROGRÁFICA AZUL', 'Cx', 100, 12.5, 1250, 0],
      ['PAPEL A4 75G BRANCO', 'Resma', 200, 25, 5000, 0],
    ],
  );
  assert.equal(c.valor_total, 6250);
  assert.equal(c.validacoes.soma_itens_confere_valor_do_contrato, true);

  assert.deepEqual(c.condicoes.prazo_pagamento, { quantidade: 20, unidade: 'dias corridos' });
  assert.equal(c.foro, 'Cajazeiras');

  // testemunhas legíveis (CPF estrito) => sem aviso
  const testemunhas = c.signatarios.filter((s) => s.papel === 'TESTEMUNHA');
  assert.deepEqual(testemunhas.map((t) => t.cpf), ['111.222.333-44', '555.666.777-88']);
  assert.ok(testemunhas.every((t) => t.legivel));
  assert.ok(!c.avisos.some((a) => /testemunha/i.test(a)));
});

// ------------------------------------------------------------------ robustez

test('não confunde "CONTRATO NESTE ..." com um número de contrato', () => {
  const c = extractContrato('TERMO DE CONTRATO NESTE ATO\nCLÁUSULA PRIMEIRA\nCLÁUSULA SEGUNDA\nCLÁUSULA TERCEIRA');
  assert.equal(c.numero_contrato, null);
  assert.ok(c.avisos.some((a) => /Número do contrato/.test(a)));
});

test('edital/licitação comum não é tratado como contrato', () => {
  const edital = 'Licitação pública\nÓrgão: Prefeitura Municipal\nCNPJ: 01.612.941/0001-49\nValor: R$ 1.250,00';
  assert.equal(isContrato(edital), false);
  assert.equal(extractWithRules(edital).dados.tipo_documento, 'licitacao');
});

test('item ilegível gera aviso e NÃO engole o item seguinte', () => {
  const texto = SINTETICO.replace(
    '1 CANETA ESFEROGRÁFICA AZUL CX 100 12,50 1.250,00',
    '1 CANETA ESFEROGRÁFICA AZUL CX 100 ??? ???',
  );
  const c = extractContrato(texto);

  // o item 1 não pode ser inventado nem receber valores/descrição do item 2
  assert.equal(c.itens.some((i) => i.codigo === 1), false);

  const item2 = c.itens.find((i) => i.codigo === 2);
  assert.ok(item2);
  assert.equal(item2.descricao, 'PAPEL A4 75G BRANCO');
  assert.equal(item2.quantidade, 200);
  assert.equal(item2.valor_total, 5000);

  assert.ok(c.avisos.some((a) => /^Item 1:/.test(a)));
  // a soma dos itens lidos (5.000) não confere com o contrato (6.250): precisa ser sinalizado
  assert.equal(c.validacoes.soma_itens_confere_valor_do_contrato, false);
  assert.ok(c.avisos.some((a) => /não confere/.test(a)));
});
