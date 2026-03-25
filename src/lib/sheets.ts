import { google, sheets_v4 } from 'googleapis';
import { Product, Price, PriceCategory, DashboardStats } from './types';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1NWuW5i-ExtqAKjhuLEMeoxz9muh-Lybe9KS5MDXdC28';

export async function getSheets(): Promise<sheets_v4.Sheets> {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';

  // Support GOOGLE_CREDENTIALS as a full JSON credential (most reliable for Vercel)
  const creds = process.env.GOOGLE_CREDENTIALS;
  if (creds) {
    try {
      const parsed = JSON.parse(creds);
      email = parsed.client_email;
      privateKey = parsed.private_key;
    } catch {
      // fall through to individual env vars
    }
  }

  // Handle escaped newlines in private key
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// New Precios structure: A=categoria, B=nombre, C=nombre_en, D=unidad, E=precio_mxn, F=precio_local
export async function getPrices(): Promise<Price[]> {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Precios!A2:F',
  });

  const rows = response.data.values || [];
  return rows.map((row) => ({
    categoria: row[0] || '',
    nombre: row[1] || '',
    nombre_en: row[2] || '',
    unidad: row[3] || '',
    precio_mxn: parseFloat(row[4]) || 0,
    precio_local: parseFloat(row[5]) || 0,
  }));
}

export async function getPricesGrouped(): Promise<PriceCategory[]> {
  const prices = await getPrices();
  const categoryMap = new Map<string, Price[]>();

  for (const price of prices) {
    if (!categoryMap.has(price.categoria)) {
      categoryMap.set(price.categoria, []);
    }
    categoryMap.get(price.categoria)!.push(price);
  }

  const categories: PriceCategory[] = [];
  for (const [categoria, productos] of categoryMap) {
    categories.push({ categoria, productos });
  }

  return categories;
}

export async function updatePrice(
  nombre: string,
  precio_mxn?: number,
  precio_local?: number
): Promise<void> {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Precios!A2:F',
  });

  const rows = response.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][1] === nombre) {
      rowIndex = i + 2; // +2 because data starts at row 2 (1-indexed)
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error(`Product "${nombre}" not found in Precios sheet`);
  }

  // Update only the price columns (E and F)
  const currentMxn = parseFloat(rows[rowIndex - 2][4]) || 0;
  const currentLocal = parseFloat(rows[rowIndex - 2][5]) || 0;

  const newMxn = precio_mxn !== undefined ? precio_mxn : currentMxn;
  const newLocal = precio_local !== undefined ? precio_local : currentLocal;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Precios!E${rowIndex}:F${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[newMxn, newLocal]],
    },
  });
}

export async function seedPrices(data: Price[]): Promise<void> {
  const sheets = await getSheets();

  // Clear existing data (keep header)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Precios!A2:F',
  });

  // Write header
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Precios!A1:F1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['categoria', 'nombre', 'nombre_en', 'unidad', 'precio_mxn', 'precio_local']],
    },
  });

  // Write all product rows
  const rows = data.map((p) => [
    p.categoria,
    p.nombre,
    p.nombre_en,
    p.unidad,
    p.precio_mxn,
    p.precio_local || '',
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Precios!A2:F${rows.length + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: rows,
    },
  });
}

export async function getProduct(qrId: string): Promise<Product | null> {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Inventario!A2:M',
  });

  const rows = response.data.values || [];
  for (const row of rows) {
    if (row[0] === qrId) {
      return rowToProduct(row);
    }
  }

  return null;
}

export async function registerProduct(
  qrId: string,
  tipoCarne: string,
  pesoKg: number,
  registradoPor: string
): Promise<Product> {
  const prices = await getPrices();
  // Find price by product name, use precio_local if set, otherwise precio_mxn
  const priceEntry = prices.find((p) => p.nombre === tipoCarne);
  const precioKg = priceEntry
    ? (priceEntry.precio_local > 0 ? priceEntry.precio_local : priceEntry.precio_mxn)
    : 0;
  const precioTotal = pesoKg * precioKg;

  const now = new Date();
  const fechaRegistro = now.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const horaRegistro = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Inventario!A:M',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        [
          qrId,
          tipoCarne,
          pesoKg,
          precioKg,
          precioTotal,
          'Disponible',
          fechaRegistro,
          horaRegistro,
          registradoPor, // registrado_por
          '', // fecha_venta
          '', // hora_venta
          '', // vendido_por
          '', // notas
        ],
      ],
    },
  });

  return {
    qr_id: qrId,
    tipo_carne: tipoCarne,
    peso_kg: pesoKg,
    precio_kg: precioKg,
    precio_total: precioTotal,
    estatus: 'Disponible',
    fecha_registro: fechaRegistro,
    hora_registro: horaRegistro,
    registrado_por: registradoPor,
  };
}

export async function markSold(qrId: string, vendidoPor?: string): Promise<void> {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Inventario!A2:M',
  });

  const rows = response.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === qrId) {
      rowIndex = i + 2; // +2 because data starts at row 2 (1-indexed)
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error(`Product with QR ID ${qrId} not found`);
  }

  const now = new Date();
  const fechaVenta = now.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const horaVenta = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Update estatus (column F), fecha_venta (column J), hora_venta (column K), vendido_por (column L)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Inventario!F${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['Vendido']],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Inventario!J${rowIndex}:L${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[fechaVenta, horaVenta, vendidoPor || '']],
    },
  });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const products = await getAllProducts();

  const disponibles = products.filter((p) => p.estatus === 'Disponible').length;
  const vendidos = products.filter((p) => p.estatus === 'Vendido').length;

  return {
    total: products.length,
    disponibles,
    vendidos,
    productos: products,
  };
}

export async function getAllProducts(): Promise<Product[]> {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Inventario!A2:M',
  });

  const rows = response.data.values || [];
  return rows.map(rowToProduct);
}

function rowToProduct(row: string[]): Product {
  return {
    qr_id: row[0] || '',
    tipo_carne: row[1] || '',
    peso_kg: parseFloat(row[2]) || 0,
    precio_kg: parseFloat(row[3]) || 0,
    precio_total: parseFloat(row[4]) || 0,
    estatus: (row[5] as 'Disponible' | 'Vendido') || 'Disponible',
    fecha_registro: row[6] || '',
    hora_registro: row[7] || '',
    registrado_por: row[8] || undefined,
    fecha_venta: row[9] || undefined,
    hora_venta: row[10] || undefined,
    vendido_por: row[11] || undefined,
    notas: row[12] || undefined,
  };
}
