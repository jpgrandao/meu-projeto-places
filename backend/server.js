const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const { initSuperUser } = require('./database/mongodb');

// Load env vars
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Disponibilizar io no app para poder usar em rotas
app.set('io', io);

// API Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const apiRoutes = require('./routes/api');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api', apiRoutes);

// Socket.io eventos (se necessário algo além do motor de busca)
io.on('connection', (socket) => {
    console.log('Um cliente conectou ao WebSocket:', socket.id);

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

server.listen(PORT, async () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
    
    // Inicializa o superusuário ao ligar o servidor
    await initSuperUser();
});
