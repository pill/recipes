import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'recipes',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
};

// Create connection pool with optimized settings
export const pool = new Pool({
  ...dbConfig,
  // Increase pool size for parallel processing
  max: 20, // Maximum number of clients in the pool
  min: 5,  // Minimum number of clients in the pool
  // Connection timeout settings
  connectionTimeoutMillis: 10000, // 10 seconds
  idleTimeoutMillis: 30000, // 30 seconds
  // Statement timeout
  statement_timeout: 30000, // 30 seconds
  // Query timeout
  query_timeout: 30000, // 30 seconds
  // Keep alive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    const result = await client.query('SELECT NOW()');
    console.log('📅 Database time:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Close all connections
export async function closeConnection() {
  await pool.end();
}
