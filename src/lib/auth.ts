import { getSheets } from './sheets';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1NWuW5i-ExtqAKjhuLEMeoxz9muh-Lybe9KS5MDXdC28';

export interface User {
  name: string;
  pin: string;
  role: 'admin' | 'pos';
}

async function fetchUsers(): Promise<User[]> {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Usuarios!A2:C',
  });

  const rows = response.data.values || [];
  return rows
    .filter((row) => row[0] && row[1] && row[2])
    .map((row) => ({
      name: row[0],
      pin: String(row[1]),
      role: (row[2] === 'admin' ? 'admin' : 'pos') as 'admin' | 'pos',
    }));
}

export async function authenticateUser(name: string, pin: string): Promise<User | null> {
  const users = await fetchUsers();
  return users.find((u) => u.name === name && u.pin === pin) || null;
}

export async function getUsers(): Promise<{ name: string; role: string }[]> {
  const users = await fetchUsers();
  return users.map((u) => ({ name: u.name, role: u.role }));
}

export async function getUserFromRequest(request: Request): Promise<User | null> {
  const userName = request.headers.get('x-user-name');
  const userPin = request.headers.get('x-user-pin');
  if (!userName || !userPin) return null;
  return authenticateUser(userName, userPin);
}

export async function isAdmin(request: Request): Promise<boolean> {
  const user = await getUserFromRequest(request);
  return user?.role === 'admin';
}
