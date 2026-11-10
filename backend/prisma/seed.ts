import { FuncaoUsuario, TipoSetor } from '@prisma/client';
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

  // Nenhum contrato é criado pelo seed: o contrato real entra pela importação
  // do PDF assinado (tela de Contratos → RASCUNHO → revisão → ATIVA).

  console.log('Seed finalizado! Super Usuário garantido:', superAdmin.email);
  console.log('Usuário de compras garantido:', usuarioCompras.email);
  console.log('Usuário de licitações garantido:', usuarioLic.email);
  console.log('Usuário de fiscalização garantido:', usuarioFcon.email);
}

main()
  .catch((e) => {
    console.error('Erro ao executar o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
