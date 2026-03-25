export interface Product {
  qr_id: string;
  tipo_carne: string;
  peso_kg: number;
  precio_kg: number;
  precio_total: number;
  estatus: 'Disponible' | 'Vendido';
  fecha_registro: string;
  hora_registro: string;
  registrado_por?: string;
  fecha_venta?: string;
  hora_venta?: string;
  vendido_por?: string;
  notas?: string;
}

export interface Price {
  categoria: string;
  nombre: string;
  nombre_en: string;
  unidad: string;
  precio_mxn: number;
  precio_local: number;
}

export interface PriceCategory {
  categoria: string;
  productos: Price[];
}

export interface DashboardStats {
  total: number;
  disponibles: number;
  vendidos: number;
  productos: Product[];
}
