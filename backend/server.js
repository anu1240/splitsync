const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'splitsync',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// ─── DB INIT ──────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      group_id INT REFERENCES groups(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      group_id INT REFERENCES groups(id) ON DELETE CASCADE,
      description VARCHAR(200) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      paid_by INT REFERENCES members(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS expense_splits (
      id SERIAL PRIMARY KEY,
      expense_id INT REFERENCES expenses(id) ON DELETE CASCADE,
      member_id INT REFERENCES members(id),
      share DECIMAL(10,2) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settlements (
      id SERIAL PRIMARY KEY,
      group_id INT REFERENCES groups(id) ON DELETE CASCADE,
      from_member INT REFERENCES members(id),
      to_member INT REFERENCES members(id),
      amount DECIMAL(10,2) NOT NULL,
      settled_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ Database initialized');
}

// ─── GROUPS ───────────────────────────────────────────────
app.post('/api/groups', async (req, res) => {
  const { name } = req.body;
  const result = await pool.query(
    'INSERT INTO groups (name) VALUES ($1) RETURNING *', [name]
  );
  res.json(result.rows[0]);
});

app.get('/api/groups', async (req, res) => {
  const { member } = req.query;
  if (member) {
    const result = await pool.query(`
      SELECT DISTINCT g.* FROM groups g
      JOIN members m ON m.group_id = g.id
      WHERE m.name ILIKE $1
      ORDER BY g.created_at DESC
    `, [member]);
    res.json(result.rows);
  } else {
    const result = await pool.query('SELECT * FROM groups ORDER BY created_at DESC');
    res.json(result.rows);
  }
});

app.get('/api/groups/:id', async (req, res) => {
  const { id } = req.params;
  const group = await pool.query('SELECT * FROM groups WHERE id=$1', [id]);
  const members = await pool.query('SELECT * FROM members WHERE group_id=$1', [id]);
  const expenses = await pool.query(`
    SELECT e.*, m.name as paid_by_name FROM expenses e
    JOIN members m ON e.paid_by = m.id
    WHERE e.group_id=$1 ORDER BY e.created_at DESC
  `, [id]);
  res.json({ ...group.rows[0], members: members.rows, expenses: expenses.rows });
});

// ─── MEMBERS ──────────────────────────────────────────────
app.post('/api/groups/:id/members', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const result = await pool.query(
    'INSERT INTO members (group_id, name) VALUES ($1, $2) RETURNING *', [id, name]
  );
  io.to(`group_${id}`).emit('member_added', result.rows[0]);
  res.json(result.rows[0]);
});

// ─── EXPENSES ─────────────────────────────────────────────
app.post('/api/groups/:id/expenses', async (req, res) => {
  const { id } = req.params;
  const { description, amount, paid_by, split_among } = req.body;

  const expRes = await pool.query(
    'INSERT INTO expenses (group_id, description, amount, paid_by) VALUES ($1,$2,$3,$4) RETURNING *',
    [id, description, amount, paid_by]
  );
  const expense = expRes.rows[0];
  const share = (amount / split_among.length).toFixed(2);

  for (const memberId of split_among) {
    await pool.query(
      'INSERT INTO expense_splits (expense_id, member_id, share) VALUES ($1,$2,$3)',
      [expense.id, memberId, share]
    );
  }

  const paidByName = await pool.query('SELECT name FROM members WHERE id=$1', [paid_by]);
  const fullExpense = { ...expense, paid_by_name: paidByName.rows[0].name, split_among, share };

  io.to(`group_${id}`).emit('expense_added', fullExpense);
  res.json(fullExpense);
});

// ─── BALANCES ─────────────────────────────────────────────
app.get('/api/groups/:id/balances', async (req, res) => {
  const { id } = req.params;
  const members = await pool.query('SELECT * FROM members WHERE group_id=$1', [id]);
  const balances = {};
  members.rows.forEach(m => { balances[m.id] = { name: m.name, net: 0 }; });

  // What each person paid
  const paid = await pool.query(`
    SELECT paid_by, SUM(amount) as total FROM expenses WHERE group_id=$1 GROUP BY paid_by
  `, [id]);
  paid.rows.forEach(r => { if (balances[r.paid_by]) balances[r.paid_by].net += parseFloat(r.total); });

  // What each person owes
  const owes = await pool.query(`
    SELECT es.member_id, SUM(es.share) as total FROM expense_splits es
    JOIN expenses e ON es.expense_id = e.id WHERE e.group_id=$1 GROUP BY es.member_id
  `, [id]);
  owes.rows.forEach(r => { if (balances[r.member_id]) balances[r.member_id].net -= parseFloat(r.total); });

  // Subtract settlements
  const settled = await pool.query(
    'SELECT from_member, to_member, SUM(amount) as total FROM settlements WHERE group_id=$1 GROUP BY from_member, to_member',
    [id]
  );
  settled.rows.forEach(r => {
    if (balances[r.from_member]) balances[r.from_member].net += parseFloat(r.total);
    if (balances[r.to_member]) balances[r.to_member].net -= parseFloat(r.total);
  });

  res.json(Object.values(balances));
});

// ─── SETTLEMENTS ──────────────────────────────────────────
app.post('/api/groups/:id/settle', async (req, res) => {
  const { id } = req.params;
  const { from_member, to_member, amount } = req.body;
  const result = await pool.query(
    'INSERT INTO settlements (group_id, from_member, to_member, amount) VALUES ($1,$2,$3,$4) RETURNING *',
    [id, from_member, to_member, amount]
  );
  io.to(`group_${id}`).emit('settled', result.rows[0]);
  res.json(result.rows[0]);
});
// ─── DELETE GROUP
app.delete('/api/groups/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM groups WHERE id=$1', [id]);
  res.json({ success: true });
});

// ─── RENAME GROUP
app.put('/api/groups/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const result = await pool.query(
    'UPDATE groups SET name=$1 WHERE id=$2 RETURNING *', [name, id]
  );
  res.json(result.rows[0]);
});

// ─── HEALTH CHECK ─────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── WEBSOCKET ────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('join_group', (groupId) => {
    socket.join(`group_${groupId}`);
  });
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Server running on port ${PORT}`);
});
