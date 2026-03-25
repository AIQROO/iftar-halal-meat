import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { seedPrices } from '@/lib/sheets';
import type { Price } from '@/lib/types';

const INITIAL_PRODUCTS: Price[] = [
  // Pollo Halal
  { categoria: 'Pollo Halal', nombre: 'Pollo Entero', nombre_en: 'Whole Chicken', unidad: '1 kg', precio_mxn: 240, precio_local: 0 },
  { categoria: 'Pollo Halal', nombre: 'Pechuga sin Hueso', nombre_en: 'Boneless Breast', unidad: '1 kg', precio_mxn: 349, precio_local: 0 },
  { categoria: 'Pollo Halal', nombre: 'Pierna y Muslo', nombre_en: 'Leg and Thigh', unidad: '1 kg', precio_mxn: 287, precio_local: 0 },
  { categoria: 'Pollo Halal', nombre: 'Pierna y Muslo sin Hueso', nombre_en: 'Boneless Leg and Thigh', unidad: '1 kg', precio_mxn: 359, precio_local: 0 },
  { categoria: 'Pollo Halal', nombre: 'Alas de Pollo', nombre_en: 'Chicken Wings', unidad: '1 kg', precio_mxn: 276, precio_local: 0 },

  // Res Halal
  { categoria: 'Res Halal', nombre: 'Falda de Res', nombre_en: 'Shredded Meat', unidad: '1 kg', precio_mxn: 372, precio_local: 0 },
  { categoria: 'Res Halal', nombre: 'Carne Molida', nombre_en: 'Ground Beef', unidad: '1 kg', precio_mxn: 379, precio_local: 0 },
  { categoria: 'Res Halal', nombre: 'Chambarete sin Hueso', nombre_en: 'Boneless Shank', unidad: '1 kg', precio_mxn: 375, precio_local: 0 },
  { categoria: 'Res Halal', nombre: 'Pulpa de Res', nombre_en: 'Beef Cubes', unidad: '1 kg', precio_mxn: 371, precio_local: 0 },
  { categoria: 'Res Halal', nombre: 'Bistec', nombre_en: 'Sliced Steak', unidad: '1 kg', precio_mxn: 389, precio_local: 0 },
  { categoria: 'Res Halal', nombre: 'Arrachera', nombre_en: 'Skirt Steak', unidad: '1 kg', precio_mxn: 474, precio_local: 0 },

  // Res Premium / Prime
  { categoria: 'Res Premium / Prime', nombre: 'Filete Miñón', nombre_en: 'Filet Mignon', unidad: '1 kg', precio_mxn: 879, precio_local: 0 },
  { categoria: 'Res Premium / Prime', nombre: 'Rib Eye', nombre_en: 'Rib Eye', unidad: '1 kg', precio_mxn: 926, precio_local: 0 },
  { categoria: 'Res Premium / Prime', nombre: 'New York', nombre_en: 'New York Strip', unidad: '1 kg', precio_mxn: 697, precio_local: 0 },
  { categoria: 'Res Premium / Prime', nombre: 'Arrachera Premium', nombre_en: 'Premium Skirt Steak', unidad: '1 kg', precio_mxn: 530, precio_local: 0 },

  // Black Angus Halal
  { categoria: 'Black Angus Halal', nombre: 'New York Black Angus', nombre_en: 'New York Strip', unidad: '1 kg', precio_mxn: 1097, precio_local: 0 },
  { categoria: 'Black Angus Halal', nombre: 'Rib Eye Black Angus', nombre_en: 'Rib Eye', unidad: '1 kg', precio_mxn: 1323, precio_local: 0 },
  { categoria: 'Black Angus Halal', nombre: 'Tomahawk', nombre_en: 'Tomahawk', unidad: '1 kg', precio_mxn: 1062, precio_local: 0 },
  { categoria: 'Black Angus Halal', nombre: 'Arrachera Black Angus', nombre_en: 'Skirt Steak', unidad: '1 kg', precio_mxn: 730, precio_local: 0 },

  // Cordero Halal
  { categoria: 'Cordero Halal', nombre: 'Rack Corte Francés', nombre_en: 'French Cut Rack of Lamb', unidad: '1 kg', precio_mxn: 972, precio_local: 0 },
  { categoria: 'Cordero Halal', nombre: 'Rack Corte Estándar', nombre_en: 'Standard Cut Lamb Rack', unidad: '1 kg', precio_mxn: 699, precio_local: 0 },
  { categoria: 'Cordero Halal', nombre: 'Ossobuco de Cordero', nombre_en: 'Lamb Ossobuco', unidad: '1 kg', precio_mxn: 510, precio_local: 0 },
  { categoria: 'Cordero Halal', nombre: 'Pierna de Cordero', nombre_en: 'Lamb Leg', unidad: '1 kg', precio_mxn: 440, precio_local: 0 },

  // Productos Especiales Halal
  { categoria: 'Productos Especiales Halal', nombre: 'Hamburguesa de Cordero', nombre_en: 'Lamb Burger', unidad: '1 kg', precio_mxn: 496, precio_local: 0 },
  { categoria: 'Productos Especiales Halal', nombre: 'Hamburguesa de Res', nombre_en: 'Beef Burger', unidad: '1 kg', precio_mxn: 479, precio_local: 0 },
  { categoria: 'Productos Especiales Halal', nombre: 'Merguez', nombre_en: 'Merguez', unidad: '1 kg', precio_mxn: 480, precio_local: 0 },
  { categoria: 'Productos Especiales Halal', nombre: 'Jamón Halal', nombre_en: 'Halal Ham', unidad: '1/4', precio_mxn: 199, precio_local: 0 },
  { categoria: 'Productos Especiales Halal', nombre: 'Salchicha de Pavo', nombre_en: 'Turkey Sausage', unidad: '1/4', precio_mxn: 175, precio_local: 0 },
  { categoria: 'Productos Especiales Halal', nombre: 'Tocino de Pavo', nombre_en: 'Turkey Bacon', unidad: '1/4', precio_mxn: 210, precio_local: 0 },
];

export async function POST(request: Request) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await seedPrices(INITIAL_PRODUCTS);

    return NextResponse.json(
      { success: true, message: `Seeded ${INITIAL_PRODUCTS.length} products`, count: INITIAL_PRODUCTS.length },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error seeding prices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
