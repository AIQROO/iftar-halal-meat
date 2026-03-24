import { google, sheets_v4 } from 'googleapis';
import { Product, Price, DashboardStats } from './types';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1NWuW5i-ExtqAKjhuLEMeoxz9muh-Lybe9KS5MDXdC28';

export async function getSheets(): Promise<sheets_v4.Sheets> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey;

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

export async function getPrices(): Promise<Price[]> {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Precios!A2:B',
  });

  const rows = response.data.values || [];
  return rows.map((row) => ({
    tipo_carne: row[0] || '',
    precio_por_kg: parseFloat(row[1]) || 0,
  }));
}

export async function updatePrice(tipo_carne: string, precio_por_kg: number): Promise<void> {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Precios!A2:B',
  });

  const rows = response.data.values || [];
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === tipo_carne) {
      rowIndex = i + 2; // +2 because data starts at row 2 (1-indexed)
      break;
    }
  }

  if (rowIndex === -1) {
    // Append new price row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Precios!A:B',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[tipo_carne, precio_por_kg]],
      },
    });
  } else {
    // Update existing row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Precios!A${rowIndex}:B${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[tipo_carne, precio_por_kg]],
      },
    });
  }
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
  const priceEntry = prices.find((p) => p.tipo_carne === tipoCarne);
  const precioKg = priceEntry ? priceEntry.precio_por_kg : 0;
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
