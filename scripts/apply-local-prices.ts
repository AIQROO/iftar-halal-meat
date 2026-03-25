import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^(\w+)=(.*)$/);
  if (match) {
    let value = match[2].trim();
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
  if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Read current prices
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Precios!A2:F',
  });

  const rows = res.data.values || [];
  console.log(`Found ${rows.length} products. Applying precio_local = precio_mxn - 100...\n`);

  const localPrices: (string | number)[][] = [];

  for (const row of rows) {
    const nombre = row[1];
    const precioMxn = parseFloat(row[4]) || 0;
    const precioLocal = precioMxn - 100;
    localPrices.push([precioLocal]);
    console.log(`${nombre}: $${precioMxn} → local $${precioLocal}`);
  }

  // Write only column F (precio_local)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Precios!F2:F${rows.length + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: localPrices,
    },
  });

  console.log(`\nDone! ${rows.length} local prices updated.`);
}

main().catch(console.error);
