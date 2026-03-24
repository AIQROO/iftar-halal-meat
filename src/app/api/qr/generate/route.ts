import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import archiver from 'archiver';
import { PassThrough } from 'stream';

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

    // Generate QR codes and add to archive
    for (let i = 0; i < cantidad; i++) {
      const num = inicio + i;
      const qrId = `QR-${String(num).padStart(3, '0')}`;
      const qrBuffer = await QRCode.toBuffer(qrId, {
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
