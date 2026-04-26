// ============================================================
// backend/server.js — CofRe v6.1
// Planos + TOTP Admin + Zero-Knowledge + Auditoria completa
// FIX: Certificado EFÍ via EFI_CERT_B64 ou EFI_CERT_B64_1+_2
// ============================================================
import express    from 'express';
import cors       from 'cors';
import helmet     from 'helmet';
import rateLimit  from 'express-rate-limit';
import bcrypt     from 'bcrypt';
import jwt        from 'jsonwebtoken';
import pkg        from 'pg'; const { Pool } = pkg;
import crypto     from 'crypto';
import https      from 'https';
import fs         from 'fs';
import path       from 'path';
import { fileURLToPath } from 'url';
import axios      from 'axios';
import * as OTPAuth from 'otpauth';
import QRCode     from 'qrcode';
import { body, validationResult } from 'express-validator';
import dotenv     from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Segurança ───────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:   ["'self'"],
      scriptSrc:    ["'self'"],
      styleSrc:     ["'self'","'unsafe-inline'"],
      imgSrc:       ["'self'","data:","https://logo.clearbit.com"],
      connectSrc:   ["'self'", 'https://cofre-five.vercel.app', 'https://cofre-backend.onrender.com'],
      fontSrc:      ["'self'","https://fonts.gstatic.com"],
      objectSrc:    ["'none'"],
      frameAncestors:["'none'"],
    },
  },
  hsts:{maxAge:31536000,includeSubDomains:true},
  noSniff:true, referrerPolicy:{policy:'strict-origin-when-cross-origin'},
}));
const allowedOrigins = [
  'http://localhost:5173',
  'https://cofre-five.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    console.log('🌐 CORS origin recebida:', JSON.stringify(origin));
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origem não permitida'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.set('trust proxy', 1); // Necessário para Render, Railway, Heroku
app.use(express.json({limit:'128kb'}));
app.use(rateLimit({windowMs:15*60*1000,max:200}));

const authLimiter  = rateLimit({windowMs:15*60*1000,max:20, message:{erro:'Muitas tentativas. Aguarde 15 min.'}});
const pixLimiter   = rateLimit({windowMs:60*1000,max:30,    message:{erro:'Muitas consultas Pix.'}});
const adminLimiter = rateLimit({windowMs:15*60*1000,max:10, message:{erro:'Acesso admin bloqueado temporariamente.'}});

// ── Banco ───────────────────────────────────────────────────
const db = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host:     process.env.DB_HOST || 'localhost',
        user:     process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS,
        database: process.env.DB_NAME || 'cofre_senhas',
        port:     parseInt(process.env.DB_PORT || '5432'),
        ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
);

async function query(sql, params = []) {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `${ ++i }`);
  const result = await db.query(pgSql, params);
  return [result.rows, result.fields];
}

try {
  await query('SELECT 1 AS ok');
  console.log('✅ Banco PostgreSQL conectado!');
} catch(e) { console.error('❌ Banco:', e.message); }

// ── Config ──────────────────────────────────────────────────
const JWT_SECRET   = process.env.JWT_SECRET||'cofre-secret';
const ADMIN_SENHA  = process.env.ADMIN_SENHA||'12345678';
const PRECO_ACESSO = parseFloat(process.env.PRECO_ACESSO||'2.00');
const PRECO_MENSAL = parseFloat(process.env.PRECO_MENSAL||'34.90');
const PRECO_ANUAL  = parseFloat(process.env.PRECO_ANUAL||'299.00');
const EFI_BASE     = process.env.EFI_SANDBOX==='true'
  ? 'https://pix-h.api.efipay.com.br' : 'https://pix.api.efipay.com.br';
const EFI_PIX_KEY  = process.env.EFI_PIX_KEY;

// ── Certificado EFÍ ─────────────────────────────────────────
// Suporta 3 formas:
//   1. EFI_CERT_B64        — string base64 inteira (recomendado)
//   2. EFI_CERT_B64_1 + EFI_CERT_B64_2 — dividida em 2 partes (Render limita tamanho de env)
//   3. Arquivo local via EFI_CERT_PATH  — desenvolvimento local
let efiAgent;
try {
  let certBuffer;
  const b64_full  = process.env.EFI_CERT_B64;
  const b64_part1 = process.env.EFI_CERT_B64_1;
  const b64_part2 = process.env.EFI_CERT_B64_2;

  if (b64_full) {
    // Forma 1: variável única
    certBuffer = Buffer.from(b64_full.replace(/\s+/g, ''), 'base64');
    console.log('✅ Certificado EFÍ carregado via EFI_CERT_B64');
  } else if (b64_part1) {
    // Forma 2: partes concatenadas (EFI_CERT_B64_1 + EFI_CERT_B64_2 + ...)
    const parts = [b64_part1, b64_part2].filter(Boolean);
    const b64concat = parts.map(p => p.replace(/\s+/g, '')).join('');
    certBuffer = Buffer.from(b64concat, 'base64');
    console.log(`✅ Certificado EFÍ carregado via EFI_CERT_B64_1+_2 (${b64concat.length} chars base64 → ${certBuffer.length} bytes)`);
  } else {
    // Forma 3: arquivo local
    const certPath = path.resolve(__dirname, process.env.EFI_CERT_PATH || './certificado.p12');
    certBuffer = fs.readFileSync(certPath);
    console.log('✅ Certificado EFÍ carregado via arquivo local:', certPath);
  }
  efiAgent = new https.Agent({pfx:certBuffer,passphrase:'',rejectUnauthorized:false});
} catch(e) { console.error('❌ Certificado EFÍ:',e.message); }

let efiTokenCache = {token:null,expiresAt:0};
async function getEfiToken() {
  if(efiTokenCache.token && Date.now()<efiTokenCache.expiresAt-60000) return efiTokenCache.token;
  const creds = Buffer.from(`${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`).toString('base64');
  const r = await axios.post(`${EFI_BASE}/oauth/token`,{grant_type:'client_credentials'},{
    headers:{Authorization:`Basic ${creds}`,'Content-Type':'application/json'},httpsAgent:efiAgent,
  });
  efiTokenCache={token:r.data.access_token,expiresAt:Date.now()+r.data.expires_in*1000};
  return efiTokenCache.token;
}

// ── Helpers ─────────────────────────────────────────────────
const hashEmail = e => crypto.createHash('sha256').update(e.toLowerCase().trim()).digest('hex');
const gerarJWT  = id => jwt.sign({sub:id},JWT_SECRET,{expiresIn:'8h'});
const gerarJWTAdmin = () => jwt.sign({admin:true},JWT_SECRET,{expiresIn:'4h'});

function autenticar(req,res,next) {
  const t=(req.headers.authorization||'').replace('Bearer ','');
  if(!t) return res.status(401).json({erro:'Token obrigatório.'});
  try{req.user=jwt.verify(t,JWT_SECRET);next();}
  catch{res.status(401).json({erro:'Token inválido ou expirado.'});}
}
function autenticarAdmin(req,res,next) {
  const t=(req.headers.authorization||'').replace('Bearer ','');
  if(!t) return res.status(401).json({erro:'Acesso negado.'});
  try{const p=jwt.verify(t,JWT_SECRET);if(!p.admin)return res.status(403).json({erro:'Não autorizado.'});next();}
  catch{res.status(401).json({erro:'Token admin inválido.'});}
}
function validar(req,res,next) {
  const e=validationResult(req);
  if(!e.isEmpty()) return res.status(422).json({erros:e.array()});
  next();
}

async function verificarAssinatura(emailHash) {
  const [r]=await query(
    `SELECT a.id,a.expira_em,p.slug,p.nome,p.duracao_dias
     FROM assinaturas a JOIN planos p ON p.id=a.plano_id
     WHERE a.email_hash=? AND a.status='ATIVA' AND a.expira_em>NOW()
     ORDER BY a.expira_em DESC LIMIT 1`,[emailHash]);
  return r.length?r[0]:null;
}

async function criarCobrancaEfi(plano) {
  if (!efiAgent) throw new Error('Certificado EFÍ não carregado. Verifique EFI_CERT_B64_1 e EFI_CERT_B64_2 no Render.');
  const token   = await getEfiToken();
  const txid    = `cofre${Date.now()}${crypto.randomBytes(5).toString('hex')}`.slice(0,35);
  const precos  = {por_acesso:PRECO_ACESSO,mensal:PRECO_MENSAL,anual:PRECO_ANUAL};
  const nomes   = {por_acesso:'Acesso CofRe',mensal:'Plano Mensal CofRe',anual:'Plano Anual CofRe'};
  const preco   = precos[plano]||PRECO_ACESSO;
  const exp     = 600;

  const cob = await axios.put(`${EFI_BASE}/v2/cob/${txid}`,{
    calendario:{expiracao:exp},
    valor:{original:preco.toFixed(2)},
    chave:EFI_PIX_KEY,
    infoAdicionais:[
      {nome:'Serviço',valor:'CofRe — Gerenciador de Senhas'},
      {nome:'Plano',  valor:nomes[plano]||'CofRe'},
    ],
    solicitacaoPagador:`CofRe — ${nomes[plano]||'Acesso'}`,
  },{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},httpsAgent:efiAgent});

  const qr = await axios.get(`${EFI_BASE}/v2/loc/${cob.data.loc.id}/qrcode`,
    {headers:{Authorization:`Bearer ${token}`},httpsAgent:efiAgent});

  return {txid,qrcodeImg:qr.data.imagemQrcode,copiaCola:qr.data.qrcode,
          expiraEm:new Date(Date.now()+exp*1000),valor:preco,plano};
}

// ══════════════════════════════════════════════════════════
// ADMIN — TOTP
// ══════════════════════════════════════════════════════════
app.get('/api/admin/totp-setup', adminLimiter, async (req,res) => {
  if(process.env.ADMIN_TOTP_SECRET)
    return res.json({mensagem:'TOTP já configurado. Remova esta rota em produção.'});
  const secret = new OTPAuth.Secret({size:20});
  const totp   = new OTPAuth.TOTP({issuer:'CofRe',label:'CofRe Admin',algorithm:'SHA1',digits:6,period:30,secret});
  const qr     = await QRCode.toDataURL(totp.toString());
  res.json({instrucao:'Escaneie o QR Code no Google Authenticator e salve o secret no .env',
            secret:secret.base32,qrcode:qr});
});

app.post('/api/admin/login', adminLimiter, [body('senha').notEmpty(),body('totp').isLength({min:6,max:6})], validar, async (req,res) => {
  const {senha,totp} = req.body;
  if(senha!==ADMIN_SENHA) {
    await new Promise(r=>setTimeout(r,1000));
    return res.status(401).json({erro:'Credenciais inválidas.'});
  }
  const secret = process.env.ADMIN_TOTP_SECRET;
  if(!secret) return res.status(503).json({erro:'TOTP não configurado. Acesse /api/admin/totp-setup'});
  const totpI = new OTPAuth.TOTP({issuer:'CofRe',label:'CofRe Admin',algorithm:'SHA1',digits:6,period:30,
    secret:OTPAuth.Secret.fromBase32(secret)});
  if(totpI.validate({token:totp,window:1})===null)
    return res.status(401).json({erro:'Código TOTP inválido.'});
  const tok = gerarJWTAdmin();
  const th  = crypto.createHash('sha256').update(tok).digest('hex');
  await query('INSERT INTO admin_sessoes (token_hash,ip_origem,expira_em) VALUES (?,?,?) ON CONFLICT (token_hash) DO NOTHING',
    [th,req.ip,new Date(Date.now()+4*3600*1000)]);
  res.json({token:tok});
});

app.get('/api/admin/dashboard', autenticarAdmin, async (req,res) => {
  const [[receita]]  = await query("SELECT COALESCE(SUM(valor),0) AS total FROM cobrancas_pix WHERE status='CONCLUIDA'");
  const [[usuarios]] = await query('SELECT COUNT(*) AS total FROM usuarios WHERE ativo=true');
  const [[assinAtiv]]= await query("SELECT COUNT(*) AS total FROM assinaturas WHERE status='ATIVA' AND expira_em>NOW()");
  const [porPlano]   = await query(`SELECT p.nome,p.slug,COUNT(a.id) AS total,SUM(cp.valor) AS receita
    FROM planos p LEFT JOIN assinaturas a ON a.plano_id=p.id AND a.status='ATIVA'
    LEFT JOIN cobrancas_pix cp ON cp.txid=a.txid_origem AND cp.status='CONCLUIDA'
    GROUP BY p.id ORDER BY p.preco ASC`);
  const [recentes]   = await query(`SELECT cp.txid,cp.valor,cp.pago_em,p.nome AS plano
    FROM cobrancas_pix cp LEFT JOIN assinaturas a ON a.txid_origem=cp.txid
    LEFT JOIN planos p ON p.id=a.plano_id WHERE cp.status='CONCLUIDA'
    ORDER BY cp.pago_em DESC LIMIT 30`);
  const [histSessoes]= await query(`SELECT
    (h.iniciou_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS iniciou_em,
    (h.encerrou_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS encerrou_em,
    h.plano_ativo,h.ip_origem,h.user_agent,u.nome,u.sobrenome,
    (u.criado_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS conta_criada_em
    FROM historico_sessoes h JOIN usuarios u ON u.id=h.usuario_id
    ORDER BY h.iniciou_em DESC LIMIT 100`);
  res.json({receita_total:parseFloat(receita?.total || 0),usuarios_ativos:usuarios.total,
    assinaturas_ativas:assinAtiv.total,por_plano:porPlano,
    pagamentos_recentes:recentes,historico_sessoes:histSessoes});
});

app.get('/api/admin/historico-acessos', autenticarAdmin, async (req,res) => {
  const {email_hash,limite=100} = req.query;
  let q = `SELECT
    (h.iniciou_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS iniciou_em,
    (h.encerrou_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS encerrou_em,
    h.plano_ativo,h.email_hash,h.ip_origem,h.user_agent,h.motivo_saida,h.usuario_id,
    u.nome,u.sobrenome,
    (u.criado_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS conta_criada_em
    FROM historico_sessoes h JOIN usuarios u ON u.id=h.usuario_id`;
  const p = [];
  if(email_hash){q+=' WHERE h.email_hash=?';p.push(email_hash);}
  q+=` ORDER BY h.iniciou_em DESC LIMIT ?`;p.push(parseInt(limite));
  const [r]=await query(q,p);res.json(r);
});

app.patch('/api/admin/planos/:slug', autenticarAdmin, [body('preco').isFloat({min:0.01})], validar, async (req,res) => {
  await query('UPDATE planos SET preco=? WHERE slug=?',[req.body.preco,req.params.slug]);
  res.json({mensagem:`Preço do plano '${req.params.slug}' atualizado.`});
});

// ══════════════════════════════════════════════════════════
// AUTH USUÁRIO
// ══════════════════════════════════════════════════════════
app.post('/api/auth/cadastro', authLimiter, [
  body('email').isEmail(),body('emailEnc').notEmpty(),
  body('nome').trim().notEmpty(),body('sobrenome').trim().notEmpty(),
  body('senhaMestra').isLength({min:8}),body('kdfSalt').isLength({min:64,max:64}),
  body('verifierIv').notEmpty(),body('verifierCt').notEmpty(),
], validar, async (req,res) => {
  try {
    const {email,emailEnc,nome,sobrenome,senhaMestra,kdfSalt,verifierIv,verifierCt} = req.body;
    const eh = hashEmail(email);
    const [ex] = await query('SELECT id FROM usuarios WHERE email_hash=? LIMIT 1',[eh]);
    if(ex.length) return res.status(409).json({erro:'E-mail já cadastrado.'});
    const sh = await bcrypt.hash(senhaMestra,12);
    await query(
      `INSERT INTO usuarios (email_hash,email_enc,nome,sobrenome,senha_hash,kdf_salt,verifier_iv,verifier_ct)
       VALUES (?,?,?,?,?,?,?,?)`,[eh,emailEnc,nome,sobrenome,sh,kdfSalt,verifierIv,verifierCt]);
    await query('INSERT INTO acessos_gratuitos (email_hash,primeiro_login_feito) VALUES (?,false) ON CONFLICT (email_hash) DO NOTHING',[eh]);
    res.status(201).json({mensagem:'Conta criada! Primeiro acesso é gratuito.'});
  } catch(e) {
    if(e.message.includes('ER_NO_SUCH_TABLE'))
      return res.status(500).json({erro:'Banco não inicializado. Execute schema.sql.'});
    res.status(500).json({erro:'Erro interno: '+e.message});
  }
});

app.get('/api/planos', async (req,res) => {
  const [r]=await query('SELECT * FROM planos WHERE ativo=true ORDER BY preco ASC');
  res.json(r);
});

app.post('/api/auth/verificar-acesso', authLimiter, [body('email').isEmail()], validar, async (req,res) => {
  try {
    const eh = hashEmail(req.body.email);
    const [user]=await query('SELECT id FROM usuarios WHERE email_hash=? AND ativo=true LIMIT 1',[eh]);
    if(!user.length) return res.json({precisaPagar:false,planoAtivo:null});
    const assin = await verificarAssinatura(eh);
    if(assin) return res.json({precisaPagar:false,planoAtivo:assin});
    const [gr]=await query('SELECT primeiro_login_feito FROM acessos_gratuitos WHERE email_hash=? LIMIT 1',[eh]);
    const primeiroUsado = gr.length && gr[0].primeiro_login_feito===true;
    res.json({precisaPagar:!!primeiroUsado,planoAtivo:null});
  } catch(e){res.json({precisaPagar:false,planoAtivo:null});}
});

app.post('/api/pix/criar-cobranca', authLimiter, [
  body('email').isEmail(),
  body('plano').isIn(['por_acesso','mensal','anual']),
], validar, async (req,res) => {
  try {
    const eh    = hashEmail(req.body.email);
    const plano = req.body.plano;
    await query("UPDATE cobrancas_pix SET status='EXPIRADA' WHERE email_hash=? AND status='ATIVA' AND expira_em<NOW()",[eh]);
    const [ativa]=await query(
      `SELECT txid,qrcode_img,copia_cola,expira_em,valor FROM cobrancas_pix
       WHERE email_hash=? AND plano=? AND status='ATIVA' AND expira_em>NOW()
       ORDER BY criado_em DESC LIMIT 1`,[eh,plano]);
    if(ativa.length) return res.json({txid:ativa[0].txid,qrcodeImg:ativa[0].qrcode_img,
      copiaCola:ativa[0].copia_cola,expiraEm:ativa[0].expira_em,valor:parseFloat(ativa[0].valor),plano});
    const {txid,qrcodeImg,copiaCola,expiraEm,valor} = await criarCobrancaEfi(plano);
    await query(`INSERT INTO cobrancas_pix (txid,email_hash,valor,plano,qrcode_img,copia_cola,expira_em) VALUES (?,?,?,?,?,?,?)`,[txid,eh,valor,plano,qrcodeImg,copiaCola,expiraEm]);
    res.json({txid,qrcodeImg,copiaCola,expiraEm,valor,plano});
  } catch(e) {
    const st=e.response?.status;const ed=e.response?.data;
    console.error(`❌ Pix [${st}]:`,JSON.stringify(ed||e.message));
    let msg='Erro ao criar cobrança Pix. Tente novamente.';
    if(st===403) msg='API EFÍ: verifique escopos da aplicação (403).';
    if(st===401) msg='API EFÍ: credenciais inválidas (401).';
    if(st===400) msg=`API EFÍ: ${ed?.mensagem||'dados inválidos.'}`;
    if(!efiAgent) msg='Certificado EFÍ não configurado no servidor. Verifique as variáveis EFI_CERT_B64_1/EFI_CERT_B64_2.';
    res.status(500).json({erro:msg});
  }
});

app.get('/api/pix/status/:txid', pixLimiter, async (req,res) => {
  try {
    const {txid}=req.params;
    if(!/^[a-zA-Z0-9]{26,35}$/.test(txid)) return res.status(400).json({erro:'txid inválido.'});
    const [r]=await query('SELECT status,token_acesso,plano FROM cobrancas_pix WHERE txid=? LIMIT 1',[txid]);
    if(!r.length) return res.status(404).json({erro:'Cobrança não encontrada.'});
    if(r[0].status==='CONCLUIDA') return res.json({pago:true,tokenPix:r[0].token_acesso});
    if(!efiAgent) return res.json({pago:false,erro:'Certificado não carregado.'});
    const token = await getEfiToken();
    const st = await axios.get(`${EFI_BASE}/v2/cob/${txid}`,{headers:{Authorization:`Bearer ${token}`},httpsAgent:efiAgent});
    const efiStatus = st.data.status;
    if(efiStatus==='CONCLUIDA') {
      const tp=crypto.randomBytes(32).toString('hex');
      await query("UPDATE cobrancas_pix SET status='CONCLUIDA',pago_em=NOW(),token_acesso=? WHERE txid=?",[tp,txid]);
      return res.json({pago:true,tokenPix:tp});
    }
    if(efiStatus?.includes('REMOVIDA')||efiStatus==='EXPIRADA') {
      await query("UPDATE cobrancas_pix SET status='EXPIRADA' WHERE txid=?",[txid]);
      return res.json({pago:false,expirou:true});
    }
    res.json({pago:false});
  } catch(e){res.json({pago:false});}
});

app.post('/api/pix/webhook', express.json(), async (req,res) => {
  try {
    res.status(200).send('OK');
    if(!req.body||typeof req.body!=='object') return;
    const pixes=Array.isArray(req.body?.pix)?req.body.pix:[];
    for(const p of pixes) {
      const {txid}=p;
      if(!txid||!/^[a-zA-Z0-9]{26,35}$/.test(txid)) continue;
      const [r]=await query('SELECT id,email_hash,status,plano FROM cobrancas_pix WHERE txid=? LIMIT 1',[txid]);
      if(!r.length||r[0].status==='CONCLUIDA') continue;
      const tp=crypto.randomBytes(32).toString('hex');
      await query("UPDATE cobrancas_pix SET status='CONCLUIDA',pago_em=NOW(),token_acesso=? WHERE txid=?",[tp,txid]);
      console.log(`✅ Webhook Pix: ${txid} plano=${r[0].plano}`);
    }
  } catch(e){console.error('Webhook:',e.message);}
});

app.post('/api/auth/login', authLimiter, [
  body('email').isEmail(),body('senhaMestra').notEmpty(),
  body('tokenPix').optional().isString(),
  body('plano').optional().isIn(['por_acesso','mensal','anual']),
], validar, async (req,res) => {
  try {
    const {email,senhaMestra,tokenPix,plano} = req.body;
    const eh = hashEmail(email);
    const ip = req.ip;
    const ua = req.headers['user-agent']||null;

    const [rows]=await query(
      'SELECT id,senha_hash,kdf_salt,verifier_iv,verifier_ct,nome FROM usuarios WHERE email_hash=? AND ativo=true LIMIT 1',[eh]);
    const hash   = rows.length?rows[0].senha_hash:'$2b$12$invalido.hash.para.timing';
    const senhaOk = await bcrypt.compare(senhaMestra,hash);
    query('INSERT INTO log_acessos (email_hash,ip_origem,user_agent,sucesso) VALUES (?,?,?,?)',
      [eh,ip,ua,!!(rows.length&&senhaOk)]).catch(()=>{});
    if(!rows.length||!senhaOk) return res.status(401).json({erro:'E-mail ou senha incorretos.'});
    const u=rows[0];

    const assin = await verificarAssinatura(eh);
    if(assin) {
      const tok=gerarJWT(u.id);
      const th=crypto.createHash('sha256').update(tok).digest('hex');
      await query('INSERT INTO sessoes (usuario_id,token_hash,ip_origem,expira_em) VALUES (?,?,?,?)',
        [u.id,th,ip,new Date(Date.now()+8*3600*1000)]);
      query('INSERT INTO historico_sessoes (usuario_id,email_hash,ip_origem,user_agent,plano_ativo) VALUES (?,?,?,?,?)',
        [u.id,eh,ip,ua,assin.slug]).catch(()=>{});
      return res.json({token:tok,nome:u.nome,kdfSalt:u.kdf_salt,
        verifierIv:u.verifier_iv,verifierCt:u.verifier_ct,
        planoAtivo:{nome:assin.nome,expiraEm:assin.expira_em}});
    }

    const [gr]=await query('SELECT primeiro_login_feito FROM acessos_gratuitos WHERE email_hash=? LIMIT 1',[eh]);
    const primeiroUsado = gr.length ? gr[0].primeiro_login_feito===true : false;

    if(!primeiroUsado) {
      if(gr.length) {
        await query("UPDATE acessos_gratuitos SET primeiro_login_feito=true WHERE email_hash=?",[eh]);
      } else {
        await query('INSERT INTO acessos_gratuitos (email_hash,primeiro_login_feito) VALUES (?,true) ON CONFLICT (email_hash) DO NOTHING',[eh]);
      }
    } else {
      if(!tokenPix) return res.status(402).json({erro:'pagamento_necessario',mensagem:'Escolha um plano para continuar.'});
      const [cob]=await query(
        `SELECT id,plano,valor FROM cobrancas_pix
         WHERE token_acesso=? AND email_hash=? AND status='CONCLUIDA'
         AND pago_em > NOW() - INTERVAL '15 minutes' LIMIT 1`,[tokenPix,eh]);
      if(!cob.length) return res.status(402).json({erro:'pagamento_invalido',mensagem:'Pagamento não confirmado ou expirado.'});
      await query("UPDATE cobrancas_pix SET token_acesso=NULL WHERE token_acesso=?",[tokenPix]);
      const cobPlano=cob[0].plano;
      if(cobPlano==='mensal'||cobPlano==='anual') {
        const [pi]=await query('SELECT id,duracao_dias FROM planos WHERE slug=? LIMIT 1',[cobPlano]);
        if(pi.length) {
          const exp=new Date(Date.now()+pi[0].duracao_dias*86400*1000);
          await query('INSERT INTO assinaturas (email_hash,plano_id,expira_em,txid_origem) VALUES (?,?,?,?)',
            [eh,pi[0].id,exp,cob[0].txid||null]);
        }
      }
    }

    const planoNome = primeiroUsado?(plano||'por_acesso'):'gratuito';
    const tok=gerarJWT(u.id);
    const th=crypto.createHash('sha256').update(tok).digest('hex');
    await query('INSERT INTO sessoes (usuario_id,token_hash,ip_origem,expira_em) VALUES (?,?,?,?)',
      [u.id,th,ip,new Date(Date.now()+8*3600*1000)]);
    query('INSERT INTO historico_sessoes (usuario_id,email_hash,ip_origem,user_agent,plano_ativo) VALUES (?,?,?,?,?)',
      [u.id,eh,ip,ua,planoNome]).catch(()=>{});
    res.json({token:tok,nome:u.nome,kdfSalt:u.kdf_salt,verifierIv:u.verifier_iv,verifierCt:u.verifier_ct});
  } catch(e) {
    if(e.message.includes('ER_NO_SUCH_TABLE')) return res.status(500).json({erro:'Banco não inicializado.'});
    res.status(500).json({erro:'Erro interno: '+e.message});
  }
});


// ══════════════════════════════════════════════════════════
// ADMIN — SUPORTE A USUÁRIOS
// ══════════════════════════════════════════════════════════

app.post('/api/admin/buscar-usuario', autenticarAdmin, [
  body('email').isEmail(),
], validar, async (req, res) => {
  try {
    const eh = hashEmail(req.body.email);
    const [u] = await query(
      `SELECT u.id, u.nome, u.sobrenome, u.criado_em, u.ativo,
              ag.primeiro_login_feito,
              a.status AS assin_status, p.nome AS plano_nome,
              a.inicio_em AS assin_inicio, a.expira_em AS assin_expira
       FROM usuarios u
       LEFT JOIN acessos_gratuitos ag ON ag.email_hash = u.email_hash
       LEFT JOIN assinaturas a ON a.email_hash = u.email_hash AND a.status = 'ATIVA' AND a.expira_em > NOW()
       LEFT JOIN planos p ON p.id = a.plano_id
       WHERE u.email_hash = ? LIMIT 1`, [eh]
    );
    if (!u.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const [logs] = await query(
      `SELECT (criado_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS criado_em,
       ip_origem, user_agent, sucesso, plano_na_epoca
       FROM log_acessos WHERE email_hash = ?
       ORDER BY criado_em DESC LIMIT 20`, [eh]
    );
    const [hist] = await query(
      `SELECT (iniciou_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS iniciou_em,
       (encerrou_em AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS encerrou_em,
       plano_ativo, ip_origem, motivo_saida
       FROM historico_sessoes WHERE email_hash = ?
       ORDER BY iniciou_em DESC LIMIT 10`, [eh]
    );

    res.json({
      usuario: {
        id: u[0].id,
        nome: u[0].nome,
        sobrenome: u[0].sobrenome,
        criado_em: u[0].criado_em,
        ativo: !!u[0].ativo,
        primeiro_acesso_usado: !!u[0].primeiro_login_feito,
        assinatura: u[0].assin_status ? {
          status: u[0].assin_status,
          plano: u[0].plano_nome,
          inicio_em: u[0].assin_inicio,
          expira_em: u[0].assin_expira,
        } : null,
      },
      ultimos_acessos: logs,
      historico_sessoes: hist,
      aviso: '⚠️ Zero-Knowledge: os dados cifrados do usuário são irrecuperáveis sem a senha mestra original.',
    });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

app.post('/api/admin/liberar-acesso', autenticarAdmin, [
  body('email').isEmail(),
  body('motivo').optional().isString(),
], validar, async (req, res) => {
  try {
    const eh = hashEmail(req.body.email);
    const [u] = await query('SELECT id FROM usuarios WHERE email_hash = ? AND ativo = true LIMIT 1', [eh]);
    if (!u.length) return res.status(404).json({ erro: 'Usuário não encontrado ou inativo.' });
    await query(
      'INSERT INTO acessos_gratuitos (email_hash, primeiro_login_feito) VALUES (?, false) ON CONFLICT (email_hash) DO UPDATE SET primeiro_login_feito = false',
      [eh]
    );
    console.log(`🔓 Admin liberou acesso para email_hash=${eh.substring(0,16)}... motivo: ${req.body.motivo||'suporte'}`);
    res.json({
      mensagem: 'Acesso liberado. O próximo login deste usuário será gratuito.',
      instrucao: 'Oriente o usuário a tentar fazer login com sua senha mestra.',
    });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

app.post('/api/admin/desativar-usuario', autenticarAdmin, [
  body('email').isEmail(),
  body('motivo').notEmpty(),
], validar, async (req, res) => {
  try {
    const eh = hashEmail(req.body.email);
    await query('UPDATE usuarios SET ativo = false WHERE email_hash = ?', [eh]);
    await query("UPDATE assinaturas SET status = 'CANCELADA' WHERE email_hash = ?", [eh]);
    console.log(`🚫 Admin desativou email_hash=${eh.substring(0,16)}... motivo: ${req.body.motivo}`);
    res.json({ mensagem: 'Usuário desativado.' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

app.post('/api/admin/reativar-usuario', autenticarAdmin, [
  body('email').isEmail(),
], validar, async (req, res) => {
  try {
    const eh = hashEmail(req.body.email);
    await query('UPDATE usuarios SET ativo = true WHERE email_hash = ?', [eh]);
    res.json({ mensagem: 'Usuário reativado.' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

app.post('/api/admin/conceder-assinatura', autenticarAdmin, [
  body('email').isEmail(),
  body('plano').isIn(['mensal', 'anual']),
  body('motivo').optional().isString(),
], validar, async (req, res) => {
  try {
    const eh = hashEmail(req.body.email);
    const [u] = await query('SELECT id FROM usuarios WHERE email_hash = ? AND ativo = true LIMIT 1', [eh]);
    if (!u.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    const [pi] = await query('SELECT id, duracao_dias FROM planos WHERE slug = ? LIMIT 1', [req.body.plano]);
    if (!pi.length) return res.status(404).json({ erro: 'Plano não encontrado.' });
    const expira = new Date(Date.now() + pi[0].duracao_dias * 86400 * 1000);
    await query("UPDATE assinaturas SET status = 'CANCELADA' WHERE email_hash = ? AND status = 'ATIVA'", [eh]);
    await query(
      "INSERT INTO assinaturas (email_hash, plano_id, expira_em, txid_origem) VALUES (?, ?, ?, 'admin-concedido')",
      [eh, pi[0].id, expira]
    );
    console.log(`🎁 Admin concedeu plano ${req.body.plano} para email_hash=${eh.substring(0,16)}...`);
    res.json({ mensagem: `Assinatura ${req.body.plano} concedida até ${expira.toLocaleDateString('pt-BR')}.` });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

app.get('/api/admin/usuarios', autenticarAdmin, async (req, res) => {
  const [rows] = await query(`
    SELECT u.id, u.nome, u.sobrenome, u.criado_em, u.ativo,
           a.status AS assin_status, p.nome AS plano_nome, a.expira_em
    FROM usuarios u
    LEFT JOIN assinaturas a ON a.email_hash = u.email_hash AND a.status = 'ATIVA' AND a.expira_em > NOW()
    LEFT JOIN planos p ON p.id = a.plano_id
    ORDER BY u.criado_em DESC LIMIT 200`);
  res.json(rows);
});

// ── Perfil e preferências ────────────────────────────────────
app.get('/api/usuario/perfil', autenticar, async (req,res) => {
  const [r]=await query('SELECT email_enc,nome,sobrenome,criado_em FROM usuarios WHERE id=?',[req.user.sub]);
  if(!r.length) return res.status(404).json({erro:'Não encontrado.'});
  res.json(r[0]);
});
app.patch('/api/usuario/perfil', autenticar, [
  body('nome').optional().trim().notEmpty(),body('sobrenome').optional().trim().notEmpty(),
], validar, async (req,res) => {
  await query('UPDATE usuarios SET nome=COALESCE(?,nome),sobrenome=COALESCE(?,sobrenome) WHERE id=?',
    [req.body.nome??null,req.body.sobrenome??null,req.user.sub]);
  res.json({mensagem:'Atualizado.'});
});

app.get('/api/usuario/preferencias', autenticar, async (req,res) => {
  const [u]=await query('SELECT email_hash FROM usuarios WHERE id=? LIMIT 1',[req.user.sub]);
  if(!u.length) return res.json({tema:'escuro'});
  const [r]=await query('SELECT tema FROM preferencias_usuario WHERE email_hash=? LIMIT 1',[u[0].email_hash]);
  res.json({tema:r.length?r[0].tema:'escuro'});
});
app.put('/api/usuario/preferencias', autenticar, [body('tema').isIn(['escuro','claro','profissional','casual'])], validar, async (req,res) => {
  const [u]=await query('SELECT email_hash FROM usuarios WHERE id=? LIMIT 1',[req.user.sub]);
  if(!u.length) return res.status(404).json({erro:'Não encontrado.'});
  await query('INSERT INTO preferencias_usuario (email_hash,tema) VALUES (?,?) ON CONFLICT (email_hash) DO UPDATE SET tema=EXCLUDED.tema',
    [u[0].email_hash,req.body.tema]);
  res.json({mensagem:'Tema atualizado.'});
});

app.get('/api/usuario/status-assinatura', autenticar, async (req,res) => {
  try {
    const [u]=await query('SELECT email_hash FROM usuarios WHERE id=? LIMIT 1',[req.user.sub]);
    if(!u.length) return res.json({assinatura:null});
    const assin=await verificarAssinatura(u[0].email_hash);
    if(!assin) return res.json({assinatura:null});
    const dias=Math.ceil((new Date(assin.expira_em)-new Date())/(1000*60*60*24));
    res.json({assinatura:{plano:assin.nome,slug:assin.slug,expiraEm:assin.expira_em,
      diasRestantes:dias,alertar:dias<=7,urgente:dias<=3}});
  } catch(e){res.json({assinatura:null});}
});

// ── Categorias ───────────────────────────────────────────────
app.get('/api/categorias', autenticar, async (req,res) => {
  const [r]=await query(
    'SELECT id,nome_enc,icone,eh_sistema,usuario_id FROM categorias_credenciais WHERE eh_sistema=true OR usuario_id=? ORDER BY eh_sistema DESC,criado_em ASC',[req.user.sub]);
  res.json(r);
});
app.post('/api/categorias', autenticar, [body('nomeEnc').notEmpty(),body('icone').notEmpty()], validar, async (req,res) => {
  const [r]=await query('INSERT INTO categorias_credenciais (usuario_id,nome_enc,icone,eh_sistema) VALUES (?,?,?,false) RETURNING id',
    [req.user.sub,req.body.nomeEnc,req.body.icone]);
  res.status(201).json({id:r[0]?.id});
});
app.delete('/api/categorias/:id', autenticar, async (req,res) => {
  const [c]=await query('SELECT id FROM categorias_credenciais WHERE id=? AND usuario_id=? AND eh_sistema=false',
    [req.params.id,req.user.sub]);
  if(!c.length) return res.status(404).json({erro:'Não encontrada.'});
  await query('DELETE FROM categorias_credenciais WHERE id=?',[req.params.id]);
  res.json({mensagem:'Categoria removida.'});
});

// ── Cofre ────────────────────────────────────────────────────
app.get('/api/cofre', autenticar, async (req,res) => {
  const [r]=await query(
    `SELECT c.id,c.categoria_id,cc.nome_enc AS categoria_nome_enc,cc.icone,cc.eh_sistema,
            c.titulo_enc,c.login_enc,c.senha_enc,c.url_ou_banco_enc,c.senha_4dig_enc,
            c.senha_6dig_enc,c.numero_cartao_enc,c.pin_dispositivo_enc,c.conta_vinculada_enc,
            c.notas_enc,c.campos_extras_enc,c.favorito,c.criado_em
     FROM credenciais c JOIN categorias_credenciais cc ON cc.id=c.categoria_id
     WHERE c.usuario_id=? AND c.excluido_em IS NULL ORDER BY c.favorito DESC,c.criado_em DESC`,[req.user.sub]);
  res.json(r);
});
app.post('/api/cofre', autenticar, [body('categoriaId').isInt({min:1}),body('tituloEnc').notEmpty(),body('senhaEnc').notEmpty()], validar, async (req,res) => {
  const {categoriaId,tituloEnc,loginEnc,senhaEnc,urlOuBancoEnc,senha4digEnc,senha6digEnc,
         numeroCartaoEnc,pinDispositivoEnc,contaVinculadaEnc,notasEnc,camposExtrasEnc,favorito}=req.body;
  const [r]=await query(
    `INSERT INTO credenciais (usuario_id,categoria_id,titulo_enc,login_enc,senha_enc,url_ou_banco_enc,
      senha_4dig_enc,senha_6dig_enc,numero_cartao_enc,pin_dispositivo_enc,conta_vinculada_enc,notas_enc,campos_extras_enc,favorito)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
    [req.user.sub,categoriaId,tituloEnc,loginEnc??null,senhaEnc,urlOuBancoEnc??null,
     senha4digEnc??null,senha6digEnc??null,numeroCartaoEnc??null,pinDispositivoEnc??null,
     contaVinculadaEnc??null,notasEnc??null,camposExtrasEnc??null,!!favorito]);
  res.status(201).json({id:r[0].id});
});
app.put('/api/cofre/:id', autenticar, async (req,res) => {
  const [c]=await query('SELECT id FROM credenciais WHERE id=? AND usuario_id=? AND excluido_em IS NULL',[req.params.id,req.user.sub]);
  if(!c.length) return res.status(404).json({erro:'Não encontrada.'});
  const {tituloEnc,loginEnc,senhaEnc,urlOuBancoEnc,senha4digEnc,senha6digEnc,
         numeroCartaoEnc,pinDispositivoEnc,contaVinculadaEnc,notasEnc,camposExtrasEnc,categoriaId,favorito}=req.body;
  await query(
    `UPDATE credenciais SET titulo_enc=?,login_enc=?,senha_enc=?,url_ou_banco_enc=?,senha_4dig_enc=?,
      senha_6dig_enc=?,numero_cartao_enc=?,pin_dispositivo_enc=?,conta_vinculada_enc=?,notas_enc=?,
      campos_extras_enc=?,categoria_id=?,favorito=? WHERE id=?`,
    [tituloEnc,loginEnc??null,senhaEnc,urlOuBancoEnc??null,senha4digEnc??null,senha6digEnc??null,
     numeroCartaoEnc??null,pinDispositivoEnc??null,contaVinculadaEnc??null,notasEnc??null,
     camposExtrasEnc??null,categoriaId,!!favorito,req.params.id]);
  res.json({mensagem:'Atualizado.'});
});
app.delete('/api/cofre/:id', autenticar, async (req,res) => {
  const [c]=await query('SELECT id FROM credenciais WHERE id=? AND usuario_id=?',[req.params.id,req.user.sub]);
  if(!c.length) return res.status(404).json({erro:'Não encontrada.'});
  await query('UPDATE credenciais SET excluido_em=NOW() WHERE id=?',[req.params.id]);
  res.json({mensagem:'Removida.'});
});

app.listen(PORT,()=>{
  console.log(`🔒 CofRe rodando em http://localhost:${PORT}`);
  console.log(`💰 Acesso: R$${PRECO_ACESSO} | Mensal: R$${PRECO_MENSAL} | Anual: R$${PRECO_ANUAL}`);
  console.log(`🏦 EFÍ: ${process.env.EFI_SANDBOX==='true'?'SANDBOX':'PRODUÇÃO'} | Chave: ${EFI_PIX_KEY}`);
  if(!efiAgent) console.log('⚠️  Certificado EFÍ NÃO carregado! Verifique EFI_CERT_B64_1 e EFI_CERT_B64_2 no Render.');
  if(!process.env.ADMIN_TOTP_SECRET) console.log('⚠️  TOTP não configurado — acesse /api/admin/totp-setup');
});
