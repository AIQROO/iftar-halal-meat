'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getQrPrintPresetById,
  QR_PRINT_DEFAULT_PRESET_ID,
  type QrPrintPreset,
} from '@/lib/qr-print-presets';
import {
  formatQrSerieId,
  QR_SERIE_MAX_TOTAL,
  QR_SERIE_WARN_FROM,
} from '@/lib/qr-serie';

type LabelRow = { id: string; dataUrl: string };

/** Evita doble window.print() en React 18 Strict Mode (mismo trabajo). */
function tryPrintOnce(jobKey: string): boolean {
  const w = window as Window & { __iftarQrPrintGuard?: string };
  if (w.__iftarQrPrintGuard === jobKey) {
    return false;
  }
  w.__iftarQrPrintGuard = jobKey;
  window.print();
  return true;
}

export default function QrPrintView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [phase, setPhase] = useState<'idle' | 'generating' | 'ready' | 'error'>(
    'idle'
  );
  const [progress, setProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [message, setMessage] = useState('');

  const inicio = useMemo(() => {
    const n = parseInt(searchParams.get('inicio') ?? '', 10);
    return Number.isFinite(n) ? n : NaN;
  }, [searchParams]);

  const hasta = useMemo(() => {
    const n = parseInt(searchParams.get('hasta') ?? '', 10);
    return Number.isFinite(n) ? n : NaN;
  }, [searchParams]);

  const preset = useMemo((): QrPrintPreset => {
    const id = searchParams.get('preset') ?? QR_PRINT_DEFAULT_PRESET_ID;
    return getQrPrintPresetById(id) ?? getQrPrintPresetById(QR_PRINT_DEFAULT_PRESET_ID)!;
  }, [searchParams]);

  const rangeTotal =
    Number.isFinite(inicio) &&
    Number.isFinite(hasta) &&
    hasta >= inicio &&
    inicio >= 1
      ? hasta - inicio + 1
      : 0;

  const scheduleAutoPrint = useCallback((jobKey: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          tryPrintOnce(jobKey);
        }, 200);
      });
    });
  }, []);

  useEffect(() => {
    const styleId = 'qr-print-dynamic-page-style';
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = `
      @page {
        size: ${preset.widthMm}mm ${preset.heightMm}mm;
        margin: 0;
      }
      @media print {
        html, body {
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        /* El layout del admin envuelve esta vista; al imprimir no queremos
           ni la barra inferior fija ni los paddings del shell. */
        body > div > nav,
        body > div > main > .qr-print-chrome,
        .qr-print-chrome {
          display: none !important;
        }
        body > div,
        body > div > main {
          padding: 0 !important;
          margin: 0 !important;
          min-height: 0 !important;
        }
        .qr-print-root {
          padding: 0 !important;
          margin: 0 !important;
          min-height: 0 !important;
        }
        .qr-print-sheet {
          padding: 0 !important;
          margin: 0 !important;
        }
      }
    `;
    return () => {
      el?.remove();
    };
  }, [preset.widthMm, preset.heightMm]);

  useEffect(() => {
    const storedName = localStorage.getItem('user_name');
    if (!storedName) {
      router.replace('/admin');
      return;
    }

    if (
      !Number.isFinite(inicio) ||
      !Number.isFinite(hasta) ||
      inicio < 1 ||
      hasta < inicio ||
      rangeTotal > QR_SERIE_MAX_TOTAL
    ) {
      router.replace('/admin/qr-generate');
      return;
    }

    let cancelled = false;

    async function run() {
      setPhase('generating');
      setLabels([]);
      setProgress(0);
      setTotalCount(rangeTotal);
      setMessage('');

      if (rangeTotal >= QR_SERIE_WARN_FROM) {
        setMessage(
          `Generando ${rangeTotal} etiquetas; puede tardar un poco…`
        );
      }

      try {
        const QRCode = (await import('qrcode')).default;
        // ~203 dpi: mm a píxeles aproximados para el PNG del QR
        const px = Math.max(
          128,
          Math.round(preset.qrSizeMm * (203 / 25.4))
        );

        const next: LabelRow[] = [];
        const batch = 24;

        for (let n = inicio; n <= hasta; n += 1) {
          if (cancelled) return;

          const id = formatQrSerieId(n);
          const dataUrl = await QRCode.toDataURL(id, {
            width: px,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' },
          });

          next.push({ id, dataUrl });

          if (next.length % batch === 0 || n === hasta) {
            setLabels([...next]);
            setProgress(n - inicio + 1);
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => resolve());
            });
          }
        }

        if (cancelled) return;

        setPhase('ready');
        const jobKey = `${inicio}-${hasta}-${preset.id}`;
        scheduleAutoPrint(jobKey);
      } catch {
        if (!cancelled) {
          setPhase('error');
          setMessage('No se pudieron generar los códigos. Intenta de nuevo.');
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    inicio,
    hasta,
    preset.id,
    preset.qrSizeMm,
    rangeTotal,
    router,
    scheduleAutoPrint,
  ]);

  const handleReprint = () => {
    const jobKey = `${inicio}-${hasta}-${preset.id}-${Date.now()}`;
    tryPrintOnce(jobKey);
  };

  return (
    <div className="qr-print-root min-h-screen bg-gray-950 text-white pb-24">
      <div className="qr-print-chrome sticky top-0 z-20 bg-gray-900/95 border-b border-gray-800 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => router.push('/admin/qr-generate')}
            className="text-sm text-gray-400 hover:text-white shrink-0"
          >
            ← Volver
          </button>
          <span className="text-xs text-gray-500 truncate text-right">
            {preset.label}
          </span>
        </div>
        {phase === 'generating' && (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-150"
                style={{
                  width: `${totalCount ? (progress / totalCount) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-400">
              Preparando {progress} / {totalCount}…
            </p>
          </div>
        )}
        {phase === 'ready' && (
          <div className="flex flex-wrap gap-2 items-center">
            <p className="text-xs text-emerald-400 flex-1 min-w-[12rem]">
              Listo. Si no vio el diálogo del sistema, pulse Imprimir.
            </p>
            <button
              type="button"
              onClick={handleReprint}
              className="text-sm font-semibold px-3 py-2 rounded-lg bg-amber-500 text-gray-950 hover:bg-amber-400"
            >
              Imprimir de nuevo
            </button>
          </div>
        )}
        {phase === 'error' && (
          <p className="text-sm text-red-400">{message}</p>
        )}
        {message && phase === 'generating' && rangeTotal >= QR_SERIE_WARN_FROM && (
          <p className="text-xs text-amber-200/90">{message}</p>
        )}
      </div>

      <div className="qr-print-sheet bg-white text-black print:bg-white px-2 py-4 print:py-0">
        <div className="mx-auto max-w-[120mm]">
          {labels.map((row, index) => (
            <div
              key={row.id}
              className="flex flex-col items-center justify-center box-border border border-dashed border-gray-300 print:border-0 mx-auto"
              style={{
                width: `${preset.widthMm}mm`,
                height: `${preset.heightMm}mm`,
                padding: `${preset.paddingMm}mm`,
                pageBreakAfter:
                  index < labels.length - 1 ? 'always' : 'auto',
                breakAfter: index < labels.length - 1 ? 'page' : 'auto',
              }}
            >
              <img
                src={row.dataUrl}
                alt=""
                width={Math.round(preset.qrSizeMm * (203 / 25.4))}
                height={Math.round(preset.qrSizeMm * (203 / 25.4))}
                style={{
                  width: `${preset.qrSizeMm}mm`,
                  height: `${preset.qrSizeMm}mm`,
                  objectFit: 'contain',
                }}
              />
              <span
                className="font-mono text-black mt-1"
                style={{ fontSize: '2.8mm', lineHeight: 1.1 }}
              >
                {row.id}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
