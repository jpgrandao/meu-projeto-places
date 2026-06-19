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
            return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
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
            name: user.name || 'Usuário',
            can_create_users: user.can_create_users
        };

        // Gerar o token com expiração de 24 horas
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name || 'Usuário',
                can_create_users: user.can_create_users
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro no login.' });
    }
});

// Checar sessão
router.get('/me', verifyToken, async (req, res) => {
    try {
        // Buscar o usuário atualizado no banco
        const { getUserById } = require('../database/mongodb');
        const user = await getUserById(req.user.id);
        
        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado.' });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name || 'Usuário',
                can_create_users: user.can_create_users
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar sessão.' });
    }
});

// Atualizar perfil
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const { name, currentPassword, newPassword } = req.body;
        const { getUserById, updateUserById } = require('../database/mongodb');
        
        const user = await getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const updates = {};
        if (name) updates.name = name;

        if (currentPassword && newPassword) {
            const isValidPassword = await bcrypt.compare(currentPassword, user.password);
            if (!isValidPassword) {
                return res.status(400).json({ error: 'Senha atual incorreta.' });
            }
            updates.password = await bcrypt.hash(newPassword, 10);
        }

        const success = await updateUserById(req.user.id, updates);
        if (success) {
            res.json({ success: true, message: 'Perfil atualizado com sucesso.' });
        } else {
            res.status(500).json({ error: 'Erro ao atualizar perfil.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao atualizar perfil.' });
    }
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
