'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, PriceCategory, Price } from '@/lib/types';
import QrScanner from '@/components/QrScanner';
import { parseScannedQrPayload } from '@/lib/qr-serie';

type RegisterStep = 'scan' | 'form' | 'success';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<RegisterStep>('scan');
  const [qrId, setQrId] = useState('');
  const [tipoCarne, setTipoCarne] = useState('');
  const [pesoKg, setPesoKg] = useState('');
  const [categories, setCategories] = useState<PriceCategory[]>([]);
  const [allPrices, setAllPrices] = useState<Price[]>([]);
  const [registeredProduct, setRegisteredProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [userPin, setUserPin] = useState('');

  useEffect(() => {
    const storedName = localStorage.getItem('user_name');
    if (!storedName) {
      router.replace('/admin');
      return;
    }
    setUserName(storedName);
    setUserPin(localStorage.getItem('user_pin') || '');
    fetchPrices();
  }, [router]);

  const fetchPrices = async () => {
    try {
      const name = localStorage.getItem('user_name') || '';
      const pin = localStorage.getItem('user_pin') || '';
      const res = await fetch('/api/prices', {
        headers: { 'x-user-name': name, 'x-user-pin': pin },
      });
      if (res.ok) {
        const data: PriceCategory[] = await res.json();
        setCategories(data);
        // Flatten all prices for lookup
        const flat = data.flatMap((cat) => cat.productos);
        setAllPrices(flat);
        if (flat.length > 0) {
          setTipoCarne(flat[0].nombre);
        }
      }
    } catch {
      // Prices will remain empty; user can still type
    }
  };

  const getSelectedPrice = (): Price | undefined => {
    return allPrices.find((p) => p.nombre === tipoCarne);
  };

  const getEffectivePrice = (): number => {
    const p = getSelectedPrice();
    if (!p) return 0;
    return p.precio_local > 0 ? p.precio_local : p.precio_mxn;
  };

  const handleScan = (result: string) => {
    setQrId(parseScannedQrPayload(result));
    setError('');
    setStep('form');
  };

  const handleScanError = (scanError: string) => {
    setError(scanError);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!qrId || !tipoCarne || !pesoKg) {
      setError('Todos los campos son obligatorios');
      return;
    }

    const peso = parseFloat(pesoKg);
    if (isNaN(peso) || peso <= 0) {
      setError('El peso debe ser un numero positivo');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/product/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-name': userName,
          'x-user-pin': userPin,
        },
        body: JSON.stringify({
          qr_id: qrId,
          tipo_carne: tipoCarne,
          peso_kg: peso,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al registrar producto');
        return;
      }

      setRegisteredProduct(data);
      setStep('success');
    } catch {
      setError('Error de conexion. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('scan');
    setQrId('');
    setTipoCarne(allPrices.length > 0 ? allPrices[0].nombre : '');
    setPesoKg('');
    setRegisteredProduct(null);
    setError('');
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Back button */}
      <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Volver
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">Registrar Producto</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Step: Scan */}
      {step === 'scan' && (
        <div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="p-4 border-b border-gray-800">
              <p className="text-gray-300 text-sm text-center">
                Escanea el codigo QR del producto
              </p>
            </div>
            <div className="aspect-square bg-black">
              <QrScanner onScan={handleScan} onError={handleScanError} />
            </div>
          </div>

          {/* Manual entry fallback */}
          <div className="mt-4">
            <p className="text-gray-500 text-xs text-center mb-2">
              O ingresa el ID manualmente
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="QR-001"
                value={qrId}
                onChange={(e) => setQrId(e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (qrId.trim()) {
                    setStep('form');
                    setError('');
                  }
                }}
                disabled={!qrId.trim()}
                className="px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Form */}
      {step === 'form' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* QR ID (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              QR ID
            </label>
            <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 font-mono text-amber-500 font-semibold">
              {qrId}
            </div>
          </div>

          {/* Tipo de carne - grouped by category */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Producto
            </label>
            <select
              value={tipoCarne}
              onChange={(e) => setTipoCarne(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 appearance-none"
            >
              {categories.map((cat) => (
                <optgroup key={cat.categoria} label={cat.categoria}>
                  {cat.productos.map((p) => {
                    const effectivePrice = p.precio_local > 0 ? p.precio_local : p.precio_mxn;
                    return (
                      <option key={p.nombre} value={p.nombre}>
                        {p.nombre} - ${effectivePrice}/{p.unidad}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Peso */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Peso (kg)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Price preview */}
          {pesoKg && tipoCarne && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <p className="text-amber-400 text-sm">
                  Precio estimado:
                </p>
                <span className="font-bold text-lg text-amber-400">
                  ${(parseFloat(pesoKg) * getEffectivePrice()).toFixed(2)}
                </span>
              </div>
              {getSelectedPrice() && (
                <p className="text-gray-500 text-xs mt-1">
                  {getSelectedPrice()!.nombre} &middot; ${getEffectivePrice()}/{getSelectedPrice()!.unidad}
                </p>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 min-h-12 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 min-h-12 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-gray-950 font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Registrando...
                </span>
              ) : (
                'Registrar'
              )}
            </button>
          </div>
        </form>
      )}

      {/* Step: Success */}
      {step === 'success' && registeredProduct && (
        <div className="flex flex-col gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-emerald-400 mb-1">
              Producto Registrado
            </h2>
            <p className="text-gray-400 text-sm">
              Registrado por <span className="text-white font-medium">{userName}</span>
            </p>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            <div className="flex justify-between items-center p-4">
              <span className="text-gray-400 text-sm">QR ID</span>
              <span className="font-mono font-semibold text-amber-500">
                {registeredProduct.qr_id}
              </span>
            </div>
            <div className="flex justify-between items-center p-4">
              <span className="text-gray-400 text-sm">Producto</span>
              <span className="text-white font-medium">
                {registeredProduct.tipo_carne}
              </span>
            </div>
            <div className="flex justify-between items-center p-4">
              <span className="text-gray-400 text-sm">Peso</span>
              <span className="text-white font-medium">
                {registeredProduct.peso_kg} kg
              </span>
            </div>
            <div className="flex justify-between items-center p-4">
              <span className="text-gray-400 text-sm">Precio/kg</span>
              <span className="text-white font-medium">
                ${registeredProduct.precio_kg.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center p-4">
              <span className="text-gray-400 text-sm">Precio Total</span>
              <span className="text-xl font-bold text-emerald-400">
                ${registeredProduct.precio_total.toFixed(2)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="w-full min-h-14 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-gray-950 font-bold text-lg transition-colors"
          >
            Escanear Otro
          </button>
        </div>
      )}
    </div>
  );
}
