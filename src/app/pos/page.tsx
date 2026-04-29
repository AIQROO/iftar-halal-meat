'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Product, LocalCustomer, Price } from '@/lib/types';
import { parseScannedQrPayload } from '@/lib/qr-serie';

const QrScanner = dynamic(() => import('@/components/QrScanner'), {
  ssr: false,
  loading: () => null,
});

type ViewState = 'idle' | 'scanning' | 'loading' | 'product' | 'sold' | 'error';
type LocalStep = 'off' | 'phone' | 'register' | 'ready';

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

  // Local price state
  const [localStep, setLocalStep] = useState<LocalStep>('off');
  const [localPhone, setLocalPhone] = useState('');
  const [localCustomer, setLocalCustomer] = useState<LocalCustomer | null>(null);
  const [localNombre, setLocalNombre] = useState('');
  const [localApellido, setLocalApellido] = useState('');
  const [localSearching, setLocalSearching] = useState(false);
  const [localRegistering, setLocalRegistering] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localPriceInfo, setLocalPriceInfo] = useState<{ precio_kg: number; precio_total: number } | null>(null);
  const [allPrices, setAllPrices] = useState<Price[]>([]);
  const [soldTipoPrecio, setSoldTipoPrecio] = useState<'Normal' | 'Local'>('Normal');

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

  // Fetch prices when logged in (needed for local price calc)
  useEffect(() => {
    if (isLoggedIn) {
      const storedName = localStorage.getItem('user_name') || '';
      const storedPin = localStorage.getItem('user_pin') || '';
      fetch('/api/prices', {
        headers: { 'x-user-name': storedName, 'x-user-pin': storedPin },
      })
        .then((res) => res.json())
        .then((categories) => {
          const flat = categories.flatMap((c: { productos: Price[] }) => c.productos);
          setAllPrices(flat);
        })
        .catch(() => {});
    }
  }, [isLoggedIn]);

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
      setAuthError('Error de conexion');
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
    const qrId = parseScannedQrPayload(result);
    setView('loading');
    try {
      const res = await fetch(`/api/product?id=${encodeURIComponent(qrId)}`);
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
      setErrorMsg('Error de conexion');
      setView('error');
    }
  }, []);

  const handleSell = async (tipoPrecio: 'Normal' | 'Local' = 'Normal') => {
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
        body: JSON.stringify({
          qr_id: product.qr_id,
          vendido_por: storedName,
          tipo_precio: tipoPrecio,
          cliente_tel: tipoPrecio === 'Local' ? localCustomer?.telefono : undefined,
        }),
      });
      if (res.ok) {
        // Update displayed product with local price if applicable
        if (tipoPrecio === 'Local' && localPriceInfo) {
          setProduct({
            ...product,
            estatus: 'Vendido',
            precio_kg: localPriceInfo.precio_kg,
            precio_total: localPriceInfo.precio_total,
          });
        } else {
          setProduct({ ...product, estatus: 'Vendido' });
        }
        setSoldTipoPrecio(tipoPrecio);
        setView('sold');
      } else {
        setErrorMsg('Error al registrar venta');
        setView('error');
      }
    } catch {
      setErrorMsg('Error de conexion');
      setView('error');
    } finally {
      setSelling(false);
    }
  };

  const reset = () => {
    setView('idle');
    setProduct(null);
    setErrorMsg('');
    resetLocal();
  };

  const resetLocal = () => {
    setLocalStep('off');
    setLocalPhone('');
    setLocalCustomer(null);
    setLocalNombre('');
    setLocalApellido('');
    setLocalError('');
    setLocalPriceInfo(null);
    setSoldTipoPrecio('Normal');
  };

  const handleLocalSearch = async () => {
    if (!localPhone.trim()) return;
    setLocalSearching(true);
    setLocalError('');
    try {
      const storedName = localStorage.getItem('user_name') || '';
      const storedPin = localStorage.getItem('user_pin') || '';
      const res = await fetch(`/api/locales?telefono=${encodeURIComponent(localPhone.trim())}`, {
        headers: { 'x-user-name': storedName, 'x-user-pin': storedPin },
      });
      const data = await res.json();
      if (data.found) {
        setLocalCustomer(data.customer);
        calcLocalPrice();
        setLocalStep('ready');
      } else {
        // Not found, show registration form
        setLocalStep('register');
      }
    } catch {
      setLocalError('Error al buscar cliente');
    } finally {
      setLocalSearching(false);
    }
  };

  const handleLocalRegister = async () => {
    if (!localNombre.trim() || !localApellido.trim() || !localPhone.trim()) {
      setLocalError('Todos los campos son obligatorios');
      return;
    }
    setLocalRegistering(true);
    setLocalError('');
    try {
      const storedName = localStorage.getItem('user_name') || '';
      const storedPin = localStorage.getItem('user_pin') || '';
      const res = await fetch('/api/locales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-name': storedName,
          'x-user-pin': storedPin,
        },
        body: JSON.stringify({
          nombre: localNombre.trim(),
          apellido: localApellido.trim(),
          telefono: localPhone.trim(),
        }),
      });
      const data = await res.json();
      setLocalCustomer(data.customer);
      calcLocalPrice();
      setLocalStep('ready');
    } catch {
      setLocalError('Error al registrar cliente');
    } finally {
      setLocalRegistering(false);
    }
  };

  const calcLocalPrice = () => {
    if (!product) return;
    const priceEntry = allPrices.find((p) => p.nombre === product.tipo_carne);
    if (priceEntry && priceEntry.precio_local > 0) {
      setLocalPriceInfo({
        precio_kg: priceEntry.precio_local,
        precio_total: product.peso_kg * priceEntry.precio_local,
      });
    }
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
            <p className="text-gray-400 text-lg mt-1">Inicia sesion para continuar</p>
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
              Cerrar sesion
            </button>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <Link
              href="/pos/historial"
              className="text-gray-400 hover:text-gray-300 text-sm underline underline-offset-4 transition-colors"
            >
              Ver ventas del dia
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
            <ProductCard
              product={product}
              localPriceInfo={localStep === 'ready' ? localPriceInfo : null}
            />

            {product.estatus === 'Disponible' ? (
              <>
                {/* Local price flow */}
                {localStep === 'off' && (
                  <>
                    {/* Normal sell button */}
                    <button
                      onClick={() => handleSell('Normal')}
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

                    {/* Local price button */}
                    <button
                      onClick={() => setLocalStep('phone')}
                      className="w-full min-h-14 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-lg font-semibold rounded-2xl transition-colors duration-150 flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Precio Local
                    </button>
                  </>
                )}

                {/* Phone search step */}
                {localStep === 'phone' && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-blue-400 font-semibold">Precio Local</h3>
                      <button
                        onClick={resetLocal}
                        className="text-gray-500 hover:text-gray-300 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                    <p className="text-gray-400 text-sm">Ingresa el telefono del cliente</p>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={localPhone}
                      onChange={(e) => setLocalPhone(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleLocalSearch();
                      }}
                      placeholder="10 digitos"
                      maxLength={10}
                      className="w-full min-h-14 bg-gray-800 text-white text-lg rounded-xl px-4 text-center tracking-wider placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    {localError && (
                      <p className="text-red-400 text-sm text-center">{localError}</p>
                    )}
                    <button
                      onClick={handleLocalSearch}
                      disabled={localSearching || localPhone.length < 10}
                      className="w-full min-h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {localSearching ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Buscando...
                        </>
                      ) : (
                        'Buscar Cliente'
                      )}
                    </button>
                  </div>
                )}

                {/* Register new local step */}
                {localStep === 'register' && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-blue-400 font-semibold">Registrar Cliente Local</h3>
                      <button
                        onClick={resetLocal}
                        className="text-gray-500 hover:text-gray-300 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                    <p className="text-gray-400 text-sm">
                      No encontramos el telefono <span className="text-white font-medium">{localPhone}</span>. Registra al cliente:
                    </p>
                    <input
                      type="text"
                      value={localNombre}
                      onChange={(e) => setLocalNombre(e.target.value)}
                      placeholder="Nombre"
                      className="w-full min-h-12 bg-gray-800 text-white rounded-xl px-4 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={localApellido}
                      onChange={(e) => setLocalApellido(e.target.value)}
                      placeholder="Apellido"
                      className="w-full min-h-12 bg-gray-800 text-white rounded-xl px-4 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="bg-gray-800 rounded-xl px-4 min-h-12 flex items-center text-gray-400">
                      Tel: {localPhone}
                    </div>
                    {localError && (
                      <p className="text-red-400 text-sm text-center">{localError}</p>
                    )}
                    <button
                      onClick={handleLocalRegister}
                      disabled={localRegistering || !localNombre.trim() || !localApellido.trim()}
                      className="w-full min-h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {localRegistering ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Registrando...
                        </>
                      ) : (
                        'Registrar y Aplicar Descuento'
                      )}
                    </button>
                  </div>
                )}

                {/* Ready to sell at local price */}
                {localStep === 'ready' && localCustomer && (
                  <>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-blue-400 font-semibold text-sm">Cliente Local</span>
                        <button
                          onClick={resetLocal}
                          className="text-gray-500 hover:text-gray-300 text-xs"
                        >
                          Quitar descuento
                        </button>
                      </div>
                      <p className="text-white font-medium">
                        {localCustomer.nombre} {localCustomer.apellido}
                      </p>
                      <p className="text-gray-400 text-sm">{localCustomer.telefono}</p>
                    </div>

                    <button
                      onClick={() => handleSell('Local')}
                      disabled={selling}
                      className="w-full min-h-16 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-2xl font-bold rounded-2xl transition-colors duration-150 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-3"
                    >
                      {selling ? (
                        <>
                          <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>VENDER - PRECIO LOCAL</>
                      )}
                    </button>
                  </>
                )}
              </>
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
            <div className={`w-24 h-24 rounded-full flex items-center justify-center animate-[scale-in_0.5s_ease-out] ${
              soldTipoPrecio === 'Local' ? 'bg-blue-500/20' : 'bg-green-500/20'
            }`}>
              <svg
                className={`w-14 h-14 ${soldTipoPrecio === 'Local' ? 'text-blue-500' : 'text-green-500'}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className={`text-2xl font-bold mb-2 ${
                soldTipoPrecio === 'Local' ? 'text-blue-500' : 'text-green-500'
              }`}>
                Venta Registrada
              </h2>
              {soldTipoPrecio === 'Local' && (
                <span className="inline-block bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1 rounded-full mb-2">
                  PRECIO LOCAL
                </span>
              )}
              <p className="text-gray-400 text-lg">{product.qr_id}</p>
              <p className="text-white text-xl font-semibold mt-1">
                {product.tipo_carne}
              </p>
              <p className={`text-3xl font-bold mt-3 ${
                soldTipoPrecio === 'Local' ? 'text-blue-400' : 'text-green-400'
              }`}>
                ${product.precio_total.toFixed(2)}
              </p>
              {soldTipoPrecio === 'Local' && localCustomer && (
                <p className="text-blue-400/70 text-sm mt-2">
                  Cliente: {localCustomer.nombre} {localCustomer.apellido}
                </p>
              )}
              <p className="text-gray-500 text-sm mt-2">Vendido por: {userName}</p>
            </div>

            <button
              onClick={reset}
              className={`w-full min-h-16 text-white text-xl font-bold rounded-2xl transition-colors duration-150 shadow-lg mt-4 ${
                soldTipoPrecio === 'Local'
                  ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-blue-500/25'
                  : 'bg-green-500 hover:bg-green-600 active:bg-green-700 shadow-green-500/25'
              }`}
            >
              Escanear Otro
            </button>
            <Link
              href="/pos/historial"
              className="text-gray-400 hover:text-gray-300 text-sm underline underline-offset-4 transition-colors"
            >
              Ver ventas del dia
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

function ProductCard({
  product,
  localPriceInfo,
}: {
  product: Product;
  localPriceInfo: { precio_kg: number; precio_total: number } | null;
}) {
  const showLocal = !!localPriceInfo;
  const precioKg = showLocal ? localPriceInfo.precio_kg : product.precio_kg;
  const precioTotal = showLocal ? localPriceInfo.precio_total : product.precio_total;

  return (
    <div className={`rounded-2xl p-6 space-y-4 ${
      showLocal ? 'bg-blue-900/30 border border-blue-500/20' : 'bg-gray-800'
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-mono">{product.qr_id}</span>
        <div className="flex items-center gap-2">
          {showLocal && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
              LOCAL
            </span>
          )}
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
      </div>

      <h3 className="text-2xl font-bold">{product.tipo_carne}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-gray-400 text-sm">Peso</p>
          <p className="text-lg font-semibold">{product.peso_kg.toFixed(2)} kg</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Precio/kg</p>
          {showLocal ? (
            <div>
              <p className="text-lg font-semibold text-blue-400">${precioKg.toFixed(2)}</p>
              <p className="text-xs text-gray-500 line-through">${product.precio_kg.toFixed(2)}</p>
            </div>
          ) : (
            <p className="text-lg font-semibold">${precioKg.toFixed(2)}</p>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-gray-700">
        <p className="text-gray-400 text-sm">Precio Total</p>
        {showLocal ? (
          <div>
            <p className="text-3xl font-bold text-blue-400">
              ${precioTotal.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 line-through">
              ${product.precio_total.toFixed(2)}
            </p>
          </div>
        ) : (
          <p className="text-3xl font-bold text-green-400">
            ${precioTotal.toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}

function ManualInput({ onScan }: { onScan: (result: string) => void }) {
  const [manualId, setManualId] = useState('');

  return (
    <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
      <p className="text-gray-400 text-sm text-center">
        Escaner QR no disponible. Ingresa el ID manualmente:
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
