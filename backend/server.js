import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database.js';

import empleadosRoutes from './routes/empleados.routes.js';
import flotaRoutes from './routes/flota.routes.js';
import proveedoresRoutes from './routes/proveedores.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import entradasRoutes from './routes/movimientos-entradas.routes.js';
import salidasRoutes from './routes/movimientos-salidas.routes.js';
import transferenciasRoutes from './routes/transferencias.routes.js';
import productosRoutes from './routes/productos.routes.js';
import inventarioRoutes from './routes/inventario.routes.js';
import ordenesProduccionRoutes from './routes/ordenes-produccion.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import authRoutes from './routes/auth.routes.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

app.get('/', (req, res) => {
  res.json({
    message: 'API INDPACK - Sistema de Control de Inventario y Producción',
    version: '1.0.0',
    status: 'online'
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

app.use('/api/empleados', empleadosRoutes);
app.use('/api/flota', flotaRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/clientes', clientesRoutes);

app.use('/api/productos', productosRoutes);


app.use('/api/inventario/movimientos-entradas', entradasRoutes); 
app.use('/api/inventario/movimientos-salidas', salidasRoutes);
app.use('/api/inventario/transferencias', transferenciasRoutes);
app.use('/api/inventario', inventarioRoutes);

app.use('/api/produccion/ordenes', ordenesProduccionRoutes);

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path,
    method: req.method
  });
});

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

  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message
    });
  }

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

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    code: err.code,
    sqlState: err.sqlState,
    sql: err.sql,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

async function startServer() {
  try {
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('No se pudo conectar a la base de datos. Verifica la configuración.');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log('='.repeat(60));
      console.log(`Servidor INDPACK ejecutándose en puerto ${PORT}`);
      console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`URL Local: http://localhost:${PORT}`);
      console.log(`Health Check: http://localhost:${PORT}/api/health`);
      console.log(`Base de datos: CONECTADA`);
      console.log('='.repeat(60));
      console.log('Rutas disponibles:');
      console.log('   - /api/empleados');
      console.log('   - /api/flota');
      console.log('   - /api/proveedores');
      console.log('   - /api/clientes');
      console.log('   - /api/productos');
      console.log('   - /api/inventario/movimientos-entradas');
      console.log('   - /api/inventario/movimientos-salidas');
      console.log('   - /api/inventario/transferencias');
      console.log('   - /api/inventario');
      console.log('   - /api/produccion/ordenes');
      console.log('   - /api/dashboard');
      console.log('='.repeat(60));
      console.log('MODO DEBUG ACTIVADO');
      console.log('='.repeat(60));
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM recibido. Cerrando servidor gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT recibido. Cerrando servidor gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('='.repeat(80));
  console.error('Unhandled Rejection');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  console.error('='.repeat(80));
});

process.on('uncaughtException', (error) => {
  console.error('='.repeat(80));
  console.error('Uncaught Exception');
  console.error(error);
  console.error('='.repeat(80));
  process.exit(1);
});

startServer();