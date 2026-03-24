'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Product } from '@/lib/types';

// Dynamically import QrScanner - renders fallback if not available
const QrScanner = dynamic(() => import('@/components/QrScanner'), {
  ssr: false,
  loading: () => null,
});

type ViewState = 'idle' | 'scanning' | 'loading' | 'product' | 'sold' | 'error';

interface AuthUser {
  name: string;
  role: string;
}

export default function POSPage() {
  const [view, setView] = useState<ViewState>('idle');
  const [product, setProduct] = useState<Product | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [selling, setSelling] = useState(false);
  const [scannerAvailable, setScannerAvailable] = useState<boolean | null>(null);

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check existing login on mount
  useEffect(() => {
    const storedName = localStorage.getItem('user_name');
    const storedPin = localStorage.getItem('user_pin');
    const storedRole = localStorage.getItem('user_role');
    if (storedName && storedPin && storedRole) {
      setUserName(storedName);
      setUserRole(storedRole);
      setIsLoggedIn(true);
    }
    setCheckingAuth(false);
  }, []);

  // Fetch users for login dropdown
  useEffect(() => {
    if (!isLoggedIn && !checkingAuth) {
      fetch('/api/auth')
        .then((res) => res.json())
        .then((data: AuthUser[]) => {
          setUsers(data);
          if (data.length > 0) setSelectedUser(data[0].name);
        })
        .catch(() => setAuthError('Error al cargar usuarios'));
    }
  }, [isLoggedIn, checkingAuth]);

  // Check if QrScanner component exists
  useEffect(() => {
    import('@/components/QrScanner')
      .then(() => setScannerAvailable(true))
      .catch(() => setScannerAvailable(false));
  }, []);

  const handleLogin = async () => {
    if (!selectedUser || !pinInput) {
      setAuthError('Selecciona un usuario e ingresa el PIN');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedUser, pin: pinInput }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem('user_name', data.user.name);
        localStorage.setItem('user_pin', pinInput);
        localStorage.setItem('user_role', data.user.role);
        setUserName(data.user.name);
        setUserRole(data.user.role);
        setIsLoggedIn(true);
        setPinInput('');
        setAuthError('');
      } else {
        setAuthError('PIN incorrecto');
      }
    } catch {
      setAuthError('Error de conexión');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_pin');
    localStorage.removeItem('user_role');
    setIsLoggedIn(false);
    setUserName('');
    setUserRole('');
    setPinInput('');
    setSelectedUser(users.length > 0 ? users[0].name : '');
    reset();
  };

  const startScan = () => {
    setView('scanning');
    setProduct(null);
    setErrorMsg('');
  };

  const handleScan = useCallback(async (result: string) => {
    setView('loading');
    try {
      const res = await fetch(`/api/product?id=${encodeURIComponent(result)}`);
      if (res.status === 404) {
        setErrorMsg('Producto no registrado');
        setView('error');
        return;
      }
      if (!res.ok) {
        setErrorMsg('Error al buscar producto');
        setView('error');
        return;
      }
      const data: Product = await res.json();
      setProduct(data);
      setView('product');
    } catch {
      setErrorMsg('Error de conexión');
      setView('error');
    }
  }, []);

  const handleSell = async () => {
    if (!product) return;
    setSelling(true);
    try {
      const storedName = localStorage.getItem('user_name') || '';
      const storedPin = localStorage.getItem('user_pin') || '';
      const res = await fetch('/api/product/sell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-name': storedName,
          'x-user-pin': storedPin,
        },
        body: JSON.stringify({ qr_id: product.qr_id, vendido_por: storedName }),
      });
      if (res.ok) {
        setProduct({ ...product, estatus: 'Vendido' });
        setView('sold');
      } else {
        setErrorMsg('Error al registrar venta');
        setView('error');
      }
    } catch {
      setErrorMsg('Error de conexión');
      setView('error');
    } finally {
      setSelling(false);
    }
  };

  const reset = () => {
    setView('idle');
    setProduct(null);
    setErrorMsg('');
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-700 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Login screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col">
        <div className="flex-1 w-full max-w-md mx-auto flex flex-col px-4 py-6">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Inicio
          </Link>

          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Punto de Venta</h1>
            <p className="text-gray-400 text-lg mt-1">Inicia sesión para continuar</p>
          </header>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full bg-gray-800 rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Usuario</label>
                <select
                  value={selectedUser}
                  onChange={(e) => {
                    setSelectedUser(e.target.value);
                    setAuthError('');
                  }}
                  className="w-full min-h-14 bg-gray-700 text-white text-lg rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-green-500 appearance-none cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.name} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, ''));
                    setAuthError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLogin();
                  }}
                  placeholder="••••"
                  className="w-full min-h-14 bg-gray-700 text-white text-lg rounded-xl px-4 text-center tracking-[0.5em] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>

              {authError && (
                <p className="text-red-400 text-sm text-center">{authError}</p>
              )}

              <button
                onClick={handleLogin}
                disabled={authLoading || !selectedUser || !pinInput}
                className="w-full min-h-14 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-lg font-bold rounded-xl transition-colors duration-150 flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main POS interface (logged in)
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col px-4 py-6">
        {/* Back button */}
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Inicio
        </Link>

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Punto de Venta</h1>
              <p className="text-gray-400 text-lg mt-1">{userName}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-400 text-sm font-medium px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
          {/* Admin & History links */}
          <div className="flex items-center gap-4 mt-3">
            <Link
              href="/pos/historial"
              className="text-gray-400 hover:text-gray-300 text-sm underline underline-offset-4 transition-colors"
            >
              Ver ventas del día
            </Link>
            {userRole === 'admin' && (
              <Link
                href="/admin/dashboard"
                className="text-amber-400 hover:text-amber-300 text-sm underline underline-offset-4 transition-colors"
              >
                Ir a Admin
              </Link>
            )}
          </div>
        </header>

        {/* Idle - Scan Button */}
        {view === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <div className="w-24 h-24 rounded-2xl bg-gray-800 flex items-center justify-center">
              <svg
                className="w-14 h-14 text-green-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h3c.621 0 1.125.504 1.125 1.125v3c0 .621-.504 1.125-1.125 1.125h-3A1.125 1.125 0 013.75 7.875v-3zM3.75 15.375c0-.621.504-1.125 1.125-1.125h3c.621 0 1.125.504 1.125 1.125v3c0 .621-.504 1.125-1.125 1.125h-3a1.125 1.125 0 01-1.125-1.125v-3zM14.25 4.875c0-.621.504-1.125 1.125-1.125h3c.621 0 1.125.504 1.125 1.125v3c0 .621-.504 1.125-1.125 1.125h-3a1.125 1.125 0 01-1.125-1.125v-3zM14.25 14.25h4.5v4.5h-4.5v-4.5z"
                />
              </svg>
            </div>
            <button
              onClick={startScan}
              className="w-full min-h-16 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xl font-bold rounded-2xl transition-colors duration-150 shadow-lg shadow-green-500/25"
            >
              Escanear QR
            </button>
          </div>
        )}

        {/* Scanning */}
        {view === 'scanning' && (
          <div className="flex-1 flex flex-col gap-4">
            {scannerAvailable ? (
              <QrScanner onScan={handleScan} onError={(err) => { setErrorMsg(err); setView('error'); }} />
            ) : (
              <ManualInput onScan={handleScan} />
            )}
            <button
              onClick={reset}
              className="w-full min-h-14 bg-gray-800 hover:bg-gray-700 text-gray-300 text-lg font-semibold rounded-2xl transition-colors duration-150"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Loading */}
        {view === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-gray-700 border-t-green-500 rounded-full animate-spin" />
            <p className="text-gray-400 text-lg">Buscando producto...</p>
          </div>
        )}

        {/* Product Found */}
        {view === 'product' && product && (
          <div className="flex-1 flex flex-col gap-5 animate-[fade-in_0.3s_ease-out]">
            <ProductCard product={product} />

            {product.estatus === 'Disponible' ? (
              <button
                onClick={handleSell}
                disabled={selling}
                className="w-full min-h-16 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white text-2xl font-bold rounded-2xl transition-colors duration-150 shadow-lg shadow-green-500/25 flex items-center justify-center gap-3"
              >
                {selling ? (
                  <>
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'VENDIDO'
                )}
              </button>
            ) : (
              <div className="w-full min-h-16 bg-red-900/40 border border-red-500/30 text-red-400 text-xl font-bold rounded-2xl flex items-center justify-center">
                Ya vendido
              </div>
            )}

            <button
              onClick={reset}
              className="w-full min-h-14 bg-gray-800 hover:bg-gray-700 text-gray-300 text-lg font-semibold rounded-2xl transition-colors duration-150"
            >
              Escanear Otro
            </button>
          </div>
        )}

        {/* Sold Success */}
        {view === 'sold' && product && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-[fade-in_0.3s_ease-out]">
            <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center animate-[scale-in_0.5s_ease-out]">
              <svg
                className="w-14 h-14 text-green-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-green-500 mb-2">
                Venta Registrada
              </h2>
              <p className="text-gray-400 text-lg">{product.qr_id}</p>
              <p className="text-white text-xl font-semibold mt-1">
                {product.tipo_carne}
              </p>
              <p className="text-green-400 text-3xl font-bold mt-3">
                ${product.precio_total.toFixed(2)}
              </p>
              <p className="text-gray-500 text-sm mt-2">Vendido por: {userName}</p>
            </div>

            <button
              onClick={reset}
              className="w-full min-h-16 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xl font-bold rounded-2xl transition-colors duration-150 shadow-lg shadow-green-500/25 mt-4"
            >
              Escanear Otro
            </button>
            <Link
              href="/pos/historial"
              className="text-gray-400 hover:text-gray-300 text-sm underline underline-offset-4 transition-colors"
            >
              Ver ventas del día
            </Link>
          </div>
        )}

        {/* Error */}
        {view === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-[fade-in_0.3s_ease-out]">
            <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-14 h-14 text-red-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-red-400 text-xl font-semibold text-center">
              {errorMsg}
            </p>
            <button
              onClick={reset}
              className="w-full min-h-14 bg-gray-800 hover:bg-gray-700 text-gray-300 text-lg font-semibold rounded-2xl transition-colors duration-150"
            >
              Escanear Otro
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* --- Sub-components ------------------------------------------------ */

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-mono">{product.qr_id}</span>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            product.estatus === 'Disponible'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {product.estatus}
        </span>
      </div>

      <h3 className="text-2xl font-bold">{product.tipo_carne}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-gray-400 text-sm">Peso</p>
          <p className="text-lg font-semibold">{product.peso_kg.toFixed(2)} kg</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Precio/kg</p>
          <p className="text-lg font-semibold">${product.precio_kg.toFixed(2)}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-700">
        <p className="text-gray-400 text-sm">Precio Total</p>
        <p className="text-3xl font-bold text-green-400">
          ${product.precio_total.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

function ManualInput({ onScan }: { onScan: (result: string) => void }) {
  const [manualId, setManualId] = useState('');

  return (
    <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
      <p className="text-gray-400 text-sm text-center">
        Escáner QR no disponible. Ingresa el ID manualmente:
      </p>
      <input
        type="text"
        value={manualId}
        onChange={(e) => setManualId(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && manualId.trim()) onScan(manualId.trim());
        }}
        placeholder="Ej: QR-001"
        className="w-full min-h-14 bg-gray-700 text-white text-lg rounded-xl px-4 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
        autoFocus
      />
      <button
        onClick={() => {
          if (manualId.trim()) onScan(manualId.trim());
        }}
        disabled={!manualId.trim()}
        className="w-full min-h-14 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-lg font-bold rounded-xl transition-colors duration-150"
      >
        Buscar Producto
      </button>
    </div>
  );
}
