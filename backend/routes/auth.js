const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getUserByEmail, getCompanyById, getCompanies, getUserById, updateUserById, initMultiTenantAndSuperUser } = require('../database/mongodb');
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

        const isMaster = !!user.is_master;
        const companyId = user.company_id ? user.company_id.toString() : null;
        const currentCompanyId = (user.current_company_id || user.company_id) ? (user.current_company_id || user.company_id).toString() : null;

        // Buscar dados da empresa ativa
        let companyName = 'N/A';
        let crmEnabled = false;
        let allowExcelExport = true;
        if (currentCompanyId) {
            const comp = await getCompanyById(currentCompanyId);
            if (comp) {
                companyName = comp.name;
                crmEnabled = !!comp.crm_enabled;
                allowExcelExport = comp.allow_excel_export !== false;
            }
        }

        let companiesList = [];
        if (isMaster) {
            companiesList = await getCompanies();
        }

        // Criar o payload do token
        const payload = {
            id: user._id,
            email: user.email,
            name: user.name || 'Usuário',
            can_create_users: !!user.can_create_users,
            is_master: isMaster,
            company_id: companyId,
            current_company_id: currentCompanyId
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name || 'Usuário',
                can_create_users: !!user.can_create_users,
                is_master: isMaster,
                company_id: companyId,
                current_company_id: currentCompanyId,
                company_name: companyName,
                crm_enabled: crmEnabled,
                allow_excel_export: allowExcelExport
            },
            companies: companiesList
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro no login.' });
    }
});

// Checar sessão
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await getUserById(req.user.id);
        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado.' });
        }

        const isMaster = !!user.is_master;
        const companyId = user.company_id ? user.company_id.toString() : null;
        
        // Se Master, a empresa ativa vem de req.company_id ou current_company_id
        const activeCompanyId = isMaster && req.company_id ? req.company_id : ((user.current_company_id || user.company_id) ? (user.current_company_id || user.company_id).toString() : null);

        let companyName = 'N/A';
        let crmEnabled = false;
        let allowExcelExport = true;
        if (activeCompanyId) {
            const comp = await getCompanyById(activeCompanyId);
            if (comp) {
                companyName = comp.name;
                crmEnabled = !!comp.crm_enabled;
                allowExcelExport = comp.allow_excel_export !== false;
            }
        }

        let companiesList = [];
        if (isMaster) {
            companiesList = await getCompanies();
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name || 'Usuário',
                can_create_users: !!user.can_create_users,
                is_master: isMaster,
                company_id: companyId,
                current_company_id: activeCompanyId,
                company_name: companyName,
                crm_enabled: crmEnabled,
                allow_excel_export: allowExcelExport
            },
            companies: companiesList
        });
    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        res.status(500).json({ error: 'Erro ao verificar sessão.' });
    }
});

// Atualizar perfil
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const { name, currentPassword, newPassword } = req.body;
        
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

// Forçar inicialização (emergência)
router.get('/init', async (req, res) => {
    try {
        await initMultiTenantAndSuperUser();
        res.json({ success: true, message: 'Processo de inicialização multi-tenant concluído!' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
