# 🚀 Guia de Deploy — CofRe em Produção

## Arquitetura

```
Usuário
  └── cofre-five.vercel.app     (Vercel — Frontend React + PWA)
        └── cofre-backend.onrender.com  (Render — Backend Node.js)
              └── Supabase             (PostgreSQL gerenciado)
```

---

## Pré-requisitos

- Conta no [GitHub](https://github.com)
- Conta no [Supabase](https://supabase.com) (banco de dados)
- Conta no [Render](https://render.com) (backend)
- Conta na [Vercel](https://vercel.com) (frontend)
- Conta na [EFÍ Pay](https://sejaefi.com.br) (pagamentos Pix)

---

## Etapa 1 — Banco de dados (Supabase)

1. Crie um novo projeto no Supabase
2. Vá em **SQL Editor** → cole o conteúdo de `schema.sql` → execute
3. Em **Project Settings → Database**, copie a **Connection String** (modo `Transaction`)
4. Guarde: `postgresql://postgres:[SENHA]@[HOST]:5432/postgres`

> O schema é idempotente — pode ser executado mais de uma vez sem erro.

---

## Etapa 2 — Backend (Render)

1. Acesse [render.com](https://render.com) → **New → Web Service**
2. Conecte o repositório GitHub `cofre`
3. Configure:

| Campo | Valor |
|---|---|
| Name | `cofre-backend` |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance | Free |

4. Em **Environment Variables**, adicione:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string do Supabase |
| `JWT_SECRET` | String aleatória longa (veja como gerar abaixo) |
| `ADMIN_SENHA` | Senha do painel admin (mínimo 16 caracteres) |
| `ADMIN_TOTP_SECRET` | Gerado em `/api/admin/totp-setup` após o primeiro deploy |
| `EFI_CLIENT_ID` | Client ID da sua aplicação EFÍ Pay |
| `EFI_CLIENT_SECRET` | Client Secret da sua aplicação EFÍ Pay |
| `EFI_CERT_B64_1` | Primeira metade do certificado .p12 em base64 |
| `EFI_CERT_B64_2` | Segunda metade do certificado .p12 em base64 |
| `EFI_PIX_KEY` | Sua chave Pix registrada na EFÍ |
| `EFI_SANDBOX` | `false` em produção, `true` para testes |
| `PRECO_ACESSO` | `2.00` |
| `PRECO_MENSAL` | `34.90` |
| `PRECO_ANUAL` | `299.00` |
| `FRONTEND_URL` | URL do seu projeto na Vercel |

5. Clique **Create Web Service** e aguarde o deploy
6. Anote a URL gerada: `https://cofre-backend.onrender.com`

### Configurar TOTP do admin (primeiro deploy)

Após o backend estar no ar, acesse:
```
https://cofre-backend.onrender.com/api/admin/totp-setup
```
Escaneie o QR Code no Google Authenticator e salve o `secret` retornado como `ADMIN_TOTP_SECRET` no Render. **Remova esta rota em produção** após configurar.

---

## Etapa 3 — Frontend (Vercel)

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório `cofre`
3. Configure:

| Campo | Valor |
|---|---|
| Framework | Vite |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

4. Em **Environment Variables**, adicione:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | `https://cofre-backend.onrender.com/api` |

5. Clique **Deploy**

---

## Etapa 4 — Webhook EFÍ Pay

No painel da EFÍ Pay, configure o webhook para confirmação automática de Pix:

```
https://cofre-backend.onrender.com/api/pix/webhook
```

---

## Etapa 5 — Domínio personalizado (opcional)

### Vercel
1. **Settings → Domains** → adicione seu domínio
2. Configure os registros DNS indicados pelo Vercel

### Registro.br (domínio .com.br)
```
CNAME  www  →  cname.vercel-dns.com
A      @    →  76.76.21.21
```

---

## Gerar JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Converter certificado .p12 para base64 (PowerShell)

```powershell
$cert = [Convert]::ToBase64String([IO.File]::ReadAllBytes("caminho\para\certificado.p12"))
$b64_1 = $cert.Substring(0, 3000)
$b64_2 = $cert.Substring(3000)
Write-Host "EFI_CERT_B64_1:" $b64_1
Write-Host "EFI_CERT_B64_2:" $b64_2
```

---

## Acessar o painel admin

```
https://seu-frontend.vercel.app/#admin
```

Ou clique 5 vezes no logo 🔐 da tela inicial.

- **Senha**: valor de `ADMIN_SENHA`
- **TOTP**: código do Google Authenticator

---

## Custos estimados

| Serviço | Plano gratuito | Limitação |
|---|---|---|
| Vercel | ✅ Gratuito | Sem limitação prática |
| Render | ✅ 750h/mês | Dorme após 15min sem uso |
| Supabase | ✅ 500MB | Projeto pausado após 1 semana inativo |
| EFÍ Pay | ✅ Sem mensalidade | Taxa por transação |
| Domínio .com.br | ❌ ~R$40/ano | Registro.br |

> **Dica:** Para evitar o "sleep" do Render, use [UptimeRobot](https://uptimerobot.com) (gratuito) para fazer ping a cada 5 minutos.

---

## Ordem de execução

1. ✅ Crie e configure o banco no Supabase
2. ✅ Deploy do backend no Render com todas as variáveis
3. ✅ Configure o TOTP do admin
4. ✅ Deploy do frontend na Vercel
5. ✅ Atualize `FRONTEND_URL` no Render com a URL da Vercel
6. ✅ Configure o webhook na EFÍ Pay
7. ✅ Teste o login e o painel admin
8. ✅ Configure domínio personalizado (opcional)