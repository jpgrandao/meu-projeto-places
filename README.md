# 📍 SEO Places - Windows Desktop App

Este é um sistema nativo para Windows desenvolvido para visualização e filtragem de dados de geolocalização (Google Maps) armazenados em uma base de dados MongoDB. O projeto utiliza **Electron** para a interface nativa e o driver oficial do **MongoDB** para Node.js.

## 🛠️ Tecnologias e Versões

Este projeto foi configurado para o ambiente **Antigravity**:
- **Antigravity Version:** 1.16.5
- **Electron:** 39.2.3
- **Node.js:** 22.21.1
- **Base de Dados:** MongoDB (Remote/Local)
- **SO:** Windows 10/11 x64

## 📂 Estrutura do Projeto

```text
meu-projeto-places/
├── src/
│   ├── main.js          # Processo principal do Electron (Backend)
│   ├── preload.js       # Ponte de segurança (IPC)
│   ├── renderer.js      # Lógica da interface (Frontend)
│   ├── index.html       # Estrutura da interface
│   └── styles.css       # Estilização da aplicação
├── database/
│   └── mongodb.js       # Lógica de conexão e queries ao MongoDB
├── .env                 # Variáveis sensíveis (Credenciais)
├── package.json         # Dependências e scripts
└── README.md            # Documentação