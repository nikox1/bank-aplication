require('dotenv').config();
const { Pool } = require('pg');

// First connect to default 'postgres' database to create bankdb if needed
const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: 'postgres',  // Connect to default database
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Pool for the bankdb database
const dbName = process.env.DB_NAME || 'bankdb';

async function initDatabase() {
  let client;
  
  try {
    console.log('🔧 Initializing database...');
    console.log(`📡 Connecting to PostgreSQL at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
    
    // Step 1: Connect to postgres database and create bankdb if needed
    client = await adminPool.connect();
    
    // Check if bankdb exists
    const res = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    
    if (res.rows.length === 0) {
      console.log(`📦 Creating database '${dbName}'...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created successfully`);
    } else {
      console.log(`ℹ️  Database '${dbName}' already exists`);
    }
    
    client.release();
    await adminPool.end();
    
    // Step 2: Connect to bankdb and create tables
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: dbName,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    });
    
    client = await pool.connect();
    
    // Create tables
    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Accounts table (changed account_number to VARCHAR(32))
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(15, 2) DEFAULT 0,
        account_number VARCHAR(32) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Transactions table (changed from_account/to_account to VARCHAR(32))
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        description TEXT,
        from_account VARCHAR(32),
        to_account VARCHAR(32),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- BLIK codes table
      CREATE TABLE IF NOT EXISTS blik_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(6) NOT NULL,
        amount DECIMAL(15, 2),
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Login attempts table (for security)
      CREATE TABLE IF NOT EXISTS login_attempts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        success BOOLEAN NOT NULL,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Shop users table
      CREATE TABLE IF NOT EXISTS shop_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        balance DECIMAL(15, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Shop payments table
      CREATE TABLE IF NOT EXISTS shop_payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES shop_users(id) ON DELETE CASCADE,
        amount DECIMAL(15, 2) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        blik_code VARCHAR(6),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Products table
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(15, 2) NOT NULL,
        description TEXT,
        icon VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- API keys table
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_blik_codes_user_id ON blik_codes(user_id);
      CREATE INDEX IF NOT EXISTS idx_blik_codes_code ON blik_codes(code);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id);
    `);
    
    console.log('✅ Tables created successfully');
    
  
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('demo123', 10);
    
    const userCheck = await client.query('SELECT id FROM users WHERE email = $1', ['demo@bank.pl']);
    
    if (userCheck.rows.length === 0) {

      await client.query(`
        INSERT INTO users (email, password, name) VALUES 
        ($1, $2, 'Demo User'),
        ($3, $2, 'Test User')
      `, ['demo@bank.pl', hashedPassword, 'test@bank.pl']);
      
      await client.query(`
        INSERT INTO accounts (user_id, balance, account_number) VALUES 
        (1, 1000.00, 'PL123456789012345678901234'),
        (2, 500.00, 'PL987654321098765432109876')
      `);
      
      await client.query(`
        INSERT INTO shop_users (email, password, name, balance) VALUES 
        ($1, $2, 'Demo User', 0)
      `, ['demo@bank.pl', hashedPassword]);
      
      console.log('✅ Demo data inserted');
    } else {
      console.log('ℹ️  Demo data already exists');
    }
    
    const productCheck = await client.query('SELECT id FROM products LIMIT 1');
    if (productCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO products (name, price, description, icon) VALUES 
        ('Premium Subscription', 29.99, '1 month premium access', '⭐'),
        ('Game Credits', 10.00, '1000 game credits', '🎮'),
        ('Digital Gift Card', 50.00, '50 PLN gift card', '🎁'),
        ('Movie Ticket', 25.00, 'Single movie ticket', '🎬'),
        ('E-Book', 15.99, 'Premium e-book access', '📚'),
        ('Music Subscription', 19.99, '1 month music streaming', '🎵')
      `);
      console.log('✅ Products inserted');
    }
    
    const apiKeyCheck = await client.query('SELECT id FROM api_keys WHERE key = $1', ['bank-api-key-12345']);
    if (apiKeyCheck.rows.length === 0) {
      await client.query(`
        INSERT INTO api_keys (key, name) VALUES ('bank-api-key-12345', 'Shop Integration')
      `);
      console.log('✅ API key inserted');
    }
    
    client.release();
    await pool.end();
    
    console.log('');
    console.log('🎉 Database initialization completed!');
    console.log('');
    // console.log('📋 Demo credentials:');
    // console.log('   Email: demo@bank.pl');
    // console.log('   Password: demo123');
    // console.log('   Balance: 1000 PLN');
    // console.log('');
    
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    console.error('');
    console.error('💡 Possible solutions:');
    console.error('   1. Make sure PostgreSQL is running');
    console.error('   2. Check your .env file has correct DB_USER and DB_PASSWORD');
    console.error('   3. Try connecting manually: psql -U postgres');
    console.error('');
    if (client) client.release();
    process.exit(1);
  }
}

initDatabase();
