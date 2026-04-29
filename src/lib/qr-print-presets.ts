/**
 * Medidas de etiqueta para impresión en navegador (@page y celdas en mm).
 * Son guías: el usuario puede afinar en el diálogo del sistema según su rollo.
 */

export type QrPrintPreset = {
  id: string;
  /** Texto visible en el selector */
  label: string;
  widthMm: number;
  heightMm: number;
  /** Lado aproximado del módulo QR en mm */
  qrSizeMm: number;
  /** Margen interior de la celda en mm */
  paddingMm: number;
};

/** Orden: Ribetec RT-420BE TD01 primero (opción por defecto en la UI). */
export const QR_PRINT_PRESETS: QrPrintPreset[] = [
  {
    id: 'ribetec-td01-76x51',
    label: 'Ribetec RT-420BE — TD01 76 × 51 mm',
    widthMm: 76,
    heightMm: 51,
    qrSizeMm: 40,
    paddingMm: 3,
  },
  {
    id: 'shipping-2x4in',
    label: 'Térmica 2 × 4 in (51 × 102 mm)',
    widthMm: 51,
    heightMm: 102,
    qrSizeMm: 38,
    paddingMm: 3,
  },
  {
    id: 'shipping-4x6in',
    label: 'Térmica 4 × 6 in (102 × 152 mm)',
    widthMm: 102,
    heightMm: 152,
    qrSizeMm: 70,
    paddingMm: 4,
  },
];

export const QR_PRINT_DEFAULT_PRESET_ID = QR_PRINT_PRESETS[0].id;

export function getQrPrintPresetById(
  id: string | null | undefined
): QrPrintPreset | undefined {
  if (!id) return undefined;
  return QR_PRINT_PRESETS.find((p) => p.id === id);
}
