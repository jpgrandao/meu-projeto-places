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
        
        // Salva os dados do usuário para as próximas rotas
        req.user = decoded;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (!req.user || !req.user.can_create_users) {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para gerenciar usuários.' });
    }
    next();
}

module.exports = {
    verifyToken,
    requireAdmin,
    JWT_SECRET
};
