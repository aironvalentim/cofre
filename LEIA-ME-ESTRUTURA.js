// ============================================================
// ESTRUTURA DE PASTAS DO PROJETO
// ============================================================
//
// cofre-senhas/
// ├── backend/
// │   ├── server.js          ← código do Express
// │   ├── package.json       ← dependências backend
// │   └── .env               ← variáveis de ambiente (não commitar!)
// └── frontend/
//     ├── src/
//     │   ├── App.jsx        ← componente principal
//     │   ├── main.jsx       ← entry point React
//     │   └── services/
//     │       └── crypto.js  ← toda a criptografia Zero-Knowledge
//     ├── package.json
//     ├── index.html
//     ├── vite.config.js
//     └── tailwind.config.js
//
// ============================================================

// ── backend/package.json ─────────────────────────────────────
/*
{
  "name": "cofre-senhas-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.3.1",
    "express-validator": "^7.1.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "mysql2": "^3.9.7"
  }
}
*/

// ── backend/.env (NUNCA commitar este arquivo) ───────────────
/*
PORT=3001
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_USER=root
DB_PASS=suasenhamysql
DB_NAME=cofre_senhas

JWT_SECRET=gere-uma-string-aleatoria-de-64-chars-aqui
*/

// ── frontend/package.json ────────────────────────────────────
/*
{
  "name": "cofre-senhas-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "vite": "^5.2.11"
  }
}
*/

// ── frontend/src/main.jsx ────────────────────────────────────
/*
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
*/

// ── frontend/src/index.css ───────────────────────────────────
/*
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Garante fonte mínima de 18px em todo o app para acessibilidade */
html {
  font-size: 18px;
}

/* Melhora legibilidade em telas pequenas */
body {
  -webkit-font-smoothing: antialiased;
}
*/

// ── frontend/tailwind.config.js ──────────────────────────────
/*
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
*/

// ── frontend/vite.config.js ──────────────────────────────────
/*
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
*/

// ============================================================
// COMANDOS PARA INICIAR O PROJETO
// ============================================================
//
// 1. Criar o banco de dados:
//    Abra o MySQL Workbench e execute o arquivo schema.sql
//
// 2. Backend:
//    cd backend
//    npm install
//    cp .env.example .env   (edite com suas credenciais)
//    npm run dev
//
// 3. Frontend:
//    cd frontend
//    npm install
//    npm run dev
//
// Acesse: http://localhost:5173
// ============================================================
