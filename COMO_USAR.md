# CofRe — Gerenciador de Senhas

## 1. Banco de Dados
Abra o MySQL Workbench e execute o arquivo `schema.sql`.
Isso cria o banco do zero (apaga e recria se já existir).

## 2. Backend
```
cd backend
npm install
npm run dev
```
Deve aparecer: `🔒 CofRe rodando em http://localhost:3001`

## 3. Frontend
```
cd frontend
npm install
npm run dev
```
Abra: http://localhost:5173

## Observações
- Crie uma nova conta após executar o schema.sql
- A senha do cofre é usada para cifrar seus dados (diferente da senha do banco MySQL)
- O servidor NUNCA vê suas senhas — tudo é cifrado no navegador
