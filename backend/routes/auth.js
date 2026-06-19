const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getUserByEmail } = require('../database/mongodb');
const { verifyToken, JWT_SECRET } = require('../middleware/authMiddleware');

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
        }

        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        // Criar o payload do token
        const payload = {
            id: user._id,
            email: user.email,
            can_create_users: user.can_create_users
        };

        // Gerar o token com expiração de 24 horas
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            success: true,
            token,
            user: {
                email: user.email,
                can_create_users: user.can_create_users
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

// Checar sessão
router.get('/me', verifyToken, (req, res) => {
    // Se o middleware passou, o token é válido e req.user existe
    res.json({
        success: true,
        user: {
            email: req.user.email,
            can_create_users: req.user.can_create_users
        }
    });
});

// Forçar inicialização (caso de emergência)
const { initSuperUser } = require('../database/mongodb');
router.get('/init', async (req, res) => {
    try {
        await initSuperUser();
        res.json({ success: true, message: 'Processo de inicialização do superusuário rodou! Tente fazer login agora com joao@seocompany.com.br' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
