const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'seocompany_super_secret_key_2026';

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(403).json({ error: 'Nenhum token fornecido.' });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>
    if (!token) {
        return res.status(403).json({ error: 'Token mal formatado.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Falha ao autenticar token. Sessão expirada.' });
        }
        
        req.user = decoded;

        // Determina a empresa ativa para a requisição
        const customCompanyHeader = req.headers['x-company-id'];
        if (decoded.is_master && customCompanyHeader) {
            req.company_id = customCompanyHeader;
        } else if (decoded.is_master) {
            req.company_id = decoded.current_company_id || decoded.company_id;
        } else {
            req.company_id = decoded.company_id;
        }

        next();
    });
}

function requireAdmin(req, res, next) {
    if (!req.user || (!req.user.can_create_users && !req.user.is_master)) {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para gerenciar usuários.' });
    }
    next();
}

function requireMaster(req, res, next) {
    if (!req.user || !req.user.is_master) {
        return res.status(403).json({ error: 'Acesso negado. Recurso exclusivo para Usuário Master.' });
    }
    next();
}

module.exports = {
    verifyToken,
    requireAdmin,
    requireMaster,
    JWT_SECRET
};
