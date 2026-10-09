import { FuncaoUsuario, StatusContrato } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../src/prisma/client';

async function main() {
  console.log('Iniciando o seed do banco de dados...');

  // Garante que o setor Gabinete exista
  const setorGabinete = await prisma.setor.upsert({
    where: { sigla: 'GAB' },
    update: {},
    create: {
      nome: 'Gabinete do Prefeito',
      sigla: 'GAB',
    },
  });

  // Garante que o setor de Licitações exista
  const setorLicitacoes = await prisma.setor.upsert({
    where: { sigla: 'LIC' },
    update: {},
    create: {
      nome: 'Secretaria de Licitações',
      sigla: 'LIC',
    },
  });

  // Garante que o setor de Fiscalização de Contratos exista
  const setorFiscalizacao = await prisma.setor.upsert({
    where: { sigla: 'FCON' },
    update: {},
    create: {
      nome: 'Fiscalização de Contratos',
      sigla: 'FCON',
    },
  });

  // Setor de exemplo de Secretaria beneficiária (para testar o fluxo de pedidos)
  const setorSaude = await prisma.setor.upsert({
    where: { sigla: 'SSAU' },
    update: {},
    create: {
      nome: 'Secretaria Municipal de Saúde',
      sigla: 'SSAU',
    },
  });

  // Cria a senha criptografada (padrão 123456)
  const senhaHash = await bcrypt.hash('123456', 12);

  // Garante que o Super Usuário exista
  const superAdmin = await prisma.usuario.upsert({
    where: { email: 'admin@marizopolis.gov.br' },
    update: {
      // Se o usuário já existir, garante que ele tenha poder total
      funcao: FuncaoUsuario.PREFEITO,
      isAdmin: true,
      idSetor: setorGabinete.id,
    },
    create: {
      nome: 'Prefeito',
      email: 'admin@marizopolis.gov.br',
      senha: senhaHash,
      funcao: FuncaoUsuario.PREFEITO,
      isAdmin: true,
      idSetor: setorGabinete.id,
    },
  });

  // Usuários de teste nos três perfis (senha 123456) — usados pelos testes e2e
  // e úteis para validar manualmente o fluxo de pedidos por secretaria.
  const usuariosTeste = [
    {
      nome: 'Secretário de Saúde',
      email: 'saude@marizopolis.gov.br',
      funcao: FuncaoUsuario.SECRETARIO,
      idSetor: setorSaude.id,
    },
    {
      nome: 'Gestor de Licitações',
      email: 'lic@marizopolis.gov.br',
      funcao: FuncaoUsuario.SECRETARIO,
      idSetor: setorLicitacoes.id,
    },
    {
      nome: 'Fiscal de Contratos',
      email: 'fcon@marizopolis.gov.br',
      funcao: FuncaoUsuario.SECRETARIO,
      idSetor: setorFiscalizacao.id,
    },
  ];

  for (const u of usuariosTeste) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: {
        nome: u.nome,
        email: u.email,
        senha: senhaHash,
        funcao: u.funcao,
        isAdmin: false,
        idSetor: u.idSetor,
      },
    });
  }

  // Garante um contrato de exemplo com itens, para desenvolvimento das telas
  const anoBase = new Date().getFullYear();
  const fimVigencia = new Date();
  fimVigencia.setMonth(fimVigencia.getMonth() + 12);

  const contratoExemplo = await prisma.licitacaoContrato.upsert({
    where: { numero: `LIC-${anoBase}-001` },
    update: {
      // Garante as beneficiárias mesmo em re-execuções do seed (upsert com update vazio não alteraria)
      setores: {
        set: [{ idSetor: setorFiscalizacao.id }, { idSetor: setorSaude.id }],
      },
    },
    create: {
      numero: `LIC-${anoBase}-001`,
      numeroProcesso: `PRC-${anoBase}/001`,
      modalidade: 'PREGÃO ELETRÔNICO',
      objeto: 'Fornecimento de Medicamentos Gerais',
      fornecedor: 'MedTech Distribuidora LTDA',
      cnpjFornecedor: '12.345.678/0001-90',
      dataAbertura: new Date(),
      dataVigenciaFim: fimVigencia,
      status: StatusContrato.ATIVA,
      valorTotal: 214500,
      itens: {
        create: [
          {
            descricao: 'Dipirona 500mg',
            marca: 'NeoQuímica',
            unidade: 'Cx',
            quantidade: 10000,
            precoUnitario: 15.5,
            precoTotal: 155000,
          },
          {
            descricao: 'Paracetamol 750mg',
            marca: 'Genérico',
            unidade: 'Cx',
            quantidade: 5000,
            precoUnitario: 11.9,
            precoTotal: 59500,
          },
        ],
      },
      setores: {
        create: [{ idSetor: setorFiscalizacao.id }, { idSetor: setorSaude.id }],
      },
    },
  });

  // Licitação de exemplo com contrato ainda não gerado
  // (status RASCUNHO — aguarda o LIC clicar em "Gerar Contrato")
  const licitacaoPendente = await prisma.licitacaoContrato.upsert({
    where: { numero: `LIC-${anoBase}-002` },
    update: {},
    create: {
      numero: `LIC-${anoBase}-002`,
      numeroProcesso: `PRC-${anoBase}/002`,
      modalidade: 'PREGÃO ELETRÔNICO',
      objeto: 'Aquisição de Equipamentos de Informática',
      fornecedor: 'InfoStore Comércio de Tecnologia LTDA',
      cnpjFornecedor: '98.765.432/0001-10',
      dataAbertura: new Date(),
      dataVigenciaFim: fimVigencia,
      status: StatusContrato.RASCUNHO,
      valorTotal: 84500,
      itens: {
        create: [
          {
            descricao: 'Notebook 16GB RAM',
            marca: 'Dell',
            unidade: 'Un',
            quantidade: 20,
            precoUnitario: 3600,
            precoTotal: 72000,
          },
          {
            descricao: 'Monitor 24"',
            marca: 'LG',
            unidade: 'Un',
            quantidade: 10,
            precoUnitario: 1250,
            precoTotal: 12500,
          },
        ],
      },
      setores: {
        create: [{ idSetor: setorFiscalizacao.id }],
      },
    },
  });

  console.log('✅ Seed finalizado! Super Usuário garantido:', superAdmin.email);
  console.log('✅ Contrato de exemplo garantido:', contratoExemplo.numero);
  console.log('✅ Licitação pendente de contrato:', licitacaoPendente.numero);
}

main()
  .catch((e) => {
    console.error('Erro ao executar o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });