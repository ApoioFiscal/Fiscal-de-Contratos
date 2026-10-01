export const MOCK_SECRETARIATS = [
  { id: "SEC-01", name: "Saúde" },
  { id: "SEC-02", name: "Educação" },
  { id: "SEC-03", name: "Infraestrutura" },
  { id: "SEC-04", name: "Assistência Social" },
];

export const MOCK_BIDDINGS = [
  {
    id: "LIC-2023-001",
    supplier: "MedTech Distribuidora LTDA",
    cnpj: "12.345.678/0001-90",
    description: "Fornecimento de Medicamentos Gerais",
    validity: "2024-06-30",
    secretariats: ["Saúde", "Assistência Social"],
    status: "active",
    items: [
      { id: "ITEM-1", name: "Dipirona 500mg", brand: "NeoQuímica", unit: "Cx", unitPrice: 15.5, totalQuantity: 10000, consumed: 8500 },
      { id: "ITEM-2", name: "Paracetamol 750mg", brand: "Genérico", unit: "Cx", unitPrice: 12.0, totalQuantity: 5000, consumed: 4900 },
    ]
  },
  {
    id: "LIC-2023-002",
    supplier: "ConstruTudo Materiais",
    cnpj: "98.765.432/0001-10",
    description: "Materiais de Construção - Infraestrutura",
    validity: "2024-12-15",
    secretariats: ["Infraestrutura", "Educação"],
    status: "active",
    items: [
      { id: "ITEM-3", name: "Prego 18x27", brand: "Gerdau", unit: "Kg", unitPrice: 22.0, totalQuantity: 500, consumed: 120 },
      { id: "ITEM-4", name: "Cimento 50kg", brand: "Votorantim", unit: "Saco", unitPrice: 35.0, totalQuantity: 2000, consumed: 1950 },
    ]
  }
];

export const MOCK_REQUESTS = [
  {
    id: "REQ-001",
    date: "2024-05-10",
    secretariat: "Saúde",
    biddingId: "LIC-2023-001",
    status: "completed",
    items: [
      { id: "ITEM-1", name: "Dipirona 500mg", quantity: 500, unitPrice: 15.5 }
    ]
  },
  {
    id: "REQ-002",
    date: "2024-05-18",
    secretariat: "Infraestrutura",
    biddingId: "LIC-2023-002",
    status: "pending",
    items: [
      { id: "ITEM-4", name: "Cimento 50kg", quantity: 100, unitPrice: 35.0 }
    ]
  }
];