/**
 * Clasificación por palabras clave sobre descripciones normalizadas.
 * En producción se reemplazaría por un modelo entrenado con más datos y auditoría.
 */

const INCOME_RULES = [
  {
    id: "empresa",
    label: "Empresa / nómina",
    keywords: ["empresa", "nomina", "nómina", "payroll", "contrato", "honorarios", "proveedor"],
  },
  {
    id: "cdt",
    label: "CDT / inversión",
    keywords: ["cdt", "interes", "interés", "inversion", "inversión", "dividendo", "rendimiento", "titulo", "título"],
  },
  {
    id: "recarga",
    label: "Recarga / depósito",
    keywords: ["recarga", "deposito", "depósito", "top up", "apertura", "inicial", "carga de saldo"],
  },
  {
    id: "venta",
    label: "Ventas / cobros",
    keywords: ["venta", "cobro", "cliente", "factura", "pago recibido", "cxc"],
  },
  {
    id: "persona",
    label: "Personas / familiares",
    keywords: ["familia", "familiar", "mama", "papá", "papa", "regalo", "amigo", "amiga", "hijo", "hija"],
  },
];

const EXPENSE_RULES = [
  {
    id: "recibos",
    label: "Servicios / recibos",
    keywords: ["recibo", "luz", "agua", "gas", "internet", "wifi", "electric", "acueducto", "epm", "enel", "claro", "movistar", "tigo"],
  },
  {
    id: "comida",
    label: "Comida / restaurante",
    keywords: ["comida", "restaurante", "almuerzo", "cena", "domicilio", "rappi", "ifood", "didi food", "mercado", "supermercado"],
  },
  {
    id: "transporte",
    label: "Transporte",
    keywords: ["uber", "taxi", "transmilenio", "metro", "gasolina", "combustible", "parking", "parqueadero", "peaje"],
  },
  {
    id: "vivienda",
    label: "Vivienda",
    keywords: ["arriendo", "renta", "hipoteca", "administracion", "administración", "condominio", "aval"],
  },
  {
    id: "salud",
    label: "Salud",
    keywords: ["farmacia", "eps", "medico", "médico", "doctor", "hospital", "laboratorio", "odontologo", "odontólogo"],
  },
  {
    id: "entretenimiento",
    label: "Entretenimiento",
    keywords: ["cine", "netflix", "spotify", "youtube", "prime", "hbo", "juego", "steam", "concierto"],
  },
  {
    id: "transferencia",
    label: "Transferencias",
    keywords: ["transferencia", "envio", "envío", "pago a", "pago prestamo", "préstamo", "credito", "crédito"],
  },
];

export function normalizeDescription(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreRule(textNorm, keywords) {
  let score = 0;
  for (const kw of keywords) {
    if (textNorm.includes(kw)) score += 1;
  }
  return score;
}

/**
 * @param {string} description
 * @param {'in' | 'out'} flow
 */
export function classifyTransaction(description, flow) {
  const text = normalizeDescription(description);
  const rules = flow === "in" ? INCOME_RULES : EXPENSE_RULES;
  let best = { id: "otros", label: "Sin clasificar", score: 0 };
  for (const rule of rules) {
    const s = scoreRule(text, rule.keywords);
    if (s > best.score) {
      best = { id: rule.id, label: rule.label, score: s };
    }
  }
  if (best.score === 0) {
    return { id: "otros", label: "Sin clasificar" };
  }
  return { id: best.id, label: best.label };
}

export function flowForTransactionType(transactionType) {
  if (transactionType === "DEPOSIT" || transactionType === "TRANSFER_IN") return "in";
  if (transactionType === "TRANSFER_OUT" || transactionType === "WITHDRAWAL") return "out";
  return null;
}

function addToBucket(map, key, label, amount) {
  if (!map.has(key)) {
    map.set(key, { id: key, label, amount: 0, count: 0 });
  }
  const row = map.get(key);
  row.amount += amount;
  row.count += 1;
}

/**
 * @param {Array<{ amount: string, description: string, transactionType?: string }>} items
 */
export function buildTransactionInsights(items) {
  const inMap = new Map();
  const outMap = new Map();
  let totalIn = 0;
  let totalOut = 0;

  for (const item of items) {
    const amount = Number.parseFloat(item.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const flow = flowForTransactionType(item.transactionType);
    if (!flow) continue;

    const cat = classifyTransaction(item.description || "", flow);
    if (flow === "in") {
      totalIn += amount;
      addToBucket(inMap, cat.id, cat.label, amount);
    } else {
      totalOut += amount;
      addToBucket(outMap, cat.id, cat.label, amount);
    }
  }

  const toSortedRows = (map, total) => {
    const rows = [...map.values()].sort((a, b) => b.amount - a.amount);
    return rows.map((row) => ({
      ...row,
      amount: Math.round(row.amount * 100) / 100,
      pctOfSide: total > 0 ? Math.round((row.amount / total) * 1000) / 10 : 0,
    }));
  };

  const movement = totalIn + totalOut;
  return {
    totalIn: Math.round(totalIn * 100) / 100,
    totalOut: Math.round(totalOut * 100) / 100,
    inCategories: toSortedRows(inMap, totalIn),
    outCategories: toSortedRows(outMap, totalOut),
    pctMovementIn: movement > 0 ? Math.round((totalIn / movement) * 1000) / 10 : 0,
    pctMovementOut: movement > 0 ? Math.round((totalOut / movement) * 1000) / 10 : 0,
  };
}

export function categoryBadgeForItem(item) {
  const flow = flowForTransactionType(item.transactionType);
  if (!flow) return null;
  return classifyTransaction(item.description || "", flow);
}
