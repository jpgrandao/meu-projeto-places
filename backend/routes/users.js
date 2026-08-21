const express = require('express');
const router = express.Router();
const { getUsers, createUser, deleteUser, updateUserById, getCompanies } = require('../database/mongodb');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// Proteger todas as rotas de usuários (exige token válido e permissão de admin)
router.use(verifyToken);
router.use(requireAdmin);

// Listar usuários (Master vê todos ou por empresa; admin comum vê apenas da sua empresa)
router.get('/', async (req, res) => {
    try {
        const isMaster = !!req.user.is_master;
        // Se a query string 'company_id' for informada ou req.company_id
        const targetCompanyId = req.query.company_id || req.company_id;
        
        const users = await getUsers(targetCompanyId, isMaster);
        const companies = isMaster ? await getCompanies() : [];
        const companyMap = {};
        companies.forEach(c => { companyMap[c._id.toString()] = c.name; });

        // Mapeia o nome da empresa para cada usuário
        const usersWithCompanyName = users.map(u => ({
            ...u,
            company_name: u.company_id && companyMap[u.company_id.toString()] ? companyMap[u.company_id.toString()] : 'N/A'
        }));

        res.json({ success: true, data: usersWithCompanyName });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// Criar novo usuário
router.post('/', async (req, res) => {
    try {
        const { name, email, password, can_create_users, company_id } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
        }

        const isMaster = !!req.user.is_master;
        // Master pode definir qual empresa o usuário pertence. Caso contrário, usa req.company_id do admin logado.
        const assignedCompanyId = isMaster && company_id ? company_id : req.company_id;

        if (!assignedCompanyId) {
            return res.status(400).json({ error: 'Empresa de destino é obrigatória.' });
        }

        const result = await createUser(name, email, password, can_create_users, assignedCompanyId, false);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ success: true, message: 'Usuário criado com sucesso' });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro interno ao criar usuário' });
    }
});

// Editar usuário
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, can_create_users, company_id } = req.body;
        const bcrypt = require('bcryptjs');

        const isMaster = !!req.user.is_master;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (can_create_users !== undefined) updates.can_create_users = !!can_create_users;
        if (isMaster && company_id !== undefined) updates.company_id = company_id;
        
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
        
        if (req.user.id === id) {
            return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });
        }

        const isMaster = !!req.user.is_master;
        const result = await deleteUser(id, req.company_id, isMaster);
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
