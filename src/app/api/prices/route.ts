import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getPricesGrouped, updatePrice } from '@/lib/sheets';

export async function GET() {
  try {
    const categories = await getPricesGrouped();
    return NextResponse.json(categories, { status: 200 });
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { nombre, precio_mxn, precio_local } = body;

    if (!nombre) {
      return NextResponse.json(
        { error: 'Missing required field: nombre' },
        { status: 400 }
      );
    }

    if (precio_mxn === undefined && precio_local === undefined) {
      return NextResponse.json(
        { error: 'Must provide at least one price to update' },
        { status: 400 }
      );
    }

    await updatePrice(nombre, precio_mxn, precio_local);

    return NextResponse.json(
      { success: true, message: 'Price updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating price:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
