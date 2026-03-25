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

  // Check if Locales sheet exists
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];

  if (!sheetNames.includes('Locales')) {
    console.log('Creating "Locales" sheet...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: 'Locales' } },
        }],
      },
    });
  }

  console.log('Writing header...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Locales!A1:D1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['nombre', 'apellido', 'telefono', 'fecha_registro']],
    },
  });

  // Also update Inventario header to include new columns
  console.log('Updating Inventario header with new columns...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Inventario!N1:O1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['tipo_precio', 'cliente_tel']],
    },
  });

  console.log('Done! Locales sheet created + Inventario columns N-O added.');
}

main().catch(console.error);
