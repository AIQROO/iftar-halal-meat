import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { searchLocalByPhone, registerLocal } from '@/lib/sheets';

// GET /api/locales?telefono=1234567890 - Search local customer by phone
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const telefono = searchParams.get('telefono');

    if (!telefono) {
      return NextResponse.json({ error: 'Missing telefono parameter' }, { status: 400 });
    }

    const customer = await searchLocalByPhone(telefono);

    if (customer) {
      return NextResponse.json({ found: true, customer }, { status: 200 });
    }

    return NextResponse.json({ found: false }, { status: 200 });
  } catch (error) {
    console.error('Error searching local:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/locales - Register new local customer
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { nombre, apellido, telefono } = body;

    if (!nombre || !apellido || !telefono) {
      return NextResponse.json(
        { error: 'Missing required fields: nombre, apellido, telefono' },
        { status: 400 }
      );
    }

    // Check if already exists
    const existing = await searchLocalByPhone(telefono);
    if (existing) {
      return NextResponse.json({ customer: existing, already_exists: true }, { status: 200 });
    }

    const customer = await registerLocal(nombre, apellido, telefono);
    return NextResponse.json({ customer, already_exists: false }, { status: 201 });
  } catch (error) {
    console.error('Error registering local:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
