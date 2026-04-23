# 🔒 Segurança — Leia antes de publicar no GitHub

## O que NUNCA deve ir ao GitHub

| Arquivo | Por quê |
|---------|---------|
| `.env` | Contém senhas do banco, JWT secret e credenciais EFÍ |
| `backend/certificado.p12` | Certificado mTLS da EFÍ Bank — quem tiver isso pode gerar cobranças na sua conta |
| `node_modules/` | Dependências — instalar com `npm install` |

## Como usar com segurança

1. **Nunca commite o `.env`** — ele está no `.gitignore`
2. **Nunca commite o `certificado.p12`** — está no `.gitignore`
3. Se quiser compartilhar o código, use o `.env.example` como referência
4. Gere um `JWT_SECRET` forte: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

## O que é seguro publicar

- Todo o código-fonte (`.jsx`, `.js`)
- `schema.sql`
- `.env.example` (sem valores reais)
- `package.json`

## As credenciais EFÍ ficam APENAS no servidor

O frontend (React) nunca vê as credenciais EFÍ.
Todas as chamadas à API EFÍ passam pelo backend (Node.js).
O usuário que inspecionar o navegador verá apenas chamadas para `localhost:3001`.
