import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import {
  buildQrScanUrl,
  formatQrSerieId,
  QR_SERIE_MAX_TOTAL,
} from '@/lib/qr-serie';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cantidad, inicio = 1 } = body;

    if (!cantidad || cantidad < 1) {
      return NextResponse.json(
        { error: 'Missing or invalid required field: cantidad' },
        { status: 400 }
      );
    }

    if (cantidad > QR_SERIE_MAX_TOTAL) {
      return NextResponse.json(
        {
          error: `La cantidad no puede superar ${QR_SERIE_MAX_TOTAL} por solicitud`,
        },
        { status: 400 }
      );
    }

    const startNum = typeof inicio === 'number' ? inicio : parseInt(String(inicio), 10);
    if (!Number.isFinite(startNum) || startNum < 1) {
      return NextResponse.json(
        { error: 'inicio debe ser un entero mayor o igual a 1' },
        { status: 400 }
      );
    }

    // Create a ZIP archive in memory
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();

    passthrough.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(passthrough);

    // Set up the end/error promise BEFORE generating data to avoid
    // a race condition where the stream ends before the listener is attached.
    const streamDone = new Promise<void>((resolve, reject) => {
      passthrough.on('end', resolve);
      passthrough.on('error', reject);
      archive.on('error', reject);
    });

    const origin = new URL(request.url).origin;

    // Generar PNG en memoria (rangos muy grandes pueden tardar o consumir RAM).
    for (let i = 0; i < cantidad; i++) {
      const num = startNum + i;
      const qrId = formatQrSerieId(num);
      const scanUrl = buildQrScanUrl(origin, qrId);
      const qrBuffer = await QRCode.toBuffer(scanUrl, {
        type: 'png',
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      archive.append(qrBuffer, { name: `${qrId}.png` });
    }

    await archive.finalize();

    // Wait for all data to be collected
    await streamDone;

    const zipBuffer = Buffer.concat(chunks);

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="qr-codes.zip"',
      },
    });
  } catch (error) {
    console.error('Error generating QR codes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
