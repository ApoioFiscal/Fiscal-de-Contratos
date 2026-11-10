/**
 * Fixture exclusiva do E2E (`frontend/e2e/fiscal-flow.spec.ts`).
 *
 * O seed de desenvolvimento (`prisma/seed.ts`) NÃO cria contratos: o contrato
 * real entra pela importação do PDF assinado. Como o E2E precisa de um contrato
 * para pedidos/estoque/avaliações, ele garante aqui o contrato do processo
 * 260803DV00014 (00141/2026-SDC), extraído do PDF real, já como RASCUNHO.
 *
 * Executado pelo `globalSetup` do Playwright. É idempotente (upsert).
 */
import { StatusContrato } from '@prisma/client';
import { prisma } from '../src/prisma/client';

async function main() {
  const setorFiscalizacao = await prisma.setor.findUnique({ where: { sigla: 'FCON' } });

  if (!setorFiscalizacao) {
    throw new Error('Setor FCON não encontrado. Rode o seed do backend antes do E2E.');
  }

  const contrato = await prisma.contrato.upsert({
    where: { numero: '00141/2026-SDC' },
    update: {},
    create: {
      numero: '00141/2026-SDC',
      numeroProcesso: '260803DV00014',
      modalidade: 'Dispensa de Licitação',
      numeroModalidade: 'DV00014/2026',
      objeto:
        'CONTRATAÇÃO DE EMPRESA ESPECIALIZADA PARA A CONFECÇÃO, FORNECIMENTO E INSTALAÇÃO DE PLACAS DE COMUNICAÇÃO VISUAL, DESTINADAS AO ATENDIMENTO DA. , NECESSIDADES DA PREFEITURA MUNICIPAL DE MARIZÓPOLIS/PB, COMPREENDENDO A PRODUÇÃO DE PLACAS EM ACM, ACRÍLICO, PVC EXPANDIDO E DEMAIS MATERIAIS DE COMUNICAÇÃO VISUAL, INCLUINDO INSTALAÇÃO NOS LOCAIS INDICADOS PELA ADMINISTRAÇÃO.',
      valorTotal: 37135,
      vigenciaInicio: new Date('2026-08-19'),
      vigenciaFim: new Date('2026-12-31'),
      vigenciaFimCalculada: false,
      vigenciaTrecho:
        'vigência do presente contrato será determinada: até 31 de dezembro de 2026, considerada da data de sua assinatura',
      foro: 'Sousa',
      status: StatusContrato.RASCUNHO,
      itens: {
        create: [
          {
            codigo: 1,
            descricao: 'PLACA EM ACM COM ESTRUTURA METÁLICA GALVANIZADA COM INSTALAÇÃO NO LOCAL.',
            unidade: 'm²',
            unidadeOriginal: 'M2',
            quantidade: 50,
            valorUnitario: 289,
            valorTotal: 14450,
          },
          {
            codigo: 2,
            descricao:
              'PLACA EM ACM COM ILUMINAÇÃO INTERNA, ESTRUTURA METÁLICA GALVANIZADA COM INSTALAÇÃO NO LOCAL.',
            unidade: 'm²',
            unidadeOriginal: 'M2',
            quantidade: 10,
            valorUnitario: 859,
            valorTotal: 8590,
          },
          {
            codigo: 3,
            descricao: 'ACRILICO EM DIVERSAS CORES E TAMANIIOS 3MM.',
            unidade: 'm²',
            unidadeOriginal: 'N42',
            quantidade: 10,
            valorUnitario: 267,
            valorTotal: 2670,
          },
          {
            codigo: 4,
            descricao: 'PVC EXPANDIDO 20 MM COM PINTURA AUTOMOTIVA E INSTALAÇÃO NO LOCAL.',
            unidade: 'm²',
            unidadeOriginal: 'M2',
            quantidade: 15,
            valorUnitario: 497,
            valorTotal: 7455,
          },
          {
            codigo: 5,
            descricao: 'PVC EXPANDIDO 10 MM COM PINTURA AUTOMOTIVA E INSTALAÇÃO NO LOCAL.',
            unidade: 'm²',
            unidadeOriginal: 'M2',
            quantidade: 10,
            valorUnitario: 397,
            valorTotal: 3970,
          },
        ],
      },
      setores: {
        create: [{ idSetor: setorFiscalizacao.id }],
      },
    },
  });

  // Não remove vínculos reais de secretarias criados pela importação.
  await prisma.contratoSetor.upsert({
    where: {
      idContrato_idSetor: {
        idContrato: contrato.id,
        idSetor: setorFiscalizacao.id,
      },
    },
    update: {},
    create: { idContrato: contrato.id, idSetor: setorFiscalizacao.id },
  });

  console.log('Contrato do E2E garantido:', contrato.numero);
}

main()
  .catch((e) => {
    console.error('Erro ao garantir o contrato do E2E:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
