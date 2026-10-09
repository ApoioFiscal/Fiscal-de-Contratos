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

  // Garante um contrato de exemplo com itens, para desenvolvimento das telas
  const anoBase = new Date().getFullYear();
  const fimVigencia = new Date();
  fimVigencia.setMonth(fimVigencia.getMonth() + 12);

  const contratoExemplo = await prisma.licitacaoContrato.upsert({
    where: { numero: `LIC-${anoBase}-001` },
    update: {},
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
        create: [{ idSetor: setorFiscalizacao.id }],
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