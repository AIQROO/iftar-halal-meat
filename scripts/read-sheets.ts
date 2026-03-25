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

  // List all sheets
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
  console.log('=== HOJAS ===');
  console.log(sheetNames.join(', '));

  // Read each sheet
  for (const name of sheetNames) {
    console.log(`\n=== ${name} ===`);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A1:Z`,
    });
    const rows = res.data.values || [];
    for (const row of rows.slice(0, 10)) {
      console.log(row.join(' | '));
    }
    if (rows.length > 10) console.log(`... (${rows.length} rows total)`);
  }
}

main().catch(console.error);
