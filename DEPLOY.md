# 🚀 GUIA DE DEPLOY — CofRe em Produção

## Arquitetura final
```
Usuário → cofre.com.br (Vercel — Frontend React)
                      → cofre-api.onrender.com (Render — Backend Node.js)
                      → Railway.app (MySQL na nuvem)
```

---

## ETAPA 1 — GitHub (repositório)

### O que subir no GitHub:
✅ Pode subir: todo o código-fonte (.jsx, .js, .sql, .json)
✅ Pode subir: .env.example, .gitignore, render.yaml, vercel.json
❌ NUNCA suba: .env, backend/.env, *.p12, certificado_base64.txt

### Passos:
1. Crie conta em github.com
2. Crie repositório PRIVADO chamado "cofre"
3. No terminal, na pasta do projeto:
   ```
   git init
   git add .
   git commit -m "CofRe v1.0"
   git remote add origin https://github.com/SEU_USUARIO/cofre.git
   git push -u origin main
   ```

---

## ETAPA 2 — Banco de dados (Railway.app)

1. Acesse railway.app → faça login com GitHub
2. Clique "New Project" → "Deploy MySQL"
3. Aguarde criar. Clique no serviço MySQL → aba "Connect"
4. Anote as credenciais (host, user, password, database, port)
5. Clique em "Query" → cole o conteúdo do schema.sql → Execute
6. Verifique: deve aparecer "Banco CofRe v6 criado com sucesso!"

---

## ETAPA 3 — Backend (Render.com)

1. Acesse render.com → login com GitHub
2. "New" → "Web Service" → conecte o repositório "cofre"
3. Configure:
   - Name: cofre-backend
   - Root Directory: backend
   - Runtime: Node
   - Build Command: npm install
   - Start Command: node server.js
   - Instance: Free

4. Em "Environment Variables", adicione TODAS estas variáveis:

   | Variável           | Valor                                    |
   |--------------------|------------------------------------------|
   | NODE_ENV           | production                               |
   | DB_HOST            | [host do Railway]                        |
   | DB_USER            | [user do Railway]                        |
   | DB_PASS            | [password do Railway]                    |
   | DB_NAME            | [database do Railway]                    |
   | DB_PORT            | [port do Railway — geralmente 3306]      |
   | JWT_SECRET         | [gere uma string aleatória longa]        |
   | EFI_CLIENT_ID      | Client_Id_de15c0ea77101fc89ab81dbc90b17840178a21ee |
   | EFI_CLIENT_SECRET  | Client_Secret_9115ca04f2e109ef5b79a014f25dd09d3affac03 |
   | EFI_CERT_B64       | [conteúdo do certificado_base64.txt]     |
   | EFI_PIX_KEY        | 1d92e787-84df-442c-8ff5-d198fba7bb54    |
   | EFI_SANDBOX        | false                                    |
   | PRECO_ACESSO       | 2.00                                     |
   | PRECO_MENSAL       | 34.90                                    |
   | PRECO_ANUAL        | 299.00                                   |
   | INATIVIDADE_MINUTOS| 5                                        |
   | ADMIN_SENHA        | [senha forte — mínimo 16 caracteres]     |
   | ADMIN_TOTP_SECRET  | VASENZ5HN33PQLLBQPSHFWCXX4EJBIQF       |
   | FRONTEND_URL       | https://SEU-PROJETO.vercel.app           |

5. Clique "Create Web Service"
6. Anote a URL: https://cofre-backend.onrender.com

---

## ETAPA 4 — Frontend (Vercel.com)

1. Acesse vercel.com → login com GitHub
2. "Add New Project" → importe o repositório "cofre"
3. Configure:
   - Framework: Vite
   - Root Directory: frontend
   - Build Command: npm run build
   - Output Directory: dist

4. Em "Environment Variables", adicione:
   | Variável       | Valor                                     |
   |----------------|-------------------------------------------|
   | VITE_API_URL   | https://cofre-backend.onrender.com/api    |

5. Clique "Deploy"
6. Anote a URL: https://cofre.vercel.app

---

## ETAPA 5 — Domínio personalizado

### Opção A: Registro.br (domínio .com.br)
- cofre.com.br custa ~R$40/ano
- meucofre.com.br custa ~R$40/ano
- Acesse registro.br → pesquise disponibilidade → registre

### Opção B: Domínio gratuito
- Crie conta em Freenom.com → domínios .tk .ml .ga .cf grátis
- Ou use o subdomínio gratuito do Vercel: cofre.vercel.app

### Configurar domínio no Vercel:
1. Vercel → seu projeto → "Settings" → "Domains"
2. Adicione seu domínio
3. No Registro.br, adicione os registros DNS que o Vercel indicar:
   - Tipo CNAME: www → cname.vercel-dns.com
   - Tipo A: @ → 76.76.21.21

---

## ETAPA 6 — Atualizar o App.jsx para produção

Após ter a URL do backend do Render, atualize a linha do App.jsx:

```javascript
// Linha atual (desenvolvimento):
const API = 'http://localhost:3001/api';

// Altere para (produção):
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
```

---

## ETAPA 7 — Webhook EFÍ Bank (para confirmação automática de Pix)

No painel EFÍ Bank:
1. app.sejaefi.com.br → API → Aplicações → Cofre → Configurações
2. Em "Webhook", adicione:
   https://cofre-backend.onrender.com/api/pix/webhook

---

## COMO ACESSAR O PAINEL ADMIN EM PRODUÇÃO

URL: https://cofre.vercel.app/#admin
- Senha: a que você definiu em ADMIN_SENHA
- TOTP: código do Google Authenticator (configurado com VASENZ5HN33PQLLBQPSHFWCXX4EJBIQF)
- Ou: 5 cliques no logo 🔐

ATENÇÃO: Em produção, use uma senha admin FORTE (ex: Cof@Re2026!Admin#) 
e nunca compartilhe. Mude no painel do Render em "Environment Variables".

---

## ARQUIVOS QUE NUNCA DEVEM IR PARA O GITHUB

- backend/.env
- .env
- backend/certificado.p12
- certificado_base64.txt (gerado neste guia)
- qualquer *.p12, *.pfx, *.pem

O .gitignore do projeto já bloqueia todos eles automaticamente.

---

## GERAR JWT_SECRET FORTE

Execute no terminal:
```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Cole o resultado como JWT_SECRET no Render.

---

## CUSTOS ESTIMADOS

| Serviço         | Plano Gratuito             | Limitação              |
|-----------------|----------------------------|------------------------|
| Render.com      | ✅ Free (750h/mês)          | Dorme após 15min idle  |
| Vercel.com      | ✅ Free (ilimitado)         | Sem limitação prática  |
| Railway.app     | ✅ $5 crédito/mês           | ~500MB RAM, 1GB disco  |
| Domínio .com.br | ❌ R$40/ano                 | Registro.br            |
| Domínio .vercel | ✅ Gratuito (subdomínio)    | cofre.vercel.app       |

DICA: Para evitar o "sleep" do Render gratuito (que faz o backend demorar
~30s na primeira requisição após idle), use uptimerobot.com para fazer
ping a cada 5 minutos — serviço gratuito.

---

## ORDEM DE EXECUÇÃO DO DEPLOY

1. ✅ Crie conta GitHub → suba o código (sem .env e .p12)
2. ✅ Crie banco no Railway → execute schema.sql
3. ✅ Deploy backend no Render → configure variáveis de ambiente
4. ✅ Atualize FRONTEND_URL no Render com a URL da Vercel
5. ✅ Deploy frontend na Vercel → configure VITE_API_URL
6. ✅ Configure domínio (opcional)
7. ✅ Configure webhook EFÍ
8. ✅ Teste o painel admin em produção
