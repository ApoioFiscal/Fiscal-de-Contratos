import { FuncaoUsuario, StatusContrato, TipoSetor } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../src/prisma/client';

// Usuários exemplares são resolvidos pelo vínculo (setor + função + isAdmin),
// não pelo e-mail: depois que o gabinete trocar nome/e-mail/senha de um
// responsável pela tela de Setores e Secretarias, rodar o seed de novo não
// recria a conta antiga de exemplo.
async function garantirUsuario(params: {
  nome: string;
  email: string;
  senha: string;
  funcao: FuncaoUsuario;
  isAdmin?: boolean;
  idSetor: number;
}) {
  const isAdmin = params.isAdmin ?? false;

  const existente = await prisma.usuario.findFirst({
    where: { idSetor: params.idSetor, funcao: params.funcao, isAdmin },
    orderBy: { id: 'asc' },
  });

  if (existente) {
    return existente;
  }

  return prisma.usuario.create({
    data: {
      nome: params.nome,
      email: params.email,
      senha: params.senha,
      funcao: params.funcao,
      isAdmin,
      idSetor: params.idSetor,
    },
  });
}

async function main() {
  console.log('Iniciando o seed do banco de dados...');

  // Setores raízes do sistema (não podem ser excluídos pela tela).
  const setorGabinete = await prisma.setor.upsert({
    where: { sigla: 'GAB' },
    update: { tipo: TipoSetor.GABINETE },
    create: { nome: 'Gabinete do Prefeito', sigla: 'GAB', tipo: TipoSetor.GABINETE },
  });

  const setorLicitacoes = await prisma.setor.upsert({
    where: { sigla: 'LIC' },
    update: { tipo: TipoSetor.SETOR },
    create: { nome: 'Setor de Licitações', sigla: 'LIC', tipo: TipoSetor.SETOR },
  });

  const setorFiscalizacao = await prisma.setor.upsert({
    where: { sigla: 'FCON' },
    update: { tipo: TipoSetor.SETOR },
    create: { nome: 'Fiscalização de Contratos', sigla: 'FCON', tipo: TipoSetor.SETOR },
  });

  const setorCompras = await prisma.setor.upsert({
    where: { sigla: 'CMP' },
    update: { tipo: TipoSetor.SETOR },
    create: { nome: 'Setor de Compras', sigla: 'CMP', tipo: TipoSetor.SETOR },
  });

  const senhaHash = await bcrypt.hash('123456', 12);

  // Admin = Gabinete do Prefeito. As secretarias beneficiárias são cadastradas
  // pelo próprio gabinete na tela de Setores e Secretarias (nada fixo no seed).
  const superAdmin = await garantirUsuario({
    nome: 'Prefeito',
    email: 'admin@marizopolis.gov.br',
    senha: senhaHash,
    funcao: FuncaoUsuario.PREFEITO,
    isAdmin: true,
    idSetor: setorGabinete.id,
  });

  const usuarioLic = await garantirUsuario({
    nome: 'Licitações',
    email: 'lic@marizopolis.gov.br',
    senha: senhaHash,
    funcao: FuncaoUsuario.SECRETARIO,
    idSetor: setorLicitacoes.id,
  });

  const usuarioFcon = await garantirUsuario({
    nome: 'Fiscalização de Contratos',
    email: 'fcon@marizopolis.gov.br',
    senha: senhaHash,
    funcao: FuncaoUsuario.FISCAL,
    idSetor: setorFiscalizacao.id,
  });

  const usuarioCompras = await garantirUsuario({
    nome: 'Compras',
    email: 'compras@marizopolis.gov.br',
    senha: senhaHash,
    funcao: FuncaoUsuario.SECRETARIO,
    idSetor: setorCompras.id,
  });

  // Contrato real: extraído do PDF assinado (processo 260803DV00014, contrato
  // 00141/2026-SDC) pelo serviço de parsing. Nasce como RASCUNHO — "importado,
  // aguardando revisão".
  const contratoExemplo = await prisma.contrato.upsert({
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
      vigenciaTrecho: 'vigência do presente contrato será determinada: até 31 de dezembro de 2026, considerada da data de sua assinatura',
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
            descricao: 'PLACA EM ACM COM ILUMINAÇÃO INTERNA, ESTRUTURA METÁLICA GALVANIZADA COM INSTALAÇÃO NO LOCAL.',
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

  // Garante o FCON como beneficiário do contrato de exemplo também em bancos
  // já existentes (o upsert acima tem update vazio e não alteraria). Usa upsert
  // para não remover vínculos reais de secretarias criados pela importação.
  await prisma.contratoSetor.upsert({
    where: {
      idContrato_idSetor: {
        idContrato: contratoExemplo.id,
        idSetor: setorFiscalizacao.id,
      },
    },
    update: {},
    create: { idContrato: contratoExemplo.id, idSetor: setorFiscalizacao.id },
  });

  console.log('Seed finalizado! Super Usuário garantido:', superAdmin.email);
  console.log('Usuário de compras garantido:', usuarioCompras.email);
  console.log('Usuário de licitações garantido:', usuarioLic.email);
  console.log('Usuário de fiscalização garantido:', usuarioFcon.email);
  console.log('Contrato de exemplo garantido:', contratoExemplo.numero);
}

main()
  .catch((e) => {
    console.error('Erro ao executar o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
