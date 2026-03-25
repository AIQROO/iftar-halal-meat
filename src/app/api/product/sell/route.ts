import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { markSold } from '@/lib/sheets';

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { qr_id, vendido_por, tipo_precio, cliente_tel } = body;

    if (!qr_id) {
      return NextResponse.json({ error: 'Missing required field: qr_id' }, { status: 400 });
    }

    const seller = vendido_por || user.name;
    await markSold(qr_id, seller, tipo_precio, cliente_tel);

    return NextResponse.json({ success: true, message: 'Product marked as sold' }, { status: 200 });
  } catch (error) {
    console.error('Error marking product as sold:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
