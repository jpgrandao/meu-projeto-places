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

// Obter dados de uma empresa específica por ID (Master apenas ou própria empresa)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.user.is_master && req.company_id !== id) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }
        const company = await getCompanyById(id);
        if (!company) {
            return res.status(404).json({ error: 'Empresa não encontrada.' });
        }
        res.json({ success: true, data: company });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar nova empresa (Master apenas)
router.post('/', requireMaster, async (req, res) => {
    try {
        const { name, allow_excel_export, crm_enabled, crm_provider, crm_config } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'O nome da empresa é obrigatório.' });
        }

        const options = {
            allow_excel_export: allow_excel_export !== undefined ? !!allow_excel_export : true,
            crm_enabled: crm_enabled !== undefined ? !!crm_enabled : false,
            crm_provider: crm_provider || 'mz_partners',
            crm_config: crm_config || {}
        };

        const result = await createCompany(name, req.user.id, options);
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
        const { name, allow_excel_export, crm_enabled, crm_provider, crm_config } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (allow_excel_export !== undefined) updates.allow_excel_export = allow_excel_export;
        if (crm_enabled !== undefined) updates.crm_enabled = crm_enabled;
        if (crm_provider !== undefined) updates.crm_provider = crm_provider;
        if (crm_config !== undefined) updates.crm_config = crm_config;

        const result = await updateCompany(id, updates);
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
                name: company.name,
                crm_enabled: !!company.crm_enabled,
                allow_excel_export: company.allow_excel_export !== false
            },
            message: `Empresa ativa alterada para "${company.name}"`
        });
    } catch (error) {
        console.error('Erro ao trocar de empresa:', error);
        res.status(500).json({ error: 'Erro ao trocar de empresa' });
    }
});

module.exports = router;
