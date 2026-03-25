import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^(\w+)=(.*)$/);
  if (match) {
    let value = match[2].trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

async function main() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';

  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Header row
  const header = ['categoria', 'nombre', 'nombre_en', 'unidad', 'precio_mxn', 'precio_local'];

  // All products
  const products = [
    // Pollo Halal
    ['Pollo Halal', 'Pollo Entero', 'Whole Chicken', '1 kg', 240, ''],
    ['Pollo Halal', 'Pechuga sin Hueso', 'Boneless Breast', '1 kg', 349, ''],
    ['Pollo Halal', 'Pierna y Muslo', 'Leg and Thigh', '1 kg', 287, ''],
    ['Pollo Halal', 'Pierna y Muslo sin Hueso', 'Boneless Leg and Thigh', '1 kg', 359, ''],
    ['Pollo Halal', 'Alas de Pollo', 'Chicken Wings', '1 kg', 276, ''],

    // Res Halal
    ['Res Halal', 'Falda de Res', 'Shredded Meat', '1 kg', 372, ''],
    ['Res Halal', 'Carne Molida', 'Ground Beef', '1 kg', 379, ''],
    ['Res Halal', 'Chambarete sin Hueso', 'Boneless Shank', '1 kg', 375, ''],
    ['Res Halal', 'Pulpa de Res', 'Beef Cubes', '1 kg', 371, ''],
    ['Res Halal', 'Bistec', 'Sliced Steak', '1 kg', 389, ''],
    ['Res Halal', 'Arrachera', 'Skirt Steak', '1 kg', 474, ''],

    // Res Premium / Prime
    ['Res Premium / Prime', 'Filete Miñón', 'Filet Mignon', '1 kg', 879, ''],
    ['Res Premium / Prime', 'Rib Eye', 'Rib Eye', '1 kg', 926, ''],
    ['Res Premium / Prime', 'New York', 'New York Strip', '1 kg', 697, ''],
    ['Res Premium / Prime', 'Arrachera Premium', 'Premium Skirt Steak', '1 kg', 530, ''],

    // Black Angus Halal
    ['Black Angus Halal', 'New York Black Angus', 'New York Strip', '1 kg', 1097, ''],
    ['Black Angus Halal', 'Rib Eye Black Angus', 'Rib Eye', '1 kg', 1323, ''],
    ['Black Angus Halal', 'Tomahawk', 'Tomahawk', '1 kg', 1062, ''],
    ['Black Angus Halal', 'Arrachera Black Angus', 'Skirt Steak', '1 kg', 730, ''],

    // Cordero Halal
    ['Cordero Halal', 'Rack Corte Francés', 'French Cut Rack of Lamb', '1 kg', 972, ''],
    ['Cordero Halal', 'Rack Corte Estándar', 'Standard Cut Lamb Rack', '1 kg', 699, ''],
    ['Cordero Halal', 'Ossobuco de Cordero', 'Lamb Ossobuco', '1 kg', 510, ''],
    ['Cordero Halal', 'Pierna de Cordero', 'Lamb Leg', '1 kg', 440, ''],

    // Productos Especiales Halal
    ['Productos Especiales Halal', 'Hamburguesa de Cordero', 'Lamb Burger', '1 kg', 496, ''],
    ['Productos Especiales Halal', 'Hamburguesa de Res', 'Beef Burger', '1 kg', 479, ''],
    ['Productos Especiales Halal', 'Merguez', 'Merguez', '1 kg', 480, ''],
    ['Productos Especiales Halal', 'Jamón Halal', 'Halal Ham', '1/4', 199, ''],
    ['Productos Especiales Halal', 'Salchicha de Pavo', 'Turkey Sausage', '1/4', 175, ''],
    ['Productos Especiales Halal', 'Tocino de Pavo', 'Turkey Bacon', '1/4', 210, ''],
  ];

  console.log('Clearing existing Precios data...');
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Precios!A:F',
  });

  console.log('Writing header + products...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Precios!A1:F${products.length + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [header, ...products],
    },
  });

  console.log(`Done! ${products.length} products written to Precios sheet.`);
}

main().catch(console.error);
