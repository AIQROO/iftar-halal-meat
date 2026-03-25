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

  // Check if Usuarios sheet exists, create if not
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];

  if (!sheetNames.includes('Usuarios')) {
    console.log('Creating "Usuarios" sheet...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: 'Usuarios' } },
        }],
      },
    });
  }

  const header = ['nombre', 'pin', 'rol'];
  const users = [
    ['Noe', '1234', 'admin'],
    ['Mauricio', '5678', 'admin'],
    ['FK', '0000', 'pos'],
  ];

  console.log('Writing users...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Usuarios!A1:C${users.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [header, ...users],
    },
  });

  console.log(`Done! ${users.length} users written to Usuarios sheet.`);
}

main().catch(console.error);
