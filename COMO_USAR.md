# 📖 Como Usar o CofRe

## Desenvolvimento local

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+ (ou conta no Supabase)
- Git

### 1. Clone e configure

```bash
git clone https://github.com/aironvalentim/cofre.git
cd cofre
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edite o .env com suas variáveis
npm install
node server.js
```

Deve aparecer:
```
✅ Banco PostgreSQL conectado!
🔒 CofRe rodando em http://localhost:3001
```

### 3. Banco de dados

Execute o `schema.sql` no seu PostgreSQL ou no SQL Editor do Supabase:

```bash
psql -U postgres -f schema.sql
```

O schema é idempotente — pode ser executado múltiplas vezes sem erro.

### 4. Frontend

```bash
cd frontend
cp .env.example .env.local
# Configure: VITE_API_URL=http://localhost:3001/api
npm install
npm run dev
```

Acesse: [http://localhost:5173](http://localhost:5173)

---

## Como funciona a segurança

O CofRe usa arquitetura **Zero-Knowledge**: toda a criptografia acontece no seu navegador.

```
Sua senha mestra
      │
      ▼
PBKDF2 (600.000 iterações)
      │
      ▼
Chave AES-256-GCM  ←── nunca sai do navegador
      │
      ├── Criptografa antes de salvar
      └── Descriptografa ao carregar
```

O servidor recebe apenas dados cifrados — **sem a sua chave, são inúteis**.

> ⚠️ **Importante:** Se você esquecer sua senha mestra, não há recuperação. Os dados são irrecuperáveis sem ela. Esse é o trade-off da segurança Zero-Knowledge.

---

## Painel administrativo

Acesse em: `/#admin` (ou clique 5 vezes no logo 🔐)

- Requer senha admin + código TOTP (Google Authenticator)
- Permite visualizar usuários, assinaturas, receita e histórico de sessões
- Permite conceder ou revogar acessos

---

## Instalar como aplicativo (PWA)

O CofRe pode ser instalado como app nativo no seu dispositivo.
Acesse seu **Perfil** após o login e siga as instruções na seção **"Instalar como Aplicativo"**.

- **Android**: botão de instalação automático (Chrome)
- **iOS**: Compartilhar → Adicionar à Tela de Início (Safari)
- **Desktop**: ícone ⊕ na barra de endereço (Chrome/Edge)

---

## Planos de acesso

| Plano | Valor | Validade |
|---|---|---|
| Por acesso | R$ 2,00 | 1 sessão |
| Mensal | R$ 34,90 | 30 dias |
| Anual | R$ 299,00 | 366 dias |

O primeiro acesso após o cadastro é **gratuito**.

---

## Temas disponíveis

- 🌙 **Escuro Premium** — fundo escuro com dourado
- ☀️ **Claro Profissional** — tons claros e limpos
- 🌊 **Midnight Blue** — azul profundo
- 🤎 **Warm Professional** — tons quentes

Altere o tema em **Perfil → Aparência**.