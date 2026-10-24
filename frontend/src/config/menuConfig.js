import {
  Gauge, Users, Truck, Building2, Store,
  Package, Warehouse, Factory, Calendar, FileText,
  Tags, BadgeDollarSign, ClipboardList, ShoppingCart,
  Wallet, Banknote, FileSignature, ArrowDownToLine,
  ArrowUpFromLine, ArrowLeftRight, Calculator,
  BarChart3, Route,
  ShieldAlert, PackageSearch,
  Radar,
  Receipt, Activity
} from 'lucide-react';

export const menuConfig = [
  {
    title: 'Principal',
    items: [
      { path: '/dashboard', icon: Gauge, label: 'Dashboard', modulo: 'dashboard' }
    ]
  },
  {
    title: 'Módulos Maestros',
    items: [
      { path: '/empleados', icon: Users, label: 'Empleados', modulo: 'empleados' },
      { path: '/flota', icon: Truck, label: 'Flota', modulo: 'flota' },
      { path: '/proveedores', icon: Building2, label: 'Proveedores', modulo: 'proveedores' },
      { path: '/clientes', icon: Store, label: 'Clientes', modulo: 'clientes' }
    ]
  },
  {
    title: 'Productos',
    items: [
      { path: '/productos', icon: Package, label: 'Catálogo', modulo: 'productos' },
      { path: '/productos/consulta-stock', icon: Warehouse, label: 'Stock', modulo: 'consultarStock' }
    ]
  },
  {
    title: 'Producción',
    items: [
      { path: '/produccion/tablero', icon: Factory, label: 'Control Planta', modulo: 'ordenesProduccion', rolesIncluidos: ['Administrador', 'Supervisor'] },
      { path: '/produccion/ordenes', icon: ClipboardList, label: 'Producción', modulo: 'ordenesProduccion' },
      { path: '/produccion/calendario', icon: Calendar, label: 'Calendario', modulo: 'ordenesProduccion' }
    ]
  },
  {
    title: 'Calidad',
    items: [
      { path: '/calidad/incidencias', icon: ShieldAlert, label: 'Incidencias', modulo: 'incidencias' },
      { path: '/calidad/incidencias-por-producto', icon: PackageSearch, label: 'Por Producto', modulo: 'incidencias' }
    ]
  },
  {
    title: 'Ventas',
    items: [
      { path: '/ventas/prospectos', icon: Radar, label: 'Prospección', modulo: 'prospectos', rolesIncluidos: ['Administrador', 'Comercial'] },
      { path: '/ventas/cotizaciones', icon: FileText, label: 'Cotizaciones', modulo: 'cotizaciones' },
      { path: '/ventas/listas-precios', icon: Tags, label: 'Listas de Precios', modulo: 'cotizaciones' },
      { path: '/ventas/ordenes', icon: BadgeDollarSign, label: 'Ventas', modulo: 'ordenesVenta' },
      { path: '/ventas/seguimiento', icon: Route, label: 'Seguimiento', modulo: 'seguimientoVentas' },
      {
        label: 'Reportes',
        icon: BarChart3,
        modulo: 'reportes',
        subItems: [
          { path: '/ventas/reportes', label: 'Reporte de Ventas', modulo: 'reportes' },
          { path: '/ventas/reporte-despachos', label: 'Despachos por Producto', modulo: 'reportes' },
          { path: '/ventas/reporte-deudas', label: 'Cuentas por Cobrar', modulo: 'reportes' },
        ]
      },
    ]
  },
  {
    title: 'Compras',
    items: [
      { path: '/compras', icon: ShoppingCart, label: 'Compras', modulo: 'compras' }
    ]
  },
  {
    title: 'Facturación Electrónica',
    items: [
      { path: '/facturacion/trazabilidad', icon: Receipt, iconImg: '/logo-sunat.png', label: 'Trazabilidad SEE', modulo: 'facturacion' },
      { path: '/reportes/monitor-sunat', icon: Activity, iconImg: '/logo-sunat.png', label: 'Monitor SUNAT', modulo: 'facturacion' }
    ]
  },
  {
    title: 'Finanzas',
    items: [
      { path: '/finanzas/cuentas-pago', icon: Wallet, label: 'Pagos', modulo: 'cuentasPago' },
      { path: '/finanzas/pagos-cobranzas', icon: Banknote, label: 'Cobranzas', modulo: 'pagosCobranzas' },
      { path: '/finanzas/historial-tc', icon: ArrowLeftRight, label: 'Historial TC', modulo: 'pagosCobranzas' },
      { path: '/solicitudes-credito', icon: FileSignature, label: 'Créditos', modulo: 'solicitudesCredito' }
    ]
  },
  {
    title: 'Inventario',
    items: [
      { path: '/inventario/salidas', icon: ArrowUpFromLine, label: 'Salidas', modulo: 'salidas', rolesIncluidos: ['Administrador', 'Calidad'] },
      { path: '/inventario/entradas', icon: ArrowDownToLine, label: 'Entradas', modulo: 'entradas', rolesIncluidos: ['Administrador'] },
      { path: '/inventario/stock', icon: Calculator, label: 'Valorización y Reportes', modulo: 'salidas', rolesIncluidos: ['Administrador'] }
    ]
  }
];
