import { NextResponse } from 'next/server';
import { authenticateUser, getUsers } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, pin } = body;

    if (!name || !pin) {
      return NextResponse.json({ error: 'Missing required fields: name, pin' }, { status: 400 });
    }

    const user = await authenticateUser(name, pin);

    if (user) {
      return NextResponse.json(
        { success: true, user: { name: user.name, role: user.role } },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: false }, { status: 200 });
  } catch (error) {
    console.error('Error validating auth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const users = await getUsers();
    return NextResponse.json(users, { status: 200 });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
