'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/types';

type RangePreset = 'hoy' | 'semana' | 'mes' | 'custom';

interface SalesSummary {
  totalVentas: number;
  ingresoTotal: number;
  ventasNormal: number;
  ingresoNormal: number;
  ventasLocal: number;
  ingresoLocal: number;
  porProducto: { nombre: string; cantidad: number; ingreso: number }[];
  porVendedor: { nombre: string; cantidad: number; ingreso: number }[];
  porDia: { fecha: string; cantidad: number; ingreso: number }[];
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Support DD/MM/YYYY format from es-MX locale
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  return null;
}

function formatDateInput(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatMoney(n: number): string {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReportesPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preset, setPreset] = useState<RangePreset>('mes');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('porDia');

  useEffect(() => {
    const storedName = localStorage.getItem('user_name');
    if (!storedName) {
      router.replace('/admin');
      return;
    }

    // Set default dates
    const now = new Date();
    const to = formatDateInput(now);
    setDateTo(to);
    applyPreset('mes', now);

    fetchData();
  }, [router]);

  const applyPreset = (p: RangePreset, refDate?: Date) => {
    const now = refDate || new Date();
    setPreset(p);
    if (p === 'hoy') {
      const today = formatDateInput(now);
      setDateFrom(today);
      setDateTo(today);
    } else if (p === 'semana') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      setDateFrom(formatDateInput(weekAgo));
      setDateTo(formatDateInput(now));
    } else if (p === 'mes') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(formatDateInput(monthStart));
      setDateTo(formatDateInput(now));
    }
  };

  const fetchData = async () => {
    try {
      const name = localStorage.getItem('user_name') || '';
      const pin = localStorage.getItem('user_pin') || '';
      const res = await fetch('/api/dashboard', {
        headers: { 'x-user-name': name, 'x-user-pin': pin },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts(data.productos || []);
    } catch {
      setError('No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo<SalesSummary>(() => {
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;

    const sold = products.filter((p) => {
      if (p.estatus !== 'Vendido') return false;
      const saleDate = parseDate(p.fecha_venta || '');
      if (!saleDate) return false;
      if (from && saleDate < from) return false;
      if (to && saleDate > to) return false;
      return true;
    });

    const ventasNormal = sold.filter((p) => p.tipo_precio !== 'Local');
    const ventasLocal = sold.filter((p) => p.tipo_precio === 'Local');

    // Group by product
    const prodMap = new Map<string, { cantidad: number; ingreso: number }>();
    for (const p of sold) {
      const key = p.tipo_carne;
      const cur = prodMap.get(key) || { cantidad: 0, ingreso: 0 };
      cur.cantidad += 1;
      cur.ingreso += p.precio_total;
      prodMap.set(key, cur);
    }
    const porProducto = Array.from(prodMap.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.ingreso - a.ingreso);

    // Group by vendor
    const vendMap = new Map<string, { cantidad: number; ingreso: number }>();
    for (const p of sold) {
      const key = p.vendido_por || 'Sin vendedor';
      const cur = vendMap.get(key) || { cantidad: 0, ingreso: 0 };
      cur.cantidad += 1;
      cur.ingreso += p.precio_total;
      vendMap.set(key, cur);
    }
    const porVendedor = Array.from(vendMap.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.ingreso - a.ingreso);

    // Group by day
    const dayMap = new Map<string, { cantidad: number; ingreso: number }>();
    for (const p of sold) {
      const key = p.fecha_venta || 'Sin fecha';
      const cur = dayMap.get(key) || { cantidad: 0, ingreso: 0 };
      cur.cantidad += 1;
      cur.ingreso += p.precio_total;
      dayMap.set(key, cur);
    }
    const porDia = Array.from(dayMap.entries())
      .map(([fecha, v]) => ({ fecha, ...v }))
      .sort((a, b) => {
        const da = parseDate(a.fecha);
        const db = parseDate(b.fecha);
        if (!da || !db) return 0;
        return db.getTime() - da.getTime();
      });

    return {
      totalVentas: sold.length,
      ingresoTotal: sold.reduce((s, p) => s + p.precio_total, 0),
      ventasNormal: ventasNormal.length,
      ingresoNormal: ventasNormal.reduce((s, p) => s + p.precio_total, 0),
      ventasLocal: ventasLocal.length,
      ingresoLocal: ventasLocal.reduce((s, p) => s + p.precio_total, 0),
      porProducto,
      porVendedor,
      porDia,
    };
  }, [products, dateFrom, dateTo]);

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-24">
      {/* Back button */}
      <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Volver
      </button>

      <h1 className="text-2xl font-bold text-white mb-1">Reportes de Ventas</h1>
      <p className="text-gray-500 text-sm mb-5">Resumen por rango de fechas</p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Date range presets */}
      <div className="flex gap-2 mb-3">
        {(['hoy', 'semana', 'mes', 'custom'] as RangePreset[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              if (p === 'custom') {
                setPreset('custom');
              } else {
                applyPreset(p);
              }
            }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              preset === p
                ? 'bg-amber-500 text-gray-950'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {p === 'hoy' ? 'Hoy' : p === 'semana' ? '7 dias' : p === 'mes' ? 'Mes' : 'Rango'}
          </button>
        ))}
      </div>

      {/* Date inputs */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPreset('custom'); }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPreset('custom'); }}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Ventas</p>
          <p className="text-2xl font-bold text-white">{summary.totalVentas}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Ingreso Total</p>
          <p className="text-2xl font-bold text-emerald-400">{formatMoney(summary.ingresoTotal)}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400/70 text-xs uppercase tracking-wider">Normal</p>
          <p className="text-lg font-bold text-green-400">{formatMoney(summary.ingresoNormal)}</p>
          <p className="text-green-400/50 text-xs">{summary.ventasNormal} ventas</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400/70 text-xs uppercase tracking-wider">Local</p>
          <p className="text-lg font-bold text-blue-400">{formatMoney(summary.ingresoLocal)}</p>
          <p className="text-blue-400/50 text-xs">{summary.ventasLocal} ventas</p>
        </div>
      </div>

      {/* Accordion sections */}
      <div className="flex flex-col gap-3">
        {/* By Day */}
        <AccordionSection
          title="Por Dia"
          count={summary.porDia.length}
          isExpanded={expandedSection === 'porDia'}
          onToggle={() => toggleSection('porDia')}
        >
          {summary.porDia.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Sin ventas en este rango</p>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {summary.porDia.map((d) => (
                <div key={d.fecha} className="flex items-center justify-between py-3 px-1">
                  <div>
                    <p className="text-white text-sm font-medium">{d.fecha}</p>
                    <p className="text-gray-500 text-xs">{d.cantidad} ventas</p>
                  </div>
                  <p className="text-emerald-400 font-semibold">{formatMoney(d.ingreso)}</p>
                </div>
              ))}
            </div>
          )}
        </AccordionSection>

        {/* By Product */}
        <AccordionSection
          title="Por Producto"
          count={summary.porProducto.length}
          isExpanded={expandedSection === 'porProducto'}
          onToggle={() => toggleSection('porProducto')}
        >
          {summary.porProducto.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Sin ventas en este rango</p>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {summary.porProducto.map((p) => (
                <div key={p.nombre} className="flex items-center justify-between py-3 px-1">
                  <div>
                    <p className="text-white text-sm font-medium">{p.nombre}</p>
                    <p className="text-gray-500 text-xs">{p.cantidad} unidades</p>
                  </div>
                  <p className="text-emerald-400 font-semibold">{formatMoney(p.ingreso)}</p>
                </div>
              ))}
            </div>
          )}
        </AccordionSection>

        {/* By Vendor */}
        <AccordionSection
          title="Por Vendedor"
          count={summary.porVendedor.length}
          isExpanded={expandedSection === 'porVendedor'}
          onToggle={() => toggleSection('porVendedor')}
        >
          {summary.porVendedor.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Sin ventas en este rango</p>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {summary.porVendedor.map((v) => (
                <div key={v.nombre} className="flex items-center justify-between py-3 px-1">
                  <div>
                    <p className="text-white text-sm font-medium">{v.nombre}</p>
                    <p className="text-gray-500 text-xs">{v.cantidad} ventas</p>
                  </div>
                  <p className="text-emerald-400 font-semibold">{formatMoney(v.ingreso)}</p>
                </div>
              ))}
            </div>
          )}
        </AccordionSection>
      </div>
    </div>
  );
}

function AccordionSection({
  title,
  count,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 bg-gray-900 border border-gray-800 transition-colors ${
          isExpanded ? 'rounded-t-xl border-b-0' : 'rounded-xl'
        }`}
      >
        <div className="flex items-center gap-2">
          <p className="text-white font-semibold text-sm">{title}</p>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="border border-gray-800 border-t-0 rounded-b-xl bg-gray-900/50 px-4">
          {children}
        </div>
      )}
    </div>
  );
}
