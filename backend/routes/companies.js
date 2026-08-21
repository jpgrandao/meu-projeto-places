const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { verifyToken, requireMaster, JWT_SECRET } = require('../middleware/authMiddleware');
const { 
    getCompanies, 
    getCompanyById, 
    createCompany, 
    updateCompany, 
    deleteCompany, 
    getUserById, 
    updateUserById 
} = require('../database/mongodb');

// Proteger todas as rotas de empresas (requer token válido)
router.use(verifyToken);

// Listar todas as empresas (Master apenas)
router.get('/', requireMaster, async (req, res) => {
    try {
        const companies = await getCompanies();
        res.json({ success: true, data: companies });
    } catch (error) {
        console.error('Erro ao listar empresas:', error);
        res.status(500).json({ error: 'Erro ao listar empresas' });
    }
});

// Criar nova empresa (Master apenas)
router.post('/', requireMaster, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
        }

        const result = await createCompany(name, req.user.id);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ success: true, id: result.id, name: result.name, message: 'Empresa criada com sucesso' });
    } catch (error) {
        console.error('Erro ao criar empresa:', error);
        res.status(500).json({ error: 'Erro interno ao criar empresa' });
    }
});

// Editar empresa (Master apenas)
router.put('/:id', requireMaster, async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
        }

        const result = await updateCompany(id, { name });
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ success: true, message: 'Empresa atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao editar empresa:', error);
        res.status(500).json({ error: 'Erro interno ao editar empresa' });
    }
});

// Excluir empresa (Master apenas)
router.delete('/:id', requireMaster, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Buscar empresa
        const company = await getCompanyById(id);
        if (!company) {
            return res.status(404).json({ error: 'Empresa não encontrada.' });
        }

        const result = await deleteCompany(id);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        // Se a empresa excluída for a empresa atual do Master, volta para a primeira disponível
        if (req.user.current_company_id === id) {
            const remaining = await getCompanies();
            const fallbackCompany = remaining[0];
            if (fallbackCompany) {
                await updateUserById(req.user.id, { current_company_id: fallbackCompany._id });
            }
        }

        res.json({ success: true, message: 'Empresa e seus dados foram excluídos com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir empresa:', error);
        res.status(500).json({ error: 'Erro interno ao excluir empresa' });
    }
});

// Trocar de empresa ativa (Master apenas)
router.post('/switch', requireMaster, async (req, res) => {
    try {
        const { companyId } = req.body;
        if (!companyId) {
            return res.status(400).json({ error: 'ID da empresa é obrigatório.' });
        }

        const company = await getCompanyById(companyId);
        if (!company) {
            return res.status(404).json({ error: 'Empresa não encontrada.' });
        }

        // Atualiza a empresa atual do usuário Master no banco
        await updateUserById(req.user.id, { current_company_id: company._id });

        const user = await getUserById(req.user.id);

        // Gera novo token com a empresa atualizada
        const payload = {
            id: user._id,
            email: user.email,
            name: user.name || 'Usuário',
            can_create_users: user.can_create_users,
            is_master: user.is_master,
            company_id: user.company_id,
            current_company_id: company._id
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            success: true,
            token,
            activeCompany: {
                id: company._id,
                name: company.name
            },
            message: `Empresa ativa alterada para "${company.name}"`
        });
    } catch (error) {
        console.error('Erro ao trocar de empresa:', error);
        res.status(500).json({ error: 'Erro ao trocar de empresa' });
    }
});

module.exports = router;
