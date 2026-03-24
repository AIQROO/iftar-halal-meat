'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Product, DashboardStats } from '@/lib/types';

export default function HistorialPage() {
  const router = useRouter();
  const [ventas, setVentas] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedName = localStorage.getItem('user_name');
    const storedPin = localStorage.getItem('user_pin');
    if (!storedName || !storedPin) {
      router.replace('/pos');
      return;
    }

    async function fetchVentas() {
      try {
        const name = localStorage.getItem('user_name') || '';
        const pin = localStorage.getItem('user_pin') || '';
        const res = await fetch('/api/dashboard', {
          headers: { 'x-user-name': name, 'x-user-pin': pin },
        });
        if (!res.ok) {
          if (res.status === 401) {
            router.replace('/pos');
            return;
          }
          setError('Error al cargar datos');
          return;
        }
        const data: DashboardStats = await res.json();

        // Filter to today's sold products
        // fecha_venta is stored in es-MX locale format (DD/MM/YYYY)
        const now = new Date();
        const hoy = now.toLocaleDateString('es-MX', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const ventasHoy = data.productos.filter(
          (p) => p.estatus === 'Vendido' && p.fecha_venta === hoy
        );

        // Sort by most recent sale first
        ventasHoy.sort((a, b) => {
          const timeA = a.hora_venta || '';
          const timeB = b.hora_venta || '';
          return timeB.localeCompare(timeA);
        });

        setVentas(ventasHoy);
      } catch {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    }

    fetchVentas();
  }, [router]);

  const totalVentas = ventas.reduce((sum, p) => sum + p.precio_total, 0);
  const totalPeso = ventas.reduce((sum, p) => sum + p.peso_kg, 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col px-4 py-6">
        {/* Header */}
        <header className="flex items-center gap-4 mb-6">
          <Link
            href="/pos"
            className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Ventas del Día</h1>
            <p className="text-gray-400 text-sm">
              {new Date().toLocaleDateString('es-MX', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </header>

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-gray-700 border-t-green-500 rounded-full animate-spin" />
            <p className="text-gray-400">Cargando ventas...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-red-400 text-lg">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="min-h-14 bg-gray-800 hover:bg-gray-700 text-gray-300 text-lg font-semibold rounded-2xl px-8 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* No sales */}
        {!loading && !error && ventas.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-gray-600"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                />
              </svg>
            </div>
            <p className="text-gray-400 text-lg">No hay ventas hoy</p>
          </div>
        )}

        {/* Sales List */}
        {!loading && !error && ventas.length > 0 && (
          <>
            {/* Summary Card */}
            <div className="bg-gray-800 rounded-2xl p-5 mb-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-gray-400 text-xs">Productos</p>
                  <p className="text-xl font-bold">{ventas.length}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Peso Total</p>
                  <p className="text-xl font-bold">{totalPeso.toFixed(2)} kg</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Total</p>
                  <p className="text-xl font-bold text-green-400">
                    ${totalVentas.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3 pb-6">
              {ventas.map((venta) => (
                <div
                  key={venta.qr_id}
                  className="bg-gray-800 rounded-2xl p-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-base truncate">
                        {venta.tipo_carne}
                      </p>
                      <p className="text-green-400 font-bold text-base flex-shrink-0">
                        ${venta.precio_total.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                      <span className="font-mono text-xs">{venta.qr_id}</span>
                      <span>{venta.peso_kg.toFixed(2)} kg</span>
                      {venta.hora_venta && <span>{venta.hora_venta}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
