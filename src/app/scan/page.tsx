'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/types';

interface AuthUser {
  name: string;
  role: string;
}

const WHATSAPP_NUMBER = '529841072118';
const WHATSAPP_DISPLAY = '+52 984 107 2118';

type Lang = 'es' | 'en' | 'fr';

interface Dict {
  home: string;
  loadingProduct: string;
  loading: string;
  notRegistered: string;
  notRegisteredDesc: string;
  available: string;
  sold: string;
  weight: string;
  price: string;
  pricePerKg: string;
  packed: string;
  expires: string;
  soldLabel: string;
  soldBy: string;
  followUs: string;
  markSold: string;
  processing: string;
  alreadySold: string;
  sellerVerification: string;
  user: string;
  pinLabel: string;
  cancel: string;
  confirm: string;
  pickUserAndPin: string;
  wrongPin: string;
  connectionError: string;
  fetchError: string;
  loadUsersError: string;
  sellRecordError: string;
  saleRecorded: string;
}

const T: Record<Lang, Dict> = {
  es: {
    home: 'Inicio',
    loadingProduct: 'Cargando producto...',
    loading: 'Cargando...',
    notRegistered: 'No registrado',
    notRegisteredDesc: 'Este código aún no ha sido registrado.',
    available: 'Disponible',
    sold: 'Vendido',
    weight: 'Peso',
    price: 'Precio',
    pricePerKg: '/kg',
    packed: 'Envasado',
    expires: 'Caducidad',
    soldLabel: 'Vendido',
    soldBy: 'Vendido por',
    followUs: 'Síguenos',
    markSold: 'Marcar como vendido',
    processing: 'Procesando...',
    alreadySold: 'Ya vendido',
    sellerVerification: 'Identificación del vendedor',
    user: 'Usuario',
    pinLabel: 'PIN',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    pickUserAndPin: 'Selecciona un usuario e ingresa el PIN',
    wrongPin: 'PIN incorrecto',
    connectionError: 'Error de conexión',
    fetchError: 'Error al buscar producto',
    loadUsersError: 'Error al cargar usuarios',
    sellRecordError: 'Error al registrar venta',
    saleRecorded: 'Venta registrada',
  },
  en: {
    home: 'Home',
    loadingProduct: 'Loading product...',
    loading: 'Loading...',
    notRegistered: 'Not registered',
    notRegisteredDesc: 'This code has not been registered yet.',
    available: 'Available',
    sold: 'Sold',
    weight: 'Weight',
    price: 'Price',
    pricePerKg: '/kg',
    packed: 'Packed',
    expires: 'Expires',
    soldLabel: 'Sold',
    soldBy: 'Sold by',
    followUs: 'Follow us',
    markSold: 'Mark as sold',
    processing: 'Processing...',
    alreadySold: 'Already sold',
    sellerVerification: 'Seller verification',
    user: 'User',
    pinLabel: 'PIN',
    cancel: 'Cancel',
    confirm: 'Confirm',
    pickUserAndPin: 'Select a user and enter the PIN',
    wrongPin: 'Incorrect PIN',
    connectionError: 'Connection error',
    fetchError: 'Error fetching product',
    loadUsersError: 'Error loading users',
    sellRecordError: 'Error registering sale',
    saleRecorded: 'Sale recorded',
  },
  fr: {
    home: 'Accueil',
    loadingProduct: 'Chargement du produit...',
    loading: 'Chargement...',
    notRegistered: 'Non enregistré',
    notRegisteredDesc: "Ce code n'a pas encore été enregistré.",
    available: 'Disponible',
    sold: 'Vendu',
    weight: 'Poids',
    price: 'Prix',
    pricePerKg: '/kg',
    packed: 'Emballé',
    expires: 'Expire',
    soldLabel: 'Vendu',
    soldBy: 'Vendu par',
    followUs: 'Suivez-nous',
    markSold: 'Marquer comme vendu',
    processing: 'Traitement...',
    alreadySold: 'Déjà vendu',
    sellerVerification: 'Identification du vendeur',
    user: 'Utilisateur',
    pinLabel: 'PIN',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    pickUserAndPin: 'Sélectionnez un utilisateur et saisissez le PIN',
    wrongPin: 'PIN incorrect',
    connectionError: 'Erreur de connexion',
    fetchError: 'Erreur lors de la recherche du produit',
    loadUsersError: 'Erreur de chargement des utilisateurs',
    sellRecordError: "Erreur lors de l'enregistrement de la vente",
    saleRecorded: 'Vente enregistrée',
  },
};

function parseFechaRegistro(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}

function formatFechaLarga(d: Date, lang: Lang): string {
  const locale = lang === 'es' ? 'es-MX' : lang === 'fr' ? 'fr-FR' : 'en-US';
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function addOneYear(d: Date): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + 1);
  return r;
}

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'es';
  const stored = window.localStorage.getItem('iftar_lang');
  if (stored === 'es' || stored === 'en' || stored === 'fr') return stored;
  const nav = (window.navigator.language || 'es').toLowerCase();
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('fr')) return 'fr';
  return 'en';
}

interface ScanContentProps {
  lang: Lang;
  t: Dict;
}

function ScanContent({ lang, t }: ScanContentProps) {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [selling, setSelling] = useState(false);
  const [sold, setSold] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

  const [showSellerPrompt, setShowSellerPrompt] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [selectedSeller, setSelectedSeller] = useState('');
  const [sellerPin, setSellerPin] = useState('');
  const [sellerError, setSellerError] = useState('');
  const [sellerName, setSellerName] = useState('');

  useEffect(() => {
    setIsStaff(
      Boolean(localStorage.getItem('user_name') && localStorage.getItem('user_pin')),
    );
  }, [id]);

  useEffect(() => {
    setError('');
    setNotFound(false);
    setProduct(null);
    setLoading(true);

    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    async function fetchProduct() {
      try {
        const res = await fetch(`/api/product?id=${encodeURIComponent(id!)}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) {
          setError(t.fetchError);
          return;
        }
        const data: Product = await res.json();
        setProduct(data);
      } catch {
        setError(t.connectionError);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id, t]);

  const handleSellClick = async () => {
    const storedName = localStorage.getItem('user_name');
    const storedPin = localStorage.getItem('user_pin');
    if (storedName && storedPin) {
      await executeSell(storedName, storedPin);
    } else {
      if (users.length === 0) {
        try {
          const res = await fetch('/api/auth');
          const data: AuthUser[] = await res.json();
          setUsers(data);
          if (data.length > 0) setSelectedSeller(data[0].name);
        } catch {
          setError(t.loadUsersError);
          return;
        }
      }
      setShowSellerPrompt(true);
    }
  };

  const handleSellerConfirm = async () => {
    if (!selectedSeller || !sellerPin) {
      setSellerError(t.pickUserAndPin);
      return;
    }
    setSellerError('');

    try {
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedSeller, pin: sellerPin }),
      });
      const authData = await authRes.json();
      if (!authData.success) {
        setSellerError(t.wrongPin);
        return;
      }
      await executeSell(selectedSeller, sellerPin);
    } catch {
      setSellerError(t.connectionError);
    }
  };

  const executeSell = async (name: string, pin: string) => {
    if (!product) return;
    setSelling(true);
    setShowSellerPrompt(false);
    try {
      const res = await fetch('/api/product/sell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-name': name,
          'x-user-pin': pin,
        },
        body: JSON.stringify({ qr_id: product.qr_id, vendido_por: name }),
      });
      if (res.ok) {
        setProduct({ ...product, estatus: 'Vendido' });
        setSellerName(name);
        setSold(true);
      } else {
        setError(t.sellRecordError);
      }
    } catch {
      setError(t.connectionError);
    } finally {
      setSelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-gray-700 border-t-green-500 rounded-full animate-spin" />
        <p className="text-gray-400 text-lg">{t.loadingProduct}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
        <BrandHeader />
        <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-yellow-500"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-yellow-500 mb-2">{t.notRegistered}</h2>
          <p className="text-gray-400">{t.notRegisteredDesc}</p>
          {id && <p className="text-gray-500 text-sm font-mono mt-2">{id}</p>}
        </div>
        <CertificationsRow />
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
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
        <p className="text-red-400 text-xl font-semibold text-center">{error}</p>
      </div>
    );
  }

  if (sold && product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center animate-bounce">
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
          <h2 className="text-2xl font-bold text-green-500 mb-2">{t.saleRecorded}</h2>
          <p className="text-gray-400 text-lg">{product.qr_id}</p>
          <p className="text-white text-xl font-semibold mt-1">{product.tipo_carne}</p>
          <p className="text-green-400 text-3xl font-bold mt-3">
            ${product.precio_total.toFixed(2)}
          </p>
          {sellerName && (
            <p className="text-gray-500 text-sm mt-2">
              {t.soldBy}: {sellerName}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (showSellerPrompt) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="w-full bg-gray-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-xl font-bold text-center">{t.sellerVerification}</h2>

          <div>
            <label className="block text-gray-400 text-sm mb-2">{t.user}</label>
            <select
              value={selectedSeller}
              onChange={(e) => {
                setSelectedSeller(e.target.value);
                setSellerError('');
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
            <label className="block text-gray-400 text-sm mb-2">{t.pinLabel}</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={sellerPin}
              onChange={(e) => {
                setSellerPin(e.target.value.replace(/\D/g, ''));
                setSellerError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSellerConfirm();
              }}
              placeholder="••••"
              className="w-full min-h-14 bg-gray-700 text-white text-lg rounded-xl px-4 text-center tracking-[0.5em] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
          </div>

          {sellerError && (
            <p className="text-red-400 text-sm text-center">{sellerError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowSellerPrompt(false);
                setSellerPin('');
                setSellerError('');
              }}
              className="flex-1 min-h-14 bg-gray-700 hover:bg-gray-600 text-gray-300 text-lg font-semibold rounded-xl transition-colors"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleSellerConfirm}
              disabled={!selectedSeller || !sellerPin}
              className="flex-1 min-h-14 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-lg font-bold rounded-xl transition-colors"
            >
              {t.confirm}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (product) {
    const envasado = parseFechaRegistro(product.fecha_registro);
    const caducidad = envasado ? addOneYear(envasado) : null;

    return (
      <div className="flex-1 flex flex-col gap-3 pb-2">
        <BrandHeader />

        <div className="text-center">
          {isStaff && (
            <span
              className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 ${
                product.estatus === 'Disponible'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {product.estatus === 'Disponible' ? t.available : t.sold}
            </span>
          )}
          <h2 className="text-2xl font-bold leading-tight">{product.tipo_carne}</h2>
          <p className="text-gray-500 text-[10px] font-mono mt-1">{product.qr_id}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-[10px] uppercase tracking-wide">{t.weight}</p>
              <p className="text-xl font-bold leading-tight">
                {product.peso_kg.toFixed(3)}{' '}
                <span className="text-sm text-gray-400">kg</span>
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-[10px] uppercase tracking-wide">{t.price}</p>
              <p className="text-xl font-bold text-green-400 leading-tight">
                ${product.precio_total.toFixed(2)}
              </p>
              <p className="text-gray-500 text-[10px]">
                ${product.precio_kg.toFixed(2)}
                {t.pricePerKg}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-2.5 grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-[10px] uppercase tracking-wide">{t.packed}</p>
              <p className="text-sm font-semibold leading-tight">
                {envasado ? formatFechaLarga(envasado, lang) : product.fecha_registro || '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-[10px] uppercase tracking-wide">{t.expires}</p>
              <p className="text-sm font-semibold leading-tight">
                {caducidad ? formatFechaLarga(caducidad, lang) : '—'}
              </p>
            </div>
          </div>

          {isStaff && product.estatus === 'Vendido' && product.fecha_venta && (
            <div className="border-t border-gray-700 pt-2.5">
              <p className="text-gray-400 text-[10px] uppercase tracking-wide">{t.soldLabel}</p>
              <p className="text-sm text-red-400">
                {product.fecha_venta}
                {product.hora_venta ? ` · ${product.hora_venta}` : ''}
              </p>
            </div>
          )}
        </div>

        <CertificationsRow />

        <SocialRow t={t} />

        {isStaff && product.estatus === 'Disponible' && (
          <button
            onClick={handleSellClick}
            disabled={selling}
            className="w-full min-h-14 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white text-xl font-bold rounded-xl transition-colors duration-150 shadow-lg shadow-green-500/25 flex items-center justify-center gap-3"
          >
            {selling ? (
              <>
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                {t.processing}
              </>
            ) : (
              t.markSold
            )}
          </button>
        )}

        {error && <p className="text-red-400 text-center text-xs">{error}</p>}
      </div>
    );
  }

  return null;
}

function BrandHeader() {
  return (
    <div className="flex flex-col items-center">
      <Image
        src="/logos/iftar-halal-food.jpg"
        alt="Iftar Halal Food"
        width={88}
        height={88}
        className="rounded-xl"
        priority
      />
      <p className="text-gray-400 text-[10px] mt-1.5 tracking-widest uppercase text-center">
        Muslimin International Halal Group
      </p>
    </div>
  );
}

function CertificationsRow() {
  return (
    <div className="bg-gray-800/60 rounded-xl p-2">
      <div className="flex items-center justify-center gap-5">
        <Image
          src="/logos/halal-certified.png"
          alt="Halal Food Certified 100%"
          width={56}
          height={56}
          className="rounded-full bg-white p-0.5"
        />
        <Image
          src="/logos/asociacion-islamica-qroo.jpg"
          alt="Asociación Islámica de Quintana Roo"
          width={56}
          height={56}
          className="rounded-full"
        />
      </div>
    </div>
  );
}

function SocialRow({ t }: { t: Dict }) {
  return (
    <div className="text-center">
      <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-1.5">{t.followUs}</p>
      <div className="flex items-center justify-center gap-3">
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${WHATSAPP_DISPLAY}`}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-[#25D366] hover:bg-[#1ebe57] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
          </svg>
        </a>
        <a
          href="#"
          aria-label="Instagram"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] hover:opacity-90 transition-opacity"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        </a>
        <a
          href="#"
          aria-label="Facebook"
          className="flex items-center justify-center w-9 h-9 rounded-full bg-[#1877F2] hover:bg-[#0e6ae3] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        </a>
      </div>
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-gray-400 hover:text-white text-[10px] mt-1.5"
      >
        {WHATSAPP_DISPLAY}
      </a>
    </div>
  );
}

function LanguageToggle({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  const opt = (l: Lang, label: string) => (
    <button
      key={l}
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
        lang === l
          ? 'bg-white text-gray-900'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
      {opt('es', 'ES')}
      {opt('en', 'EN')}
      {opt('fr', 'FR')}
    </div>
  );
}

export default function ScanPage() {
  const [lang, setLangState] = useState<Lang>('es');

  useEffect(() => {
    setLangState(detectInitialLang());
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('iftar_lang', l);
    }
  };

  const t = T[lang];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-400 hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            {t.home}
          </Link>
          <LanguageToggle lang={lang} setLang={setLang} />
        </div>

        <Suspense
          fallback={
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-gray-700 border-t-green-500 rounded-full animate-spin" />
              <p className="text-gray-400 text-lg">{t.loading}</p>
            </div>
          }
        >
          <ScanContent lang={lang} t={t} />
        </Suspense>
      </div>
    </div>
  );
}
