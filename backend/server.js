const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { initMultiTenantAndSuperUser } = require('./database/mongodb');
const { cleanOldExportFiles } = require('./excelExporter');

// Load env vars
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DOWNLOADS_DIR = path.join(__dirname, '../frontend/downloads');

// Garante que a pasta de downloads exista no servidor
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Middleware
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rota personalizada de Download para arquivos Excel
app.get('/downloads/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(DOWNLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Arquivo Não Encontrado</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: #1e293b; border: 1px solid #334155; padding: 2.5rem; border-radius: 12px; max-width: 480px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                    h2 { color: #f59e0b; margin-top: 0; font-size: 1.5rem; }
                    p { color: #94a3b8; line-height: 1.6; font-size: 0.95rem; }
                    .btn { display: inline-block; margin-top: 1.5rem; background: #3b82f6; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; }
                    .btn:hover { background: #2563eb; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>⚠️ Arquivo Não Encontrado</h2>
                    <p>O arquivo de exportação solicitado não foi encontrado no servidor. Isso ocorre quando o arquivo atinge a validade (30 dias) ou se o container foi reiniciado.</p>
                    <p>Por favor, solicite uma nova exportação na tela de Locais.</p>
                    <a href="/" class="btn">← Voltar ao Gerenciador de Places</a>
                </div>
            </body>
            </html>
        `);
    }

    res.download(filePath, filename, (err) => {
        if (err && !res.headersSent) {
            console.error('Erro no download do arquivo:', err);
            res.status(500).send('Erro interno ao baixar o arquivo.');
        }
    });
});

// Disponibilizar io no app para poder usar em rotas
app.set('io', io);

// API Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const companiesRoutes = require('./routes/companies');
const tagsRoutes = require('./routes/tags');
const apiRoutes = require('./routes/api');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api', apiRoutes);

// Socket.io eventos
io.on('connection', (socket) => {
    console.log('Um cliente conectou ao WebSocket:', socket.id);

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

server.listen(PORT, async () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    
    // Inicializa multi-tenant e superusuário ao ligar o servidor
    await initMultiTenantAndSuperUser();

    // Executa limpeza inicial e agenda rotina diária para apagar arquivos com +30 dias
    cleanOldExportFiles();
    setInterval(cleanOldExportFiles, 24 * 60 * 60 * 1000);
});
