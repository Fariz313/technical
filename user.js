require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const app = express();
app.use(express.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

db.connect((err) => {
    if (err) throw err;
    console.log('MySQL connected');
});

const generateCode = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(100000 + Math.random() * 900000);
    return `${date}${random}`;
};

app.post('/users', async (req, res) => {
    const { name, email, phone_number, password } = req.body;

    if (!validator.isEmail(email)) {
        return res.status(400).json({ message: 'Invalid email' });
    }

    if (!validator.isStrongPassword(password, { minLength: 8, minNumbers: 1, minSymbols: 1 })) {
        return res.status(400).json({ message: 'Password must contain at least one number and one special character' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const code = generateCode();

    const sql = 'INSERT INTO users (code, name, email, phone_number, password) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [code, name, email, phone_number, hashedPassword], (err, result) => {
        if (err) return res.status(400).json({ message: err.message });
        res.status(201).json({ id: result.insertId, code, name, email, phone_number });
    });
});

app.get('/users', (req, res) => {
    const sql = 'SELECT id, code, name, email, phone_number, created_at FROM users';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        res.status(200).json(results);
    });
});

app.get('/users/:id', (req, res) => {
    const sql = 'SELECT id, code, name, email, phone_number, created_at FROM users WHERE id = ?';
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'User not found' });
        res.status(200).json(results[0]);
    });
});

app.put('/users/:id', async (req, res) => {
    const { name, email, phone_number, password } = req.body;
    const userId = req.params.id;

    let hashedPassword;
    if (password) {

        if (!validator.isStrongPassword(password, { minLength: 8, minNumbers: 1, minSymbols: 1 })) {
            return res.status(400).json({ message: 'Password must contain at least one number and one special character' });
        }
        hashedPassword = await bcrypt.hash(password, 12);
    }

    const sql = 'UPDATE users SET name = ?, email = ?, phone_number = ?, password = ? WHERE id = ?';
    db.query(sql, [name, email, phone_number, hashedPassword || null, userId], (err, result) => {
        if (err) return res.status(400).json({ message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ message: 'User updated successfully' });
    });
});

app.delete('/users/:id', (req, res) => {
    const sql = 'DELETE FROM users WHERE id = ?';
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ message: 'User deleted successfully' });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));