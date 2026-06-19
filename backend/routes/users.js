const express = require('express');
const router = express.Router();
const { getUsers, createUser, deleteUser } = require('../database/mongodb');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// Proteger todas as rotas de usuários (exige token válido e permissão de admin)
router.use(verifyToken);
router.use(requireAdmin);

// Listar todos os usuários
router.get('/', async (req, res) => {
    try {
        const users = await getUsers();
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// Criar novo usuário
router.post('/', async (req, res) => {
    try {
        const { name, email, password, can_create_users } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
        }

        const result = await createUser(name, email, password, can_create_users);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ success: true, message: 'Usuário criado com sucesso' });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro interno ao criar usuário' });
    }
});

// Editar usuário (Master)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, can_create_users } = req.body;
        const { updateUserById } = require('../database/mongodb');
        const bcrypt = require('bcryptjs');

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (can_create_users !== undefined) updates.can_create_users = !!can_create_users;
        
        if (password && password.trim() !== '') {
            updates.password = await bcrypt.hash(password, 10);
        }

        const success = await updateUserById(id, updates);
        if (success) {
            res.json({ success: true, message: 'Usuário atualizado com sucesso' });
        } else {
            res.status(500).json({ error: 'Erro ao atualizar usuário' });
        }
    } catch (error) {
        console.error('Erro ao editar usuário:', error);
        res.status(500).json({ error: 'Erro interno ao editar usuário' });
    }
});

// Excluir usuário
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Evitar que o usuário exclua a si mesmo
        if (req.user.id === id) {
            return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });
        }

        const result = await deleteUser(id);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ success: true, message: 'Usuário excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ error: 'Erro interno ao excluir usuário' });
    }
});

module.exports = router;
