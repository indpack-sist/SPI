import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database.js';

// ============================================
// IMPORTS DE RUTAS
// ============================================

// Módulos Base
import authRoutes from './routes/auth.routes.js';
import empleadosRoutes from './routes/empleados.routes.js';
import flotaRoutes from './routes/flota.routes.js';
import proveedoresRoutes from './routes/proveedores.routes.js';
import clientesRoutes from './routes/clientes.routes.js';

// Productos
import productosRoutes from './routes/productos.routes.js';

// Inventario
import entradasRoutes from './routes/movimientos-entradas.routes.js';
import salidasRoutes from './routes/movimientos-salidas.routes.js';
import transferenciasRoutes from './routes/transferencias.routes.js';
import inventarioRoutes from './routes/inventario.routes.js';

// Producción
import ordenesProduccionRoutes from './routes/ordenes-produccion.routes.js';

// Ventas
import cotizacionesRoutes from './routes/cotizaciones.routes.js';
import ordenesVentaRoutes from './routes/ordenesVenta.routes.js';
import guiasRemisionRoutes from './routes/guiasRemision.routes.js';
import guiasTransportistaRoutes from './routes/guiasTransportista.routes.js';

// Compras
import ordenesCompraRoutes from './routes/ordenesCompra.routes.js';

// Dashboard
import dashboardRoutes from './routes/dashboard.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARES
// ============================================

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ============================================
// RUTAS DE SISTEMA
// ============================================

app.get('/', (req, res) => {
  res.json({
    message: 'API INDPACK - Sistema ERP Completo',
    version: '2.0.0',
    status: 'online',
    modules: {
      base: ['auth', 'empleados', 'flota', 'proveedores', 'clientes'],
      productos: ['productos', 'recetas'],
      inventario: ['entradas', 'salidas', 'transferencias'],
      produccion: ['ordenes'],
      ventas: ['cotizaciones', 'ordenes', 'guias-remision', 'guias-transportista'],
      compras: ['ordenes-compra'],
      analytics: ['dashboard']
    }
  });
});

app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'ok',
    database: dbStatus ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// REGISTRO DE RUTAS
// ============================================

// Auth
app.use('/api/auth', authRoutes);

// Módulos Base
app.use('/api/empleados', empleadosRoutes);
app.use('/api/flota', flotaRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/clientes', clientesRoutes);

// Productos
app.use('/api/productos', productosRoutes);

// Inventario
app.use('/api/inventario/movimientos-entradas', entradasRoutes); 
app.use('/api/inventario/movimientos-salidas', salidasRoutes);
app.use('/api/inventario/transferencias', transferenciasRoutes);
app.use('/api/inventario', inventarioRoutes);

// Producción
app.use('/api/produccion/ordenes', ordenesProduccionRoutes);

// Ventas
app.use('/api/cotizaciones', cotizacionesRoutes);
app.use('/api/ordenes-venta', ordenesVentaRoutes);
app.use('/api/guias-remision', guiasRemisionRoutes);
app.use('/api/guias-transportista', guiasTransportistaRoutes);

// Compras
app.use('/api/ordenes-compra', ordenesCompraRoutes);

// Dashboard
app.use('/api/dashboard', dashboardRoutes);

// ============================================
// MANEJO DE ERRORES
// ============================================

// 404 - Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path,
    method: req.method
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('='.repeat(80));
  console.error('ERROR CAPTURADO EN SERVIDOR');
  console.error('Ruta:', req.method, req.path);
  console.error('Body:', JSON.stringify(req.body, null, 2));
  console.error('='.repeat(80));
  console.error('Mensaje:', err.message);
  console.error('Código:', err.code);
  console.error('SQL State:', err.sqlState);
  console.error('SQL:', err.sql);
  console.error('Status Code:', err.statusCode);
  console.error('='.repeat(80));
  console.error('STACK TRACE COMPLETO:');
  console.error(err.stack);
  console.error('='.repeat(80));

  // Error operacional
  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message
    });
  }

  // Errores de base de datos específicos
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      success: false,
      error: 'Ya existe un registro con estos datos'
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      error: 'Referencia inválida a otro registro'
    });
  }

  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({
      success: false,
      error: 'Error de base de datos: Tabla no encontrada',
      detalles: err.message,
      sql: err.sql,
      tabla_buscada: err.message.match(/Table '.*?\.(\w+)'/)?.[1] || 'desconocida'
    });
  }

  // Error genérico
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    code: err.code,
    sqlState: err.sqlState,
    sql: err.sql,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ============================================
// INICIO DEL SERVIDOR
// ============================================

async function startServer() {
  try {
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('No se pudo conectar a la base de datos. Verifica la configuración.');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log('='.repeat(80));
      console.log(`🚀 SERVIDOR INDPACK ERP - INICIADO EXITOSAMENTE`);
      console.log('='.repeat(80));
      console.log(`📌 Puerto: ${PORT}`);
      console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 URL Local: http://localhost:${PORT}`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
      console.log(`💾 Base de datos: CONECTADA`);
      console.log('='.repeat(80));
      console.log('📋 MÓDULOS DISPONIBLES:');
      console.log('');
      console.log('🔐 AUTENTICACIÓN:');
      console.log('   - /api/auth');
      console.log('');
      console.log('👥 MÓDULOS BASE:');
      console.log('   - /api/empleados');
      console.log('   - /api/flota');
      console.log('   - /api/proveedores');
      console.log('   - /api/clientes');
      console.log('');
      console.log('📦 PRODUCTOS:');
      console.log('   - /api/productos');
      console.log('');
      console.log('🏭 INVENTARIO:');
      console.log('   - /api/inventario/movimientos-entradas');
      console.log('   - /api/inventario/movimientos-salidas');
      console.log('   - /api/inventario/transferencias');
      console.log('   - /api/inventario');
      console.log('');
      console.log('⚙️  PRODUCCIÓN:');
      console.log('   - /api/produccion/ordenes');
      console.log('');
      console.log('💰 VENTAS:');
      console.log('   - /api/cotizaciones');
      console.log('   - /api/ordenes-venta');
      console.log('   - /api/guias-remision');
      console.log('   - /api/guias-transportista');
      console.log('');
      console.log('🛒 COMPRAS:');
      console.log('   - /api/ordenes-compra');
      console.log('');
      console.log('📊 ANALYTICS:');
      console.log('   - /api/dashboard');
      console.log('');
      console.log('='.repeat(80));
      console.log('✅ SISTEMA LISTO PARA RECIBIR PETICIONES');
      console.log('='.repeat(80));
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// ============================================
// MANEJO DE SEÑALES DEL SISTEMA
// ============================================

process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM recibido. Cerrando servidor gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT recibido. Cerrando servidor gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('='.repeat(80));
  console.error('❌ Unhandled Rejection');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  console.error('='.repeat(80));
});

process.on('uncaughtException', (error) => {
  console.error('='.repeat(80));
  console.error('❌ Uncaught Exception');
  console.error(error);
  console.error('='.repeat(80));
  process.exit(1);
});

// Iniciar servidor
startServer();