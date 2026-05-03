# 🔐 CofRe — Gerenciador de Senhas Zero-Knowledge

> Cofre digital seguro com criptografia AES-256-GCM no cliente. O servidor nunca tem acesso às suas senhas.

**[☁️ Acesse em produção](https://cofre-five.vercel.app)**

---

## Sobre o projeto

O CofRe é um gerenciador de senhas web com arquitetura **Zero-Knowledge**: toda a criptografia acontece no navegador do usuário antes de qualquer dado ser enviado ao servidor. Nem o backend nem o banco de dados conseguem ler as credenciais armazenadas — apenas o usuário com sua senha mestra tem acesso.

O projeto foi desenvolvido como produto SaaS com monetização via Pix (pagamento por acesso, plano mensal e anual), integrando a API EFÍ Pay para geração e confirmação de cobranças em tempo real.

---

## Stack

### Frontend
| Tecnologia | Uso |
|---|---|
| React 18 + Vite | Interface e build |
| TailwindCSS | Estilização com 4 temas |
| Web Crypto API | Criptografia AES-256-GCM no cliente |
| PBKDF2 | Derivação de chave a partir da senha mestra |
| PWA (vite-plugin-pwa) | Instalável em Android, iOS e Desktop |
| Vercel | Deploy e CDN |

### Backend
| Tecnologia | Uso |
|---|---|
| Node.js + Express 4 | API REST |
| PostgreSQL (Supabase) | Banco de dados |
| bcrypt | Hash da senha de autenticação |
| jsonwebtoken | Sessões stateless |
| helmet + express-rate-limit | Segurança e proteção contra brute-force |
| OTPAuth (TOTP) | Autenticação de dois fatores no painel admin |
| axios + EFÍ Pay API | Integração Pix para cobranças |
| Render | Deploy do backend |

---

## Arquitetura Zero-Knowledge

```
Usuário digita senha mestra
        │
        ▼
  PBKDF2 (600k iterações, SHA-256)
        │
        ▼
  Chave AES-256-GCM derivada  ←── nunca sai do navegador
        │
        ├── Criptografa credenciais antes de salvar
        └── Descriptografa credenciais ao carregar

Servidor recebe apenas:
  - email_hash (SHA-256 do e-mail)
  - dados cifrados (ilegíveis sem a chave)
  - hash da senha de autenticação (bcrypt)
```

A senha mestra **nunca é enviada ao servidor**. Um verifier criptográfico é usado para validar o login sem expor a chave de derivação.

---

## Funcionalidades

- **Cofre de credenciais** — armazena logins, senhas, cartões, dispositivos e notas com categorias personalizadas
- **Criptografia no cliente** — AES-256-GCM com IV único por registro
- **Pagamento Pix** — integração com API EFÍ Pay, QR Code dinâmico, webhook de confirmação
- **Planos de acesso** — por sessão (R$ 2), mensal (R$ 34,90) ou anual (R$ 299)
- **Primeiro acesso gratuito** — onboarding sem fricção
- **PWA** — instalável como app nativo em qualquer dispositivo
- **4 temas visuais** — Escuro Premium, Claro Profissional, Midnight Blue, Warm Professional
- **Painel admin** — gestão de usuários, assinaturas, histórico de sessões e receita, protegido por senha + TOTP
- **Alerta de vencimento** — notificação quando a assinatura está próxima do fim
- **Auditoria de acessos** — log de IPs, user-agents e tentativas de login

---

## Segurança

- Senhas hasheadas com **bcrypt** (custo 12)
- Tokens JWT com expiração de 8h
- Rate limiting em todas as rotas sensíveis (auth, Pix, admin)
- CSP, HSTS, X-Content-Type-Options via **helmet**
- Admin protegido por senha + **TOTP (RFC 6238)**
- E-mails armazenados apenas como hash SHA-256 (nunca em texto puro)
- Soft delete de credenciais (campo `excluido_em`)

---

## Estrutura do repositório

```
cofre/
├── backend/
│   ├── server.js          # API Express completa (~730 linhas)
│   ├── package.json
│   └── .env.example       # Variáveis necessárias documentadas
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # SPA completa com todos os componentes
│   │   ├── main.jsx
│   │   └── services/
│   │       └── crypto.js  # Toda a criptografia Zero-Knowledge
│   ├── public/            # Ícones PWA
│   ├── index.html
│   ├── vite.config.js
│   └── vercel.json
├── schema.sql             # Schema PostgreSQL completo e idempotente
├── render.yaml            # Configuração de deploy no Render
└── .env.example
```

---

## Como rodar localmente

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+ (ou conta no Supabase)

### Backend

```bash
cd backend
cp .env.example .env
# Preencha as variáveis no .env
npm install
node server.js
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
# VITE_API_URL=http://localhost:3001/api
npm install
npm run dev
```

### Banco de dados

Execute o `schema.sql` no seu PostgreSQL ou no SQL Editor do Supabase. O schema é idempotente (`IF NOT EXISTS`) — pode ser executado múltiplas vezes sem erro.

---

## Variáveis de ambiente

### Backend (`.env`)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL |
| `JWT_SECRET` | Segredo para assinar tokens JWT |
| `ADMIN_SENHA` | Senha do painel administrativo |
| `ADMIN_TOTP_SECRET` | Secret TOTP em base32 (gerado em `/api/admin/totp-setup`) |
| `EFI_CLIENT_ID` | Client ID da API EFÍ Pay |
| `EFI_CLIENT_SECRET` | Client Secret da API EFÍ Pay |
| `EFI_CERT_B64_1` | Certificado .p12 em base64 (parte 1) |
| `EFI_CERT_B64_2` | Certificado .p12 em base64 (parte 2) |
| `EFI_PIX_KEY` | Chave Pix para recebimento |
| `FRONTEND_URL` | URL do frontend (CORS) |

### Frontend (`.env.local`)

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL base da API (`https://seu-backend.onrender.com/api`) |

---

## Deploy

O projeto está configurado para deploy automático:

- **Frontend** → Vercel (conectado ao repositório, deploy automático no push)
- **Backend** → Render (configurado via `render.yaml`, deploy automático no push)
- **Banco** → Supabase (PostgreSQL gerenciado)

---

## Licença

Projeto proprietário. Todos os direitos reservados.