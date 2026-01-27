import { 
  Home, Users, Truck, Building2, UserCircle2, 
  Package, Search, Factory, Calendar, FileText, 
  Tags, ShoppingCart, FileCheck, ShoppingBag, 
  CreditCard, Banknote, FileInput, ArrowDownToLine, 
  ArrowUpFromLine, ArrowLeftRight, FileSpreadsheet
} from 'lucide-react';

export const menuConfig = [
  {
    title: 'Principal',
    items: [
      { path: '/dashboard', icon: Home, label: 'Dashboard', modulo: 'dashboard', color: '#714B67' }
    ]
  },
  {
    title: 'Módulos Maestros',
    items: [
      { path: '/empleados', icon: Users, label: 'Empleados', modulo: 'empleados', color: '#00A09D' },
      { path: '/flota', icon: Truck, label: 'Flota', modulo: 'flota', color: '#D35400' },
      { path: '/proveedores', icon: Building2, label: 'Proveedores', modulo: 'proveedores', color: '#2E86C1' },
      { path: '/clientes', icon: UserCircle2, label: 'Clientes', modulo: 'clientes', color: '#8E44AD' }
    ]
  },
  {
    title: 'Productos',
    items: [
      { path: '/productos', icon: Package, label: 'Catálogo', modulo: 'productos', color: '#F39C12' },
      { path: '/productos/consulta-stock', icon: Search, label: 'Stock', modulo: 'consultarStock', color: '#E67E22' }
    ]
  },
  {
    title: 'Producción',
    items: [
      { path: '/produccion/ordenes', icon: Factory, label: 'Producción', modulo: 'ordenesProduccion', color: '#C0392B' },
      { path: '/produccion/calendario', icon: Calendar, label: 'Calendario', modulo: 'ordenesProduccion', color: '#27AE60' } 
    ]
  },
  {
    title: 'Ventas',
    items: [
      { path: '/ventas/cotizaciones', icon: FileText, label: 'Cotizaciones', modulo: 'cotizaciones', color: '#16A085' },
      { path: '/ventas/ordenes', icon: ShoppingCart, label: 'Ventas', modulo: 'ordenesVenta', color: '#2980B9' },
      { path: '/ventas/guias-remision', icon: FileCheck, label: 'Guías', modulo: 'guiasRemision', color: '#8E44AD' },
    ]
  },
  {
    title: 'Compras',
    items: [
      { path: '/compras', icon: ShoppingBag, label: 'Compras', modulo: 'compras', color: '#D35400' }
    ]
  },
  {
    title: 'Finanzas',
    items: [
      { path: '/finanzas/cuentas-pago', icon: CreditCard, label: 'Pagos', modulo: 'cuentasPago', color: '#2C3E50' },
      { path: '/finanzas/pagos-cobranzas', icon: Banknote, label: 'Cobranzas', modulo: 'pagosCobranzas', color: '#27AE60' },
    ]
  },
  {
    title: 'Inventario',
    items: [
      { path: '/inventario/entradas', icon: ArrowDownToLine, label: 'Entradas', modulo: 'entradas', color: '#2980B9' },
      { path: '/inventario/salidas', icon: ArrowUpFromLine, label: 'Salidas', modulo: 'salidas', color: '#C0392B' },
      { path: '/inventario/transferencias', icon: ArrowLeftRight, label: 'Transferencias', modulo: 'transferencias', color: '#F39C12' }
    ]
  },
  {
    title: 'Reportes', 
    items: [
      { path: '/reportes/sire', icon: FileSpreadsheet, label: 'SIRE', modulo: 'reportes', color: '#16A085' }
    ]
  }
];