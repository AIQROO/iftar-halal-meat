/**
 * Límites y formato de IDs de serie para etiquetas QR (admin).
 * Mantiene alineados cliente, API de ZIP y vista de impresión.
 */

/** Máximo de códigos por rango (descarga ZIP o cola de impresión en navegador). */
export const QR_SERIE_MAX_TOTAL = 5000;

/** A partir de cuántas piezas mostramos aviso de tiempo (solo UI). */
export const QR_SERIE_WARN_FROM = 500;

/**
 * Convierte el número de serie al ID legible (ej. 1 → "QR-001"). Es el
 * texto humano que va abajo del código y la clave en el spreadsheet.
 */
export function formatQrSerieId(num: number): string {
  return `QR-${String(num).padStart(3, '0')}`;
}

/**
 * URL que codifica el QR físico. Al escanear con la cámara del teléfono
 * abre la landing pública del producto.
 */
export function buildQrScanUrl(origin: string, id: string): string {
  const cleanOrigin = origin.replace(/\/$/, '');
  return `${cleanOrigin}/scan?id=${encodeURIComponent(id)}`;
}

/**
 * Convierte lo que devolvió el scanner (URL nueva o ID plano viejo) al ID
 * canónico del producto. Mantiene compatibilidad con QRs ya impresos.
 */
export function parseScannedQrPayload(payload: string): string {
  const trimmed = payload.trim();
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('id');
    if (fromQuery) return fromQuery;
  } catch {
    // No era una URL: tratamos como ID directo.
  }
  return trimmed;
}
