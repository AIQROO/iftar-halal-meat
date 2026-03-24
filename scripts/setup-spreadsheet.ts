import { google } from 'googleapis';

async function setupSpreadsheet() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID!;

  console.log('Setting up spreadsheet...');

  // Get existing sheets
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
  console.log('Existing sheets:', existingSheets);

  const requests: any[] = [];

  // Add "Precios" sheet if not exists
  if (!existingSheets.includes('Precios')) {
    requests.push({
      addSheet: {
        properties: { title: 'Precios' }
      }
    });
  }

  // Add "Inventario" sheet if not exists
  if (!existingSheets.includes('Inventario')) {
    requests.push({
      addSheet: {
        properties: { title: 'Inventario' }
      }
    });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
    console.log('Created sheets:', requests.map(r => r.addSheet?.properties?.title));
  }

  // Set up Precios headers and initial data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Precios!A1:B3',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['tipo_carne', 'precio_por_kg'],
        ['Pollo', 100],
        ['Res', 100],
      ]
    }
  });
  console.log('Precios sheet populated: Pollo $100/kg, Res $100/kg');

  // Set up Inventario headers
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Inventario!A1:L1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['qr_id', 'tipo_carne', 'peso_kg', 'precio_kg', 'precio_total', 'estatus', 'fecha_registro', 'hora_registro', 'fecha_venta', 'hora_venta', 'vendido_por', 'notas']
      ]
    }
  });
  console.log('Inventario sheet headers set');

  console.log('Spreadsheet setup complete!');
}

setupSpreadsheet().catch(console.error);
