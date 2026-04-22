require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'bank-super-secret-key-2024';
const API_KEY = process.env.API_KEY || 'bank-api-key-12345';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bankdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});


const generateAccountNumber = () => {
  const digits = Math.floor(Math.random() * 100000000000000000000000).toString().padStart(24, '0');
  return 'PL' + digits;
};


const generateBlikCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

app.use(cors());
app.use(express.json());

const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['authorization']?.replace('Bearer ', '');
  if (apiKey === API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid API key' });
  }
};

const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const userResult = await client.query(
        'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
        [email, hashedPassword, name]
      );
      
      const user = userResult.rows[0];
      const accountNumber = generateAccountNumber();
      
      const accountResult = await client.query(
        'INSERT INTO accounts (user_id, balance, account_number) VALUES ($1, 1000, $2) RETURNING id, account_number, balance',
        [user.id, accountNumber]
      );
      
      await client.query('COMMIT');
      
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        account: accountResult.rows[0]
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT u.*, a.id as account_id, a.balance, a.account_number FROM users u LEFT JOIN accounts a ON u.id = a.user_id WHERE u.email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    const attemptsResult = await pool.query(
      'SELECT COUNT(*) FROM login_attempts WHERE user_id = $1 AND success = false AND created_at > NOW() - INTERVAL \'15 minutes\'',
      [user.id]
    );
    
    if (parseInt(attemptsResult.rows[0].count) >= 3) {
      return res.status(429).json({ error: 'Account temporarily locked. Try again later.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    await pool.query(
      'INSERT INTO login_attempts (user_id, success, ip_address) VALUES ($1, $2, $3)',
      [user.id, validPassword, req.ip]
    );

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      account: user.account_id ? {
        id: user.account_id,
        accountNumber: user.account_number,
        balance: parseFloat(user.balance)
      } : null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/account/balance', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT balance, account_number FROM accounts WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({
      balance: parseFloat(result.rows[0].balance),
      accountNumber: result.rows[0].account_number
    });
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/transfer', authMiddleware, async (req, res) => {
  const { toAccount, amount, title } = req.body;

  if (!toAccount || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid transfer data' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const senderResult = await client.query(
        'SELECT * FROM accounts WHERE user_id = $1 FOR UPDATE',
        [req.userId]
      );

      if (senderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Sender account not found' });
      }

      const senderAccount = senderResult.rows[0];

      if (parseFloat(senderAccount.balance) < amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient funds' });
      }

      const recipientResult = await client.query(
        'SELECT * FROM accounts WHERE account_number = $1 FOR UPDATE',
        [toAccount]
      );

      if (recipientResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Recipient account not found' });
      }

      const recipientAccount = recipientResult.rows[0];

      await client.query(
        'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
        [amount, senderAccount.id]
      );

      await client.query(
        'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
        [amount, recipientAccount.id]
      );

      await client.query(
        'INSERT INTO transactions (account_id, user_id, type, amount, description, from_account, to_account) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [senderAccount.id, req.userId, 'transfer', -amount, title || 'Transfer', senderAccount.account_number, toAccount]
      );

      await client.query(
        'INSERT INTO transactions (account_id, user_id, type, amount, description, from_account, to_account) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [recipientAccount.id, recipientAccount.user_id, 'transfer', amount, title || 'Transfer received', senderAccount.account_number, toAccount]
      );

      await client.query('COMMIT');
      res.json({ success: true, message: 'Transfer completed successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/blik/generate', authMiddleware, async (req, res) => {
  const { amount } = req.body;

  try {
    const existingResult = await pool.query(
      'SELECT * FROM blik_codes WHERE user_id = $1 AND status = $2 AND expires_at > NOW()',
      [req.userId, 'active']
    );

    if (existingResult.rows.length > 0) {
      const existingCode = existingResult.rows[0];
      return res.json({
        code: existingCode.code,
        expiresAt: existingCode.expires_at,
        remainingSeconds: Math.floor((new Date(existingCode.expires_at) - new Date()) / 1000)
      });
    }

    const code = generateBlikCode();
    const expiresAt = new Date(Date.now() + 120 * 1000);

    const result = await pool.query(
      'INSERT INTO blik_codes (user_id, code, amount, expires_at, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, code, amount || null, expiresAt, 'active']
    );

    res.json({
      code: result.rows[0].code,
      expiresAt: result.rows[0].expires_at,
      remainingSeconds: 120
    });
  } catch (error) {
    console.error('BLIK generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/blik/pay', apiKeyMiddleware, async (req, res) => {
  const { code, amount } = req.body;

  if (!code || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid BLIK payment data' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const blikResult = await client.query(
        'SELECT bc.*, a.id as account_id, a.balance FROM blik_codes bc JOIN accounts a ON bc.user_id = a.user_id WHERE bc.code = $1 AND bc.status = $2 FOR UPDATE',
        [code, 'active']
      );

      if (blikResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid BLIK code' });
      }

      const blikCode = blikResult.rows[0];

      if (new Date(blikCode.expires_at) < new Date()) {
        await client.query('UPDATE blik_codes SET status = $1 WHERE id = $2', ['expired', blikCode.id]);
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'BLIK code expired' });
      }

      if (blikCode.amount && parseFloat(blikCode.amount) !== amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Amount mismatch' });
      }

      if (parseFloat(blikCode.balance) < amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient funds' });
      }

      await client.query(
        'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
        [amount, blikCode.account_id]
      );

      await client.query(
        'UPDATE blik_codes SET status = $1 WHERE id = $2',
        ['used', blikCode.id]
      );

      await client.query(
        'INSERT INTO transactions (account_id, user_id, type, amount, description) VALUES ($1, $2, $3, $4, $5)',
        [blikCode.account_id, blikCode.user_id, 'blik_payment', -amount, 'BLIK payment']
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Payment completed',
        userId: blikCode.user_id
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('BLIK payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/transactions', authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.userId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM transactions WHERE user_id = $1',
      [req.userId]
    );

    res.json({
      transactions: result.rows.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        description: tx.description,
        fromAccount: tx.from_account,
        toAccount: tx.to_account,
        createdAt: tx.created_at
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/deposit', apiKeyMiddleware, async (req, res) => {
  const { userId, amount, description } = req.body;

  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid deposit data' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const accountResult = await client.query(
        'SELECT * FROM accounts WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (accountResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Account not found' });
      }

      const account = accountResult.rows[0];

      await client.query(
        'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
        [amount, account.id]
      );

      await client.query(
        'INSERT INTO transactions (account_id, user_id, type, amount, description) VALUES ($1, $2, $3, $4, $5)',
        [account.id, userId, 'deposit', amount, description || 'Deposit']
      );

      await client.query('COMMIT');
      res.json({ success: true, message: 'Deposit completed' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/shop/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM shop_users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, shop: true }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        balance: parseFloat(user.balance)
      }
    });
  } catch (error) {
    console.error('Shop login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/shop/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const existingUser = await pool.query('SELECT id FROM shop_users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO shop_users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, balance',
      [email, hashedPassword, name]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, shop: true }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        balance: parseFloat(user.balance)
      }
    });
  } catch (error) {
    console.error('Shop register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/shop/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/shop/purchase', async (req, res) => {
  const { blikCode, productId, token } = req.body;

  if (!blikCode || !productId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = productResult.rows[0];

    const response = await fetch(`http://localhost:${PORT}/api/blik/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        code: blikCode,
        amount: parseFloat(product.price)
      })
    });

    const paymentResult = await response.json();

    if (!paymentResult.success) {
      return res.status(400).json({ error: paymentResult.error || 'Payment failed' });
    }

    await pool.query(
      'INSERT INTO shop_payments (user_id, amount, description, status, blik_code) VALUES ($1, $2, $3, $4, $5)',
      [userId, product.price, `Purchase: ${product.name}`, 'completed', blikCode]
    );

    await pool.query(
      'UPDATE shop_users SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
      [product.price, userId]
    );

    res.json({
      success: true,
      message: `Successfully purchased ${product.name}`
    });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/shop/profile', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await pool.query(
      'SELECT id, email, name, balance FROM shop_users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'bank-server', timestamp: new Date().toISOString() });
});

pool.connect()
  .then(() => {
    console.log('✅ Connected to PostgreSQL database');
    app.listen(PORT, () => {
      console.log(`🏦 Bank Server running on port ${PORT}`);
      console.log(`📡 API endpoints:`);
      console.log(`   - POST /api/register`);
      console.log(`   - POST /api/login`);
      console.log(`   - GET  /api/account/balance`);
      console.log(`   - POST /api/transfer`);
      console.log(`   - POST /api/blik/generate`);
      console.log(`   - POST /api/blik/pay`);
      console.log(`   - GET  /api/transactions`);
      console.log(`   - POST /api/deposit`);
      console.log(`   - POST /api/shop/login`);
      console.log(`   - POST /api/shop/register`);
      console.log(`   - GET  /api/shop/products`);
      console.log(`   - POST /api/shop/purchase`);
    });
  })
  .catch(err => {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  });
