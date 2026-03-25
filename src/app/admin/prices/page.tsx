'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { PriceCategory, Price } from '@/lib/types';

interface EditablePrice extends Price {
  saving?: boolean;
  saved?: boolean;
}

export default function PricesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ categoria: string; productos: EditablePrice[] }[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [userPin, setUserPin] = useState('');
  const [toast, setToast] = useState('');

  const fetchPrices = useCallback(async () => {
    try {
      const name = localStorage.getItem('user_name') || '';
      const pin = localStorage.getItem('user_pin') || '';
      const res = await fetch('/api/prices', {
        headers: { 'x-user-name': name, 'x-user-pin': pin },
      });
      if (!res.ok) throw new Error();
      const data: PriceCategory[] = await res.json();
      setCategories(data.map((cat) => ({
        categoria: cat.categoria,
        productos: cat.productos.map((p) => ({ ...p })),
      })));
      // Expand first category by default
      if (data.length > 0 && expandedCats.size === 0) {
        setExpandedCats(new Set([data[0].categoria]));
      }
    } catch {
      setError('No se pudieron cargar los precios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedName = localStorage.getItem('user_name');
    if (!storedName) {
      router.replace('/admin');
      return;
    }
    setUserName(storedName);
    setUserPin(localStorage.getItem('user_pin') || '');
    fetchPrices();
  }, [router, fetchPrices]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const toggleCategory = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handlePriceChange = (catIndex: number, prodIndex: number, field: 'precio_mxn' | 'precio_local', value: string) => {
    setCategories((prev) => {
      const updated = [...prev];
      const cat = { ...updated[catIndex] };
      const prods = [...cat.productos];
      prods[prodIndex] = { ...prods[prodIndex], [field]: parseFloat(value) || 0, saved: false };
      cat.productos = prods;
      updated[catIndex] = cat;
      return updated;
    });
  };

  const handleSave = async (catIndex: number, prodIndex: number) => {
    const product = categories[catIndex].productos[prodIndex];
    setError('');

    setCategories((prev) => {
      const updated = [...prev];
      const cat = { ...updated[catIndex] };
      const prods = [...cat.productos];
      prods[prodIndex] = { ...prods[prodIndex], saving: true };
      cat.productos = prods;
      updated[catIndex] = cat;
      return updated;
    });

    try {
      const res = await fetch('/api/prices', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-name': userName,
          'x-user-pin': userPin,
        },
        body: JSON.stringify({
          nombre: product.nombre,
          precio_mxn: product.precio_mxn,
          precio_local: product.precio_local,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al guardar');
      }

      setCategories((prev) => {
        const updated = [...prev];
        const cat = { ...updated[catIndex] };
        const prods = [...cat.productos];
        prods[prodIndex] = { ...prods[prodIndex], saving: false, saved: true };
        cat.productos = prods;
        updated[catIndex] = cat;
        return updated;
      });
      showToast(`"${product.nombre}" guardado`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar precio');
      setCategories((prev) => {
        const updated = [...prev];
        const cat = { ...updated[catIndex] };
        const prods = [...cat.productos];
        prods[prodIndex] = { ...prods[prodIndex], saving: false };
        cat.productos = prods;
        updated[catIndex] = cat;
        return updated;
      });
    }
  };

  const handleSeed = async () => {
    if (!confirm('Esto reemplazara todos los precios actuales con el catalogo completo. Continuar?')) return;
    setSeeding(true);
    setError('');
    try {
      const res = await fetch('/api/prices/seed', {
        method: 'POST',
        headers: {
          'x-user-name': userName,
          'x-user-pin': userPin,
        },
      });
      if (!res.ok) throw new Error('Error al poblar precios');
      const data = await res.json();
      showToast(`${data.count} productos cargados`);
      await fetchPrices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al poblar precios');
    } finally {
      setSeeding(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    if (cat.includes('Pollo')) return 'chicken';
    if (cat.includes('Cordero')) return 'lamb';
    if (cat.includes('Black Angus')) return 'angus';
    if (cat.includes('Premium') || cat.includes('Prime')) return 'premium';
    if (cat.includes('Especial')) return 'special';
    return 'beef';
  };

  const getCategoryColor = (cat: string) => {
    if (cat.includes('Pollo')) return 'amber';
    if (cat.includes('Cordero')) return 'orange';
    if (cat.includes('Black Angus')) return 'purple';
    if (cat.includes('Premium') || cat.includes('Prime')) return 'rose';
    if (cat.includes('Especial')) return 'teal';
    return 'red';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400">Cargando precios...</p>
        </div>
      </div>
    );
  }

  const totalProducts = categories.reduce((sum, cat) => sum + cat.productos.length, 0);

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-24">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-lg font-medium text-sm animate-fade-in">
          {toast}
        </div>
      )}

      {/* Back button */}
      <button onClick={() => router.push('/admin/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Volver
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">Precios</h1>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-lg">
          {totalProducts} productos
        </span>
      </div>
      <p className="text-gray-500 text-sm mb-5">
        Toca una categoria para ver y editar precios
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* No data - seed button */}
      {categories.length === 0 && (
        <div className="bg-gray-900 rounded-xl p-8 text-center border border-gray-800 mb-4">
          <p className="text-gray-500 mb-4">No hay productos configurados</p>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold transition-colors disabled:opacity-40"
          >
            {seeding ? 'Cargando catalogo...' : 'Cargar Catalogo Completo'}
          </button>
        </div>
      )}

      {/* Category Accordions */}
      <div className="flex flex-col gap-3">
        {categories.map((cat, catIndex) => {
          const isExpanded = expandedCats.has(cat.categoria);
          const color = getCategoryColor(cat.categoria);
          const icon = getCategoryIcon(cat.categoria);
          const colorClasses: Record<string, { bg: string; text: string; border: string; badge: string }> = {
            amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', badge: 'bg-amber-500/20' },
            red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', badge: 'bg-red-500/20' },
            rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', badge: 'bg-rose-500/20' },
            purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', badge: 'bg-purple-500/20' },
            orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', badge: 'bg-orange-500/20' },
            teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20', badge: 'bg-teal-500/20' },
          };
          const c = colorClasses[color] || colorClasses.red;

          return (
            <div key={cat.categoria} className="rounded-xl overflow-hidden">
              {/* Category header - tap to expand */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.categoria)}
                className={`w-full flex items-center justify-between p-4 ${c.bg} border ${c.border} ${isExpanded ? 'rounded-t-xl border-b-0' : 'rounded-xl'} transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${c.text}`}>
                    {icon === 'chicken' && '\u{1F414}'}
                    {icon === 'beef' && '\u{1F969}'}
                    {icon === 'premium' && '\u{2B50}'}
                    {icon === 'angus' && '\u{1F404}'}
                    {icon === 'lamb' && '\u{1F411}'}
                    {icon === 'special' && '\u{1F354}'}
                  </span>
                  <div className="text-left">
                    <p className={`font-semibold ${c.text}`}>{cat.categoria}</p>
                    <p className="text-gray-500 text-xs">{cat.productos.length} productos</p>
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 ${c.text} transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Products list */}
              {isExpanded && (
                <div className={`border ${c.border} border-t-0 rounded-b-xl bg-gray-900/50 divide-y divide-gray-800/50`}>
                  {cat.productos.map((product, prodIndex) => (
                    <div key={product.nombre} className="p-4">
                      {/* Product name */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-white font-medium text-sm">{product.nombre}</p>
                          <p className="text-gray-500 text-xs">{product.nombre_en} &middot; {product.unidad}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSave(catIndex, prodIndex)}
                          disabled={product.saving}
                          className={`min-h-8 px-3 rounded-lg font-semibold text-xs transition-colors disabled:opacity-40 ${
                            product.saved
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500 hover:bg-amber-400 text-gray-950'
                          }`}
                        >
                          {product.saving ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : product.saved ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            'Guardar'
                          )}
                        </button>
                      </div>

                      {/* Price inputs side by side */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wider">
                            Precio MXN
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={product.precio_mxn || ''}
                              onChange={(e) => handlePriceChange(catIndex, prodIndex, 'precio_mxn', e.target.value)}
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-6 pr-2 py-2 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wider">
                            Precio Local
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={product.precio_local || ''}
                              onChange={(e) => handlePriceChange(catIndex, prodIndex, 'precio_local', e.target.value)}
                              placeholder="--"
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-6 pr-2 py-2 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-gray-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Seed button at bottom if data exists */}
      {categories.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="w-full min-h-12 rounded-xl border-2 border-dashed border-gray-700 hover:border-red-500/50 text-gray-500 hover:text-red-400 font-medium text-sm transition-colors disabled:opacity-40"
          >
            {seeding ? 'Recargando catalogo...' : 'Recargar Catalogo (reemplaza todo)'}
          </button>
        </div>
      )}
    </div>
  );
}
