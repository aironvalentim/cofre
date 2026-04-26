// ============================================================
// frontend/src/App.jsx — CofRe v6
// 4 temas | Planos | Alerta vencimento | Zero-Knowledge
// ============================================================
import React, { useState, useRef, useContext, createContext, useEffect, useCallback } from 'react';
import {
  derivarChave, gerarSalt, gerarVerifier, validarVerifier,
  criptografar, descriptografar,
  criptografarCredencial, descriptografarCredencial,
} from './services/crypto';

const API = import.meta.env.VITE_API_URL || 'https://cofre-backend.onrender.com/api';

// ══════════════════════════════════════════════════════════
// TEMAS — 4 perfis validados pelo mercado (GitHub, Linear, Notion)
// ══════════════════════════════════════════════════════════
const TEMAS = {
  escuro: {
    nome:'Escuro Premium', emoji:'🌙',
    desc:'Fundo escuro dourado. Reduz fadiga ocular.',
    perfil:'Gestores e uso prolongado',
    bg0:'#0a0c10',bg1:'#0f1117',bg2:'#151821',bg3:'#1c2030',bg4:'#242838',
    bord:'rgba(255,255,255,0.08)',bordH:'rgba(255,255,255,0.16)',
    accent:'#c9a84c',accentL:'#e8c97a',accentD:'rgba(201,168,76,0.15)',accentG:'rgba(201,168,76,0.35)',
    t0:'#f0f0f0',t1:'#b0b4bf',t2:'#6b7280',t3:'#4b5563',
    teal:'#2dd4bf',red:'#f87171',green:'#4ade80',purple:'#a78bfa',
    cardShadow:'0 20px 50px rgba(0,0,0,.6)',bodyBg:'#0a0c10',
  },
  profissional: {
    nome:'Profissional', emoji:'💼',
    desc:'Índigo escuro. Alto contraste para foco total.',
    perfil:'CEOs e uso corporativo intenso',
    bg0:'#060810',bg1:'#0c0e18',bg2:'#111420',bg3:'#181c2a',bg4:'#1f2335',
    bord:'rgba(99,102,241,0.15)',bordH:'rgba(99,102,241,0.35)',
    accent:'#818cf8',accentL:'#a5b4fc',accentD:'rgba(99,102,241,0.15)',accentG:'rgba(99,102,241,0.4)',
    t0:'#e2e8f0',t1:'#94a3b8',t2:'#64748b',t3:'#475569',
    teal:'#34d399',red:'#f87171',green:'#34d399',purple:'#c084fc',
    cardShadow:'0 20px 50px rgba(0,0,0,.7)',bodyBg:'#060810',
  },
  claro: {
    nome:'Claro', emoji:'☀️',
    desc:'Interface clara e acolhedora. Consultas rápidas.',
    perfil:'Uso eventual e usuários rotativos',
    bg0:'#f8fafc',bg1:'#ffffff',bg2:'#ffffff',bg3:'#f1f5f9',bg4:'#e2e8f0',
    bord:'rgba(0,0,0,0.08)',bordH:'rgba(0,0,0,0.18)',
    accent:'#d97706',accentL:'#f59e0b',accentD:'rgba(217,119,6,0.1)',accentG:'rgba(217,119,6,0.3)',
    t0:'#0f172a',t1:'#334155',t2:'#64748b',t3:'#94a3b8',
    teal:'#0d9488',red:'#dc2626',green:'#16a34a',purple:'#7c3aed',
    cardShadow:'0 4px 24px rgba(0,0,0,.1)',bodyBg:'#f8fafc',
  },
  casual: {
    nome:'Casual', emoji:'🎨',
    desc:'Roxo moderno. Para uso pessoal descontraído.',
    perfil:'Uso pessoal e cotidiano',
    bg0:'#fafafa',bg1:'#ffffff',bg2:'#f9f9fb',bg3:'#f0effe',bg4:'#e8e6fd',
    bord:'rgba(139,92,246,0.12)',bordH:'rgba(139,92,246,0.28)',
    accent:'#8b5cf6',accentL:'#a78bfa',accentD:'rgba(139,92,246,0.1)',accentG:'rgba(139,92,246,0.3)',
    t0:'#111827',t1:'#374151',t2:'#6b7280',t3:'#9ca3af',
    teal:'#06b6d4',red:'#ef4444',green:'#22c55e',purple:'#8b5cf6',
    cardShadow:'0 4px 20px rgba(139,92,246,.12)',bodyBg:'#fafafa',
  },
};

const TemaCtx = createContext(null);
function TemaProvider({children}) {
  const [temaKey,setTemaKey] = useState(()=>localStorage.getItem('cofre_tema')||'escuro');
  const tema = TEMAS[temaKey]||TEMAS.escuro;
  function aplicarTema(k) {
    const t=TEMAS[k]||TEMAS.escuro;
    document.body.style.background=t.bodyBg;
    document.body.style.color=t.t0;
    localStorage.setItem('cofre_tema',k);
    setTemaKey(k);
  }
  useEffect(()=>{aplicarTema(temaKey);},[]);
  return <TemaCtx.Provider value={{tema,temaKey,aplicarTema}}>{children}</TemaCtx.Provider>;
}
function useT(){return useContext(TemaCtx);}

// ══════════════════════════════════════════════════════════
// AUTH CONTEXT
// ══════════════════════════════════════════════════════════
const AuthCtx = createContext(null);
function useAuth(){return useContext(AuthCtx);}
function AuthProvider({children}){
  const [st,setSt]=useState({token:null,chaveAES:null,nome:''});
  return <AuthCtx.Provider value={{...st,
    fazerLogin:(t,k,n)=>setSt({token:t,chaveAES:k,nome:n}),
    sair:()=>setSt({token:null,chaveAES:null,nome:''})}}>
    {children}
  </AuthCtx.Provider>;
}

// ══════════════════════════════════════════════════════════
// HOOK — tela pequena
// ══════════════════════════════════════════════════════════
function useIsMobile(){
  const [v,setV]=useState(()=>window.innerWidth<640);
  useEffect(()=>{const fn=()=>setV(window.innerWidth<640);window.addEventListener('resize',fn);return()=>window.removeEventListener('resize',fn);},[]);
  return v;
}

// ══════════════════════════════════════════════════════════
// MAPA DE LOGOS
// ══════════════════════════════════════════════════════════
const SVC={'nubank':'nubank.com.br','bradesco':'bradesco.com.br','itau':'itau.com.br','itaú':'itau.com.br','caixa':'caixa.gov.br','santander':'santander.com.br','banco do brasil':'bb.com.br','bb':'bb.com.br','inter':'bancointer.com.br','c6':'c6bank.com.br','c6bank':'c6bank.com.br','picpay':'picpay.com','instagram':'instagram.com','facebook':'facebook.com','whatsapp':'whatsapp.com','twitter':'twitter.com','x':'x.com','tiktok':'tiktok.com','youtube':'youtube.com','linkedin':'linkedin.com','discord':'discord.com','telegram':'telegram.org','gmail':'gmail.com','outlook':'outlook.com','google':'google.com','microsoft':'microsoft.com','apple':'apple.com','netflix':'netflix.com','spotify':'spotify.com','amazon':'amazon.com','github':'github.com','notion':'notion.so','slack':'slack.com','zoom':'zoom.us','steam':'steampowered.com','iphone':'apple.com','samsung':'samsung.com'};
function getDomain(t){if(!t)return null;const q=t.toLowerCase().trim();for(const[k,v]of Object.entries(SVC))if(q.includes(k)||k.includes(q))return v;return null;}

// ══════════════════════════════════════════════════════════
// COMPONENTES BASE — usam tema dinâmico via useT()
// ══════════════════════════════════════════════════════════
function Spin(){return<span style={{display:'inline-block',width:15,height:15,border:'2px solid rgba(128,128,128,.3)',borderTopColor:'currentColor',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>;}

function Alerta({tipo,msg}){
  const {tema:C}=useT();
  if(!msg)return null;
  const s=tipo==='err'?{bg:`${C.red}18`,c:C.red,br:`${C.red}40`}
         :tipo==='ok'?{bg:`${C.green}18`,c:C.green,br:`${C.green}40`}
         :{bg:`${C.teal}18`,c:C.teal,br:`${C.teal}30`};
  return <div style={{background:s.bg,color:s.c,border:`1px solid ${s.br}`,padding:'.76rem .95rem',borderRadius:10,fontSize:'.86rem',display:'flex',gap:7,marginBottom:'1rem',lineHeight:1.5}}>
    <span>{tipo==='err'?'⚠️':tipo==='ok'?'✅':'ℹ️'}</span><span>{msg}</span>
  </div>;
}

function Campo({label,hint,children}){
  const {tema:C}=useT();
  return <div style={{marginBottom:'.95rem'}}>
    <label style={{display:'block',fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:C.t2,marginBottom:'.38rem'}}>{label}</label>
    {children}
    {hint&&<p style={{fontSize:'.7rem',color:C.t3,marginTop:'.28rem'}}>{hint}</p>}
  </div>;
}

function Txt({value,onChange,placeholder,type='text',icon,autoComplete='',maxLength,style={}}){
  const {tema:C}=useT();
  const inp={width:'100%',background:C.bg3,border:`1.5px solid ${C.bord}`,borderRadius:12,color:C.t0,fontFamily:'inherit',fontSize:'1rem',padding:'.78rem .95rem',outline:'none',transition:'border-color .2s',minHeight:48};
  return <div style={{position:'relative'}}>
    {icon&&<span style={{position:'absolute',left:'.85rem',top:'50%',transform:'translateY(-50%)',color:C.t2,fontSize:'.95rem',pointerEvents:'none'}}>{icon}</span>}
    <input value={value} onChange={onChange} placeholder={placeholder} type={type} autoComplete={autoComplete} maxLength={maxLength}
           style={{...inp,...(icon?{paddingLeft:'2.5rem'}:{}),...style}}
           onFocus={e=>{e.target.style.borderColor=C.accent;e.target.style.boxShadow=`0 0 0 3px ${C.accentD}`;}}
           onBlur={e=>{e.target.style.borderColor=C.bord;e.target.style.boxShadow='none';}}/>
  </div>;
}

function Pw({value,onChange,placeholder,autoComplete=''}){
  const {tema:C}=useT();
  const [show,setShow]=useState(false);
  const inp={width:'100%',background:C.bg3,border:`1.5px solid ${C.bord}`,borderRadius:12,color:C.t0,fontFamily:'inherit',fontSize:'1rem',padding:'.78rem 2.6rem .78rem 2.5rem',outline:'none',transition:'border-color .2s',minHeight:48};
  return <div style={{position:'relative'}}>
    <span style={{position:'absolute',left:'.85rem',top:'50%',transform:'translateY(-50%)',color:C.t2,fontSize:'.95rem',pointerEvents:'none'}}>🔑</span>
    <input value={value} onChange={onChange} placeholder={placeholder} type={show?'text':'password'} autoComplete={autoComplete}
           style={inp}
           onFocus={e=>{e.target.style.borderColor=C.accent;e.target.style.boxShadow=`0 0 0 3px ${C.accentD}`;}}
           onBlur={e=>{e.target.style.borderColor=C.bord;e.target.style.boxShadow='none';}}/>
    <button type="button" onClick={()=>setShow(v=>!v)} style={{position:'absolute',right:'.85rem',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:C.t2,fontSize:'.95rem',lineHeight:1}}>
      {show?'🙈':'👁️'}
    </button>
  </div>;
}

function Forca({v}){
  if(!v)return null;
  let s=0;
  if(v.length>=8)s++;if(v.length>=12)s++;if(/[A-Z]/.test(v))s++;if(/[0-9]/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;
  const lv=[{w:'20%',c:'#f87171',t:'Muito fraca'},{w:'40%',c:'#fb923c',t:'Fraca'},{w:'60%',c:'#fbbf24',t:'Regular'},{w:'80%',c:'#a3e635',t:'Boa'},{w:'100%',c:'#4ade80',t:'Excelente'}][Math.min(s-1,4)]||{w:'20%',c:'#f87171',t:'Muito fraca'};
  return <div style={{marginTop:'.3rem'}}>
    <div style={{height:3,borderRadius:2,background:'rgba(128,128,128,.2)',overflow:'hidden'}}><div style={{height:'100%',width:lv.w,background:lv.c,borderRadius:2,transition:'width .3s'}}/></div>
    <div style={{fontSize:'.7rem',fontWeight:700,color:lv.c,marginTop:'.2rem'}}>{lv.t}</div>
  </div>;
}

function Logo({mb='1.3rem'}){
  const {tema:C}=useT();
  return <div style={{display:'flex',alignItems:'center',gap:8,fontSize:'1.25rem',fontWeight:700,letterSpacing:'-.02em',marginBottom:mb}}>
    <div style={{width:32,height:32,background:`linear-gradient(135deg,${C.accent},${C.accentL})`,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.88rem',boxShadow:`0 3px 12px ${C.accentG}`}}>🔐</div>
    <span style={{color:C.t0}}>Cof<span style={{color:C.accent}}>Re</span></span>
  </div>;
}

function BadgeSeguranca({compact=false}){
  const {tema:C}=useT();
  if(compact) return(
    <div className="hbadge" style={{display:'flex',alignItems:'center',gap:6,background:`${C.teal}12`,border:`1px solid ${C.teal}35`,borderRadius:99,padding:'.22rem .7rem',width:'fit-content'}}>
      <span style={{fontSize:'.7rem'}}>🔒</span>
      <span style={{fontSize:'.7rem',color:C.teal,fontWeight:600}}>E-mail e dados cifrados com AES-256</span>
    </div>
  );
  return(
    <div style={{background:`${C.teal}10`,border:`1px solid ${C.teal}30`,borderRadius:12,padding:'.85rem 1rem',marginBottom:'1.1rem'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        <span style={{fontSize:'1.1rem',flexShrink:0}}>🔒</span>
        <div>
          <div style={{fontSize:'.82rem',fontWeight:700,color:C.teal,marginBottom:'.2rem'}}>Privacidade total — tudo cifrado</div>
          <div style={{fontSize:'.76rem',color:C.t1,lineHeight:1.55}}>
            Seu e-mail, nome e todas as senhas são <strong style={{color:C.t0}}>criptografados no seu dispositivo</strong> antes de chegar ao servidor.
          </div>
        </div>
      </div>
    </div>
  );
}

function SvcLogo({titulo,catIcon,size=38}){
  const {tema:C}=useT();
  const [src,setSrc]=useState(null);
  const d=getDomain(titulo||'');
  useEffect(()=>{if(!d){setSrc(null);return;}const i=new Image();i.onload=()=>setSrc(i.src);i.onerror=()=>setSrc(null);i.src=`https://logo.clearbit.com/${d}`;},[d]);
  return <div style={{width:size,height:size,borderRadius:size*.26,background:C.bg3,border:`1px solid ${C.bord}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
    {src?<img src={src} alt="" style={{width:size*.68,height:size*.68,objectFit:'contain',borderRadius:3}}/>:<span style={{fontSize:size*.44}}>{catIcon||'📁'}</span>}
  </div>;
}

// ══════════════════════════════════════════════════════════
// CSS GLOBAL COM TEMA DINÂMICO
// ══════════════════════════════════════════════════════════
function GlobalStylesComTema(){
  const {tema:C,temaKey}=useT();
  useEffect(()=>{
    const el=document.getElementById('cg');if(el)el.remove();
    const s=document.createElement('style');s.id='cg';
    s.textContent=`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html{font-size:16px;-webkit-text-size-adjust:100%}
      body{font-family:'Sora',sans-serif!important;background:${C.bodyBg}!important;color:${C.t0};-webkit-font-smoothing:antialiased;overscroll-behavior:none}
      ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg1}}::-webkit-scrollbar-thumb{background:${C.bg4};border-radius:3px}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      @keyframes fl{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
      @keyframes sh{0%{background-position:-200% center}100%{background-position:200% center}}
      @keyframes si{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
      @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      .au{animation:up .4s ease both}.au1{animation:up .4s .07s ease both}.au2{animation:up .4s .14s ease both}.au3{animation:up .4s .21s ease both}.asi{animation:si .28s ease both}
      .app-layout{display:flex;max-width:1020px;margin:0 auto;padding:1.5rem 1.3rem;gap:1.4rem;min-height:calc(100vh - 56px)}
      .app-sidebar{width:230px;flex-shrink:0;display:flex;flex-direction:column;gap:1rem}
      .app-main{flex:1;min-width:0}
      .bnav{display:none!important}
      @media(max-width:639px){
        .app-layout{padding:.9rem .9rem 78px;gap:0}.app-sidebar{display:none!important}.bnav{display:flex!important}
        .hide-mobile{display:none!important}.hbadge{display:none!important}
        .modal-sheet-wrap{align-items:flex-end!important;padding:0!important}
        .modal-sheet{border-radius:20px 20px 0 0!important;max-width:100%!important;width:100%!important;max-height:92vh!important;animation:slideUp .28s ease!important}
        .grid2{grid-template-columns:1fr!important}.cards-grid{grid-template-columns:1fr!important}
      }
      @media(min-width:640px) and (max-width:900px){.app-layout{padding:1.2rem 1rem;gap:1rem}.app-sidebar{width:200px}}
      .bp:hover:not(:disabled){transform:translateY(-2px)!important;box-shadow:0 8px 24px ${C.accentG}!important}
      .bp:disabled{opacity:.5;cursor:not-allowed}
      .bg:hover:not(:disabled){border-color:${C.bordH}!important;color:${C.t0}!important;background:${C.bg3}!important}
      .cn:hover{background:${C.bg3}!important;color:${C.t0}!important}
      .cc:hover{border-color:${C.bordH}!important;transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.3)!important}
      .acb:hover{border-color:${C.accent}!important;color:${C.accent}!important;background:${C.accentD}!important}
      .mc:hover{color:${C.red}!important;border-color:${C.red}50!important;background:${C.red}18!important}
      .da:hover{color:${C.accent}!important}.rb:hover{border-color:${C.accent}!important;color:${C.accent}!important}
      .lo:hover{border-color:${C.red}!important;color:${C.red}!important;background:${C.red}18!important}
      .addcat:hover{background:${C.accentD}!important;border-color:${C.accent}60!important;color:${C.accent}!important}
      .bnnav-btn:hover{color:${C.accent}!important}
    `;
    document.head.appendChild(s);
  },[temaKey]);
  return null;
}

// ══════════════════════════════════════════════════════════
// LANDING
// ══════════════════════════════════════════════════════════
function TelaLanding({onLogin,onCadastro}){
  const {tema:C}=useT();
  return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem',background:`radial-gradient(ellipse 80% 50% at 20% -10%,${C.accentD} 0%,transparent 60%),${C.bg0}`}}>
    <div style={{width:'100%',maxWidth:430,textAlign:'center'}}>
      <div className="au" style={{width:76,height:76,margin:'0 auto 1.2rem',background:`linear-gradient(135deg,${C.bg3},${C.bg4})`,border:`1px solid ${C.bordH}`,borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem',boxShadow:`0 0 36px ${C.accentG}`,animation:'fl 4s ease-in-out infinite'}}>🔐</div>
      <h1 className="au1" style={{fontSize:'clamp(1.4rem,5vw,1.9rem)',fontWeight:800,lineHeight:1.15,letterSpacing:'-.03em',marginBottom:'.6rem',color:C.t0}}>
        Seus dados protegidos<br/>com{' '}
        <span style={{background:`linear-gradient(90deg,${C.accent},${C.accentL},${C.accent})`,backgroundSize:'200% auto',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',animation:'sh 4s linear infinite'}}>criptografia real</span>
      </h1>
      <p className="au2" style={{color:C.t1,fontSize:'.93rem',lineHeight:1.6,marginBottom:'1.2rem'}}>AES-256 direto no seu navegador. Nenhuma senha chega ao servidor sem cifrar.</p>
      <div className="au2" style={{background:`${C.teal}10`,border:`1px solid ${C.teal}25`,borderRadius:12,padding:'1rem',marginBottom:'1.4rem',textAlign:'left'}}>
        <div style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:C.teal,marginBottom:'.5rem'}}>🔒 O que ciframos por você</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.3rem'}}>
          {['Seu e-mail','Nome e sobrenome','Todas as senhas','Logins e cartões','PINs','Notas'].map(t=>(
            <div key={t} style={{display:'flex',alignItems:'center',gap:6,fontSize:'.74rem',color:C.t1}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:C.teal,flexShrink:0}}/>{t}
            </div>
          ))}
        </div>
      </div>
      <div className="au3" style={{display:'flex',flexDirection:'column',gap:8}}>
        <button onClick={onLogin} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'100%',padding:'.9rem',background:`linear-gradient(135deg,${C.accent},${C.accentL}80)`,color:C.bg0,fontFamily:'inherit',fontSize:'.97rem',fontWeight:700,border:'none',borderRadius:12,cursor:'pointer',minHeight:50,boxShadow:`0 4px 16px ${C.accentG}`}}>🔓 Entrar no Meu Cofre</button>
        <button onClick={onCadastro} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'100%',padding:'.78rem',background:'transparent',color:C.t1,fontFamily:'inherit',fontSize:'.92rem',fontWeight:600,border:`1.5px solid ${C.bord}`,borderRadius:12,cursor:'pointer',minHeight:46}}>✨ Criar Conta Gratuita</button>
      </div>
      <div style={{marginTop:'1.4rem',padding:'.9rem 1rem',background:`${C.bg3}`,border:`1px solid ${C.bord}`,borderRadius:12,textAlign:'left'}}>
        <p style={{fontSize:'.67rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:C.t3,marginBottom:'.5rem'}}>ℹ️ Política de acesso</p>
        <div style={{display:'flex',flexDirection:'column',gap:'.3rem',marginBottom:'.5rem'}}>
          {[['⚡','Por Acesso','R$ 2,00 por sessão — pague só quando usar'],['🌙','Mensal','R$ 34,90/mês — acesso ilimitado. Vale a partir de 17 acessos/mês'],['🏆','Anual','R$ 299,00/ano — R$ 24,92/mês (29% off vs mensal)']].map(([i,n,d])=>(
            <div key={n} style={{display:'flex',gap:7,fontSize:'.71rem',color:C.t2}}><span>{i}</span><span><strong style={{color:C.t1}}>{n}:</strong> {d}</span></div>
          ))}
        </div>
        <p style={{fontSize:'.68rem',color:C.t3,lineHeight:1.55}}>O <strong style={{color:C.t2}}>primeiro acesso é gratuito</strong>. Sessão encerrada após <strong style={{color:C.t2}}>5 min de inatividade</strong>.</p>
      </div>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
// LOGIN COM FLUXO DE PLANOS E PIX
// ══════════════════════════════════════════════════════════
const PRECO_MENSAL_REF = 34.90;

function TelaLogin({onCadastro,onVoltar}){
  const {fazerLogin}=useAuth();
  const {tema:C}=useT();
  const [email,setEmail]=useState('');
  const [senha,setSenha]=useState('');
  const [erro,setErro]=useState('');
  const [load,setLoad]=useState(false);
  const [tela,setTela]=useState('login'); // login | planos | pix
  const [planos,setPlanos]=useState([]);
  const [planoSel,setPlanoSel]=useState(null);
  const [pixData,setPixData]=useState(null);
  const [pixPago,setPixPago]=useState(false);
  const [tokenPix,setTokenPix]=useState(null);
  const [copiado,setCopiado]=useState(false);
  const [tempoExp,setTempoExp]=useState(600);

  useEffect(()=>{fetch(`${API}/planos`).then(r=>r.json()).then(setPlanos).catch(()=>{});},[]);

  // Contador
  useEffect(()=>{
    if(tela!=='pix'||pixPago||!pixData)return;
    const ms=new Date(pixData.expiraEm).getTime();
    const t=setInterval(()=>{const r=Math.max(0,Math.floor((ms-Date.now())/1000));setTempoExp(r);if(r<=0)clearInterval(t);},1000);
    return()=>clearInterval(t);
  },[tela,pixPago,pixData]);

  // Polling
  useEffect(()=>{
    if(tela!=='pix'||pixPago||!pixData)return;
    const p=setInterval(async()=>{
      try{const r=await fetch(`${API}/api/pix/status/${pixData.txid}`);const d=await r.json();
        if(d.pago){setPixPago(true);setTokenPix(d.tokenPix);clearInterval(p);}
        if(d.expirou)clearInterval(p);}catch{}},3000);
    return()=>clearInterval(p);
  },[tela,pixPago,pixData]);

  async function handleLogin(){
    setErro('');
    if(!email.includes('@')){setErro('E-mail inválido.');return;}
    if(senha.length<8){setErro('Senha deve ter no mínimo 8 caracteres.');return;}
    setLoad(true);
    try{
      const res=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:email.toLowerCase().trim(),senhaMestra:senha})});
      const data=await res.json();
      if(res.status===402&&data.erro==='pagamento_necessario'){setTela('planos');return;}
      if(!res.ok){setErro(data.erro||'Erro ao fazer login.');return;}
      await finalizarLogin(data);
    }catch(e){setErro(e.message.includes('fetch')?'Servidor indisponível.':e.message);}
    finally{setLoad(false);}
  }

  async function handleEscolherPlano(plano){
    setPlanoSel(plano);setLoad(true);setErro('');
    try{
      const res=await fetch(`${API}/api/pix/criar-cobranca`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:email.toLowerCase().trim(),plano})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.erro||'Erro ao gerar Pix');
      setPixData(data);setTempoExp(600);setTela('pix');
    }catch(e){setErro('Erro ao gerar cobrança: '+e.message);}
    finally{setLoad(false);}
  }

  async function handleLoginComPix(){
    setLoad(true);
    try{
      const res=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:email.toLowerCase().trim(),senhaMestra:senha,tokenPix,plano:planoSel})});
      const data=await res.json();
      if(!res.ok){setErro(data.erro||'Erro.');setTela('login');return;}
      await finalizarLogin(data);
    }catch(e){setErro('Erro: '+e.message);}
    finally{setLoad(false);}
  }

  async function finalizarLogin(data){
    const chave=await derivarChave(senha,data.kdfSalt);
    const ok=await validarVerifier(JSON.stringify({iv:data.verifierIv,ct:data.verifierCt}),chave);
    if(!ok){setErro('Senha incorreta.');return;}
    fazerLogin(data.token,chave,data.nome);
  }

  const card={background:C.bg2,border:`1px solid ${C.bord}`,borderRadius:20,padding:'2rem',boxShadow:C.cardShadow};
  const btnP={display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'100%',padding:'.9rem',background:`linear-gradient(135deg,${C.accent},${C.accentL}80)`,color:C.bg0,fontFamily:'inherit',fontSize:'.97rem',fontWeight:700,border:'none',borderRadius:12,cursor:'pointer',minHeight:50};
  const btnG={display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'100%',padding:'.78rem',background:'transparent',color:C.t1,fontFamily:'inherit',fontSize:'.92rem',fontWeight:600,border:`1.5px solid ${C.bord}`,borderRadius:12,cursor:'pointer',minHeight:46};
  const fmtT=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const bg=`radial-gradient(ellipse 80% 50% at 20% -10%,${C.accentD} 0%,transparent 60%),${C.bg0}`;

  // TELA PLANOS
  if(tela==='planos'){
    const icons={por_acesso:'⚡',mensal:'🌙',anual:'🏆'};
    const cores={por_acesso:C.t1,mensal:C.teal,anual:C.accent};
    const badges={anual:{l:'MAIS VANTAJOSO',c:C.accent,b:C.accentD},mensal:{l:'POPULAR',c:C.teal,b:`${C.teal}15`}};
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem',background:bg}}>
      <div style={{width:'100%',maxWidth:560}}>
        <button onClick={()=>setTela('login')} style={{background:'none',border:'none',cursor:'pointer',color:C.t2,fontSize:'.85rem',fontFamily:'inherit',padding:'.4rem 0',marginBottom:'1.2rem',display:'flex',alignItems:'center',gap:5}}>← Voltar</button>
        <div className="au" style={card}>
          <div style={{textAlign:'center',marginBottom:'1.75rem'}}>
            <div style={{fontSize:'2rem',marginBottom:'.5rem'}}>🔐</div>
            <h2 style={{fontSize:'1.4rem',fontWeight:800,color:C.t0,marginBottom:'.3rem'}}>Escolha seu plano</h2>
            <p style={{fontSize:'.87rem',color:C.t2}}>Selecione como quer acessar o CofRe.</p>
          </div>
          <Alerta tipo="err" msg={erro}/>
          <div style={{display:'flex',flexDirection:'column',gap:'.8rem'}}>
            {planos.map(p=>{
              const badge=badges[p.slug];
              const econ=p.slug==='anual'?`Economize R$ ${(PRECO_MENSAL_REF*12-parseFloat(p.preco)).toFixed(0)} vs mensal×12`:null;
              return <button key={p.slug} onClick={()=>handleEscolherPlano(p.slug)} disabled={load}
                       style={{display:'flex',alignItems:'center',gap:'1rem',padding:'1.1rem 1.2rem',background:C.bg3,border:`2px solid ${planoSel===p.slug?cores[p.slug]:C.bord}`,borderRadius:14,cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'all .2s',width:'100%',position:'relative'}}>
                {badge&&<span style={{position:'absolute',top:-9,right:12,background:badge.b,color:badge.c,fontSize:'.6rem',fontWeight:700,padding:'.2rem .55rem',borderRadius:99,textTransform:'uppercase',border:`1px solid ${badge.c}50`}}>{badge.l}</span>}
                <span style={{fontSize:'1.6rem',width:40,textAlign:'center',flexShrink:0}}>{icons[p.slug]}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'.97rem',color:cores[p.slug]||C.t0}}>{p.nome}</div>
                  <div style={{fontSize:'.77rem',color:C.t2,marginTop:2,lineHeight:1.5}}>{p.descricao}</div>
                  {econ&&<div style={{fontSize:'.72rem',color:C.accent,marginTop:3,fontWeight:600}}>💰 {econ}</div>}
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:'1.25rem',fontWeight:800,color:cores[p.slug]||C.t0}}>R$&nbsp;{parseFloat(p.preco).toFixed(2).replace('.',',')}</div>
                  <div style={{fontSize:'.7rem',color:C.t3}}>{p.slug==='por_acesso'?'por sessão':p.slug==='mensal'?'/mês':'/ano'}</div>
                </div>
              </button>;
            })}
          </div>
          {load&&<div style={{textAlign:'center',marginTop:'1rem',color:C.t2,fontSize:'.85rem',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Spin/> Gerando Pix…</div>}
          <div style={{marginTop:'1.2rem',padding:'.75rem',background:C.bg3,border:`1px solid ${C.bord}`,borderRadius:10,fontSize:'.71rem',color:C.t3,textAlign:'center',lineHeight:1.6}}>
            🔒 Pagamentos via Pix processados pela EFÍ Bank.<br/>Planos mensais/anuais ativados automaticamente.
          </div>
        </div>
      </div>
    </div>;
  }

  // TELA PIX
  if(tela==='pix'){
    const nomePlano=planos.find(p=>p.slug===planoSel)?.nome||'Acesso';
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem',background:bg}}>
      <div style={{width:'100%',maxWidth:440}}>
        <div className="au" style={card}>
          {pixPago?(
            <div style={{textAlign:'center',padding:'.5rem'}}>
              <div style={{fontSize:'3.5rem',marginBottom:'1rem'}}>✅</div>
              <h3 style={{fontSize:'1.2rem',fontWeight:800,color:C.green,marginBottom:'.4rem'}}>Pagamento confirmado!</h3>
              <p style={{fontSize:'.87rem',color:C.t2,marginBottom:'1.5rem'}}>{planoSel==='por_acesso'?'Sessão liberada.':nomePlano+' ativado!'}</p>
              <button onClick={handleLoginComPix} disabled={load} style={{...btnP,maxWidth:200,margin:'0 auto'}}>
                {load?<><Spin/> Entrando…</>:'🔓 Abrir meu Cofre'}
              </button>
            </div>
          ):(
            <>
              <div style={{textAlign:'center',marginBottom:'1.2rem'}}>
                <h3 style={{fontSize:'1.1rem',fontWeight:800,color:C.t0,marginBottom:'.25rem'}}>💳 Pagamento via Pix</h3>
                <p style={{fontSize:'.82rem',color:C.t2}}>{nomePlano} — <strong style={{color:C.accent}}>R$&nbsp;{pixData?.valor?.toFixed(2).replace('.',',')}</strong></p>
                <span style={{fontSize:'.75rem',color:tempoExp<120?C.red:C.t3}}>
                  ⏱ Expira em: <strong style={{fontFamily:"'JetBrains Mono',monospace",color:tempoExp<120?C.red:C.t1}}>{fmtT(tempoExp)}</strong>
                </span>
              </div>
              {pixData?.qrcodeImg&&(
                <div style={{textAlign:'center',marginBottom:'1.1rem'}}>
                  <div style={{display:'inline-block',background:'#fff',padding:'.85rem',borderRadius:12,boxShadow:'0 4px 20px rgba(0,0,0,.2)'}}>
                    <img src={pixData.qrcodeImg?.startsWith('data:')?pixData.qrcodeImg:`data:image/png;base64,${pixData.qrcodeImg}`}
                         alt="QR Code Pix" style={{width:188,height:188,display:'block'}} onError={e=>{e.target.style.display='none';}}/>
                  </div>
                  <p style={{fontSize:'.71rem',color:C.t3,marginTop:'.4rem'}}>Escaneie com o app do seu banco</p>
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',gap:'.8rem',margin:'.85rem 0',color:C.t3,fontSize:'.72rem'}}>
                <div style={{flex:1,height:1,background:C.bord}}/><span>ou copie o código abaixo</span><div style={{flex:1,height:1,background:C.bord}}/>
              </div>
              <div style={{background:C.bg3,border:`1px solid ${C.bord}`,borderRadius:11,padding:'.8rem',marginBottom:'.85rem'}}>
                <p style={{fontSize:'.63rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:C.t3,marginBottom:'.35rem'}}>Pix Copia e Cola</p>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:'.66rem',color:C.t1,wordBreak:'break-all',lineHeight:1.6,marginBottom:'.65rem'}}>{pixData?.copiaCola}</div>
                <button onClick={()=>{navigator.clipboard.writeText(pixData.copiaCola);setCopiado(true);setTimeout(()=>setCopiado(false),2500);}}
                        style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,width:'100%',padding:'.6rem',
                          background:copiado?`${C.green}18`:`${C.accent}15`,border:`1px solid ${copiado?C.green:C.accent}50`,
                          borderRadius:9,cursor:'pointer',color:copiado?C.green:C.accent,fontFamily:'inherit',fontSize:'.85rem',fontWeight:700,transition:'all .2s'}}>
                  {copiado?'✅ Copiado!':'📋 Copiar código Pix'}
                </button>
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,color:C.t3,fontSize:'.76rem',marginBottom:'.7rem'}}><Spin/> Aguardando pagamento…</div>
              <button onClick={()=>{setTela('planos');setPixData(null);setPlanoSel(null);}}
                      style={{display:'block',width:'100%',background:'none',border:'none',cursor:'pointer',color:C.t3,fontFamily:'inherit',fontSize:'.75rem',textDecoration:'underline',textAlign:'center'}}>
                ← Voltar e escolher outro plano
              </button>
            </>
          )}
        </div>
      </div>
    </div>;
  }

  // TELA LOGIN NORMAL
  return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem',background:bg}}>
    <div style={{width:'100%',maxWidth:430}}>
      <button onClick={onVoltar} style={{background:'none',border:'none',cursor:'pointer',color:C.t2,fontSize:'.85rem',fontFamily:'inherit',padding:'.4rem 0',marginBottom:'1.2rem',display:'flex',alignItems:'center',gap:5}}>← Voltar</button>
      <div className="au" style={{...card,overflowY:'auto',maxHeight:'90vh'}}>
        <Logo/>
        <h1 style={{fontSize:'1.6rem',fontWeight:800,letterSpacing:'-.02em',color:C.t0,marginBottom:'.3rem'}}>Bem-vindo de volta</h1>
        <p style={{color:C.t2,fontSize:'.88rem',marginBottom:'1rem'}}>Entre com seu e-mail e senha</p>
        <BadgeSeguranca compact/>
        <div style={{height:'.8rem'}}/>
        <Alerta tipo="err" msg={erro}/>
        <Campo label="E-mail"><Txt value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" type="email" icon="✉️" autoComplete="email"/></Campo>
        <Campo label="Senha"><Pw value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Sua senha" autoComplete="current-password"/></Campo>
        <div style={{height:'.6rem'}}/>
        <button className="bp" style={btnP} onClick={handleLogin} disabled={load}>
          {load?<><Spin/> Verificando…</>:'🔓 Entrar no Cofre'}
        </button>
        <div style={{margin:'1rem 0 .5rem',padding:'.7rem .85rem',background:C.bg3,border:`1px solid ${C.bord}`,borderRadius:10}}>
          <p style={{fontSize:'.72rem',color:C.t3,lineHeight:1.6}}>
            💡 <strong style={{color:C.t2}}>Primeiro acesso gratuito.</strong>{' '}
            A partir do 2º login escolha entre <strong style={{color:C.accent}}>Por Acesso</strong>, <strong style={{color:C.teal}}>Mensal</strong> ou <strong style={{color:C.accent}}>Anual</strong>.
          </p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'1rem',margin:'.9rem 0',color:C.t3,fontSize:'.76rem'}}>
          <div style={{flex:1,height:1,background:C.bord}}/><span>ou</span><div style={{flex:1,height:1,background:C.bord}}/>
        </div>
        <button className="bg" style={btnG} onClick={onCadastro}>Criar nova conta</button>
      </div>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
// CADASTRO
// ══════════════════════════════════════════════════════════
function TelaCadastro({onLogin,onVoltar}){
  const {tema:C}=useT();
  const [f,setF]=useState({nome:'',sob:'',email:'',pw:'',pw2:''});
  const [msg,setMsg]=useState({t:'',m:''});
  const [load,setLoad]=useState(false);
  const up=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const btnP={display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'100%',padding:'.9rem',background:`linear-gradient(135deg,${C.accent},${C.accentL}80)`,color:C.bg0,fontFamily:'inherit',fontSize:'.97rem',fontWeight:700,border:'none',borderRadius:12,cursor:'pointer',minHeight:50};
  const btnG={display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'100%',padding:'.78rem',background:'transparent',color:C.t1,fontFamily:'inherit',fontSize:'.92rem',fontWeight:600,border:`1.5px solid ${C.bord}`,borderRadius:12,cursor:'pointer',minHeight:46};

  async function handleCadastro(){
    setMsg({t:'',m:''});
    if(!f.nome||!f.sob){setMsg({t:'err',m:'Preencha nome e sobrenome.'});return;}
    if(!f.email.includes('@')){setMsg({t:'err',m:'E-mail inválido.'});return;}
    if(f.pw.length<8){setMsg({t:'err',m:'Senha mínimo 8 caracteres.'});return;}
    if(f.pw!==f.pw2){setMsg({t:'err',m:'Senhas não coincidem.'});return;}
    setLoad(true);
    try{
      const en=f.email.toLowerCase().trim();
      const salt=gerarSalt();const chave=await derivarChave(f.pw,salt);
      const ver=JSON.parse(await gerarVerifier(chave));
      const emailEnc=await criptografar(en,chave);
      await fetch(`${API}/api/auth/cadastro`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:en,emailEnc,nome:f.nome,sobrenome:f.sob,senhaMestra:f.pw,kdfSalt:salt,verifierIv:ver.iv,verifierCt:ver.ct})})
        .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.erro);});
      setMsg({t:'ok',m:'Conta criada! Redirecionando…'});
      setTimeout(onLogin,2000);
    }catch(e){setMsg({t:'err',m:e.message.includes('fetch')?'Servidor indisponível.':e.message});}
    finally{setLoad(false);}
  }

  return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem',background:`radial-gradient(ellipse 80% 50% at 20% -10%,${C.accentD} 0%,transparent 60%),${C.bg0}`}}>
    <div style={{width:'100%',maxWidth:450}}>
      <button onClick={onVoltar} style={{background:'none',border:'none',cursor:'pointer',color:C.t2,fontSize:'.85rem',fontFamily:'inherit',padding:'.4rem 0',marginBottom:'1.2rem',display:'flex',alignItems:'center',gap:5}}>← Voltar</button>
      <div className="au" style={{background:C.bg2,border:`1px solid ${C.bord}`,borderRadius:20,padding:'2rem',boxShadow:C.cardShadow,maxHeight:'92vh',overflowY:'auto'}}>
        <Logo/>
        <h1 style={{fontSize:'1.6rem',fontWeight:800,letterSpacing:'-.02em',color:C.t0,marginBottom:'.3rem'}}>Criar minha conta</h1>
        <p style={{color:C.t2,fontSize:'.88rem',marginBottom:'1rem'}}>Seus dados cifrados — nem nós lemos</p>
        <BadgeSeguranca/>
        <Alerta tipo={msg.t} msg={msg.m}/>
        <div className="grid2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 .9rem'}}>
          <Campo label="Nome"><Txt value={f.nome} onChange={up('nome')} placeholder="João"/></Campo>
          <Campo label="Sobrenome"><Txt value={f.sob} onChange={up('sob')} placeholder="Silva"/></Campo>
        </div>
        <Campo label="E-mail" hint="Cifrado antes de chegar ao servidor"><Txt value={f.email} onChange={up('email')} placeholder="seu@email.com" type="email" icon="✉️" autoComplete="email"/></Campo>
        <Campo label="Senha"><Pw value={f.pw} onChange={up('pw')} placeholder="Mínimo 8 caracteres" autoComplete="new-password"/><Forca v={f.pw}/></Campo>
        <Campo label="Confirmar Senha"><Pw value={f.pw2} onChange={up('pw2')} placeholder="Repita a senha" autoComplete="new-password"/></Campo>
        <div style={{height:'.4rem'}}/>
        <button className="bp" style={{...btnP,marginBottom:'.7rem'}} onClick={handleCadastro} disabled={load}>
          {load?<><Spin/> Criando…</>:'✅ Criar Minha Conta'}
        </button>
        <div style={{display:'flex',alignItems:'center',gap:'1rem',margin:'.8rem 0',color:C.t3,fontSize:'.76rem'}}>
          <div style={{flex:1,height:1,background:C.bord}}/><span>ou</span><div style={{flex:1,height:1,background:C.bord}}/>
        </div>
        <button className="bg" style={btnG} onClick={onLogin}>Já tenho conta — Entrar</button>
      </div>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════
// COFRE PRINCIPAL
// ══════════════════════════════════════════════════════════
const ICONES=['📁','🏠','💼','🎓','🏥','🚗','✈️','🎮','💡','🔧','📞','🛒','🎵','📷','🏋️','🌐','🔑','📋','💰','🎯'];
const TIPOS_CAMPO=[{v:'texto',l:'Texto'},{v:'senha',l:'Senha (ocultada)'},{v:'numero',l:'Número'},{v:'url',l:'URL / Link'},{v:'nota',l:'Nota longa'}];

function TelaCofre(){
  const {chaveAES,nome,sair,token}=useAuth();
  const {tema:C,temaKey,aplicarTema}=useT();
  const isMobile=useIsMobile();

  const [creds,setCreds]=useState([]);
  const [cats,setCats]=useState([]);
  const [loading,setLoading]=useState(true);
  const [cat,setCat]=useState(null);
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [showAdmin,setShowAdmin]=useState(false);
  const adminCliques=useRef(0);
  const timerAdmin=useRef(null);
  const handleLogoClick=useCallback(()=>{
    adminCliques.current=(adminCliques.current||0)+1;
    clearTimeout(timerAdmin.current);
    if(adminCliques.current>=5){
      adminCliques.current=0;
      setShowAdmin(true);
    }else{
      timerAdmin.current=setTimeout(()=>{adminCliques.current=0;},3000);
    }
  },[]);
  const [modalNovo,setModalNovo]=useState(null);
  const [modalVer,setModalVer]=useState(null);
  const [modalEdit,setModalEdit]=useState(null);
  const [modalNovaCategoria,setModalNovaCategoria]=useState(false);
  const [toast,setToast]=useState(null);
  const [alertaVenc,setAlertaVenc]=useState(null);

  const showToast=(m,t='ok')=>{setToast({m,t});setTimeout(()=>setToast(null),3200);};

  const loadCats=useCallback(async()=>{
    try{
      const data=await fetch(`${API}/categorias`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json());
      const dec=await Promise.all(data.map(async c=>{
        if(c.eh_sistema)return{...c,nome:c.nome_enc};
        try{return{...c,nome:await descriptografar(c.nome_enc,chaveAES)};}catch{return{...c,nome:'Categoria'};}
      }));
      setCats(dec);
    }catch{}
  },[token,chaveAES]);

  const loadCreds=useCallback(async()=>{
    setLoading(true);
    try{
      const rows=await fetch(`${API}/cofre`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json());
      const dec=await Promise.all(rows.map(async r=>{
        const base=await descriptografarCredencial(r,chaveAES);
        let extras=[];
        if(r.campos_extras_enc){try{extras=JSON.parse(await descriptografar(r.campos_extras_enc,chaveAES));}catch{}}
        let catNome=r.categoria_nome_enc;
        if(!r.eh_sistema){try{catNome=await descriptografar(r.categoria_nome_enc,chaveAES);}catch{}}
        return{...base,camposExtras:extras,categoriaNome:catNome,catIcone:r.icone};
      }));
      setCreds(dec);
    }catch(e){showToast('Erro ao carregar: '+e.message,'err');}
    finally{setLoading(false);}
  },[token,chaveAES]);

  useEffect(()=>{loadCats();loadCreds();},[loadCats,loadCreds]);

  // Alerta de vencimento
  useEffect(()=>{
    if(!token)return;
    fetch(`${API}/usuario/status-assinatura`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.json()).then(d=>{if(d.assinatura?.alertar)setAlertaVenc(d.assinatura);}).catch(()=>{});
  },[token]);

  // Timer inatividade (5 min — vale para TODOS os planos)
  useEffect(()=>{
    const MS=5*60*1000;let t;
    const reset=()=>{clearTimeout(t);t=setTimeout(()=>{sair();setTimeout(()=>alert('Sessão encerrada por inatividade (5 min).'),100);},MS);};
    const evts=['mousemove','mousedown','keydown','touchstart','scroll','click'];
    evts.forEach(e=>window.addEventListener(e,reset,{passive:true}));
    reset();
    return()=>{clearTimeout(t);evts.forEach(e=>window.removeEventListener(e,reset));};
  },[sair]);

  useEffect(()=>{
    const fn=e=>{if(e.key==='Escape'){setModalNovo(null);setModalVer(null);setModalEdit(null);setModalNovaCategoria(false);setDrawerOpen(false);}};
    window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);
  },[]);

  const catsSistema=cats.filter(c=>c.eh_sistema);
  const catsCustom=cats.filter(c=>!c.eh_sistema);
  const cnt={all:creds.length,favs:creds.filter(c=>c.favorito).length};
  cats.forEach(c=>{cnt[c.id]=creds.filter(x=>x.categoriaId===c.id).length;});

  const navTo=id=>{setCat(id);setDrawerOpen(false);};

  async function toggleFav(id){
    const c=creds.find(x=>x.id===id);if(!c)return;
    const nf=c.favorito?0:1;
    setCreds(p=>p.map(x=>x.id===id?{...x,favorito:nf}:x));
    try{
      const enc=await encCred(c,chaveAES);
      await fetch(`${API}/cofre/${id}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...enc,categoriaId:c.categoriaId,favorito:nf})});
    }catch{}
  }
  async function deletar(id){
    if(!confirm('Excluir esta senha?'))return;
    await fetch(`${API}/cofre/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    setCreds(p=>p.filter(c=>c.id!==id));setModalVer(null);showToast('Senha excluída.');
  }
  async function deletarCat(id){
    if(!confirm('Excluir categoria e todas as suas senhas?'))return;
    await fetch(`${API}/categorias/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    setCreds(p=>p.filter(c=>c.categoriaId!==id));setCats(p=>p.filter(c=>c.id!==id));
    if(cat===id)setCat(null);showToast('Categoria removida.');
  }

  const navB={display:'flex',alignItems:'center',gap:'.65rem',padding:'.62rem .9rem',borderRadius:10,cursor:'pointer',color:C.t1,fontSize:'.88rem',fontWeight:500,border:'1px solid transparent',background:'none',width:'100%',textAlign:'left',fontFamily:'inherit',transition:'all .15s'};
  const navA={background:C.bg3,color:C.accent,borderColor:`${C.accent}35`};
  const cntB=a=>({marginLeft:'auto',background:a?C.accentD:C.bg4,color:a?C.accent:C.t2,fontSize:'.68rem',fontWeight:600,padding:'.07rem .4rem',borderRadius:99});

  const bnItems=[
    {id:null,icon:'🔒',label:'Todas'},
    {id:catsSistema[0]?.id||1,icon:'💳',label:'Banco'},
    {id:catsSistema[1]?.id||2,icon:'📱',label:'Redes'},
    {id:catsSistema[2]?.id||3,icon:'💻',label:'Device'},
    {id:'perfil',icon:'👤',label:'Perfil'},
  ];

  function SidebarContent(){return <>
    <div>
      <p style={{fontSize:'.63rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:C.t3,marginBottom:'.35rem',paddingLeft:'.5rem'}}>Consulta</p>
      <button className="cn" onClick={()=>navTo(null)} style={{...navB,...(cat===null?navA:{})}}><span style={{fontSize:'.95rem',width:17,textAlign:'center'}}>🔒</span>Todas<span style={cntB(cat===null)}>{cnt.all}</span></button>
      <button className="cn" onClick={()=>navTo('favs')} style={{...navB,...(cat==='favs'?navA:{})}}><span style={{fontSize:'.95rem',width:17,textAlign:'center'}}>⭐</span>Favoritos<span style={cntB(cat==='favs')}>{cnt.favs}</span></button>
    </div>
    <div>
      <p style={{fontSize:'.63rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:C.t3,marginBottom:'.35rem',paddingLeft:'.5rem'}}>Categorias</p>
      {catsSistema.map(c=>(
        <button key={c.id} className="cn" onClick={()=>navTo(c.id)} style={{...navB,...(cat===c.id?navA:{})}}><span style={{fontSize:'.95rem',width:17,textAlign:'center'}}>{c.icone}</span><span style={{flex:1,textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nome}</span><span style={cntB(cat===c.id)}>{cnt[c.id]||0}</span></button>
      ))}
    </div>
    {catsCustom.length>0&&<div>
      <p style={{fontSize:'.63rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:C.t3,marginBottom:'.35rem',paddingLeft:'.5rem'}}>Minhas Categorias</p>
      {catsCustom.map(c=>(
        <div key={c.id} style={{display:'flex',alignItems:'center',gap:3}}>
          <button className="cn" onClick={()=>navTo(c.id)} style={{...navB,flex:1,...(cat===c.id?navA:{})}}><span style={{fontSize:'.95rem',width:17,textAlign:'center'}}>{c.icone}</span><span style={{flex:1,textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.nome}</span><span style={cntB(cat===c.id)}>{cnt[c.id]||0}</span></button>
          <button onClick={()=>deletarCat(c.id)} style={{background:'none',border:'none',cursor:'pointer',color:C.t3,fontSize:'.8rem',padding:'0 .2rem',flexShrink:0,transition:'color .2s'}} onMouseEnter={e=>e.target.style.color=C.red} onMouseLeave={e=>e.target.style.color=C.t3}>✕</button>
        </div>
      ))}
    </div>}
    <button className="addcat" onClick={()=>{setModalNovaCategoria(true);setDrawerOpen(false);}}
            style={{display:'flex',alignItems:'center',gap:7,padding:'.5rem .9rem',background:'transparent',border:`1px dashed ${C.bord}`,borderRadius:10,cursor:'pointer',color:C.t2,fontFamily:'inherit',fontSize:'.78rem',fontWeight:600,transition:'all .2s',width:'100%',textAlign:'left'}}>
      <span style={{fontSize:'.85rem',opacity:.7}}>＋</span>Adicionar categoria
    </button>
  </>;}

  return <div style={{minHeight:'100vh',background:C.bg0}}>
    {/* Header */}
    <header style={{background:C.bg1,borderBottom:`1px solid ${C.bord}`,padding:'0 1rem',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:'1.2rem',fontWeight:700,letterSpacing:'-.02em'}}>
        {isMobile&&<button onClick={()=>setDrawerOpen(v=>!v)} style={{background:'none',border:'none',cursor:'pointer',color:C.t1,fontSize:'1.3rem',padding:'.2rem',lineHeight:1,marginRight:4}}>☰</button>}
        <div onClick={handleLogoClick}
             style={{width:30,height:30,background:`linear-gradient(135deg,${C.accent},${C.accentL})`,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.85rem',boxShadow:`0 3px 10px ${C.accentG}`,cursor:'default',userSelect:'none'}}>🔐</div>
        <span style={{color:C.t0}}>Cof<span style={{color:C.accent}}>Re</span></span>
        <BadgeSeguranca compact/>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:7}}>
        <div onClick={()=>navTo('perfil')} style={{display:'flex',alignItems:'center',gap:5,background:C.bg3,border:`1px solid ${C.bord}`,borderRadius:99,padding:'.25rem .75rem .25rem .33rem',fontSize:'.84rem',cursor:'pointer'}}>
          <div style={{width:22,height:22,borderRadius:'50%',background:`linear-gradient(135deg,${C.accent},${C.accentL})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.65rem',fontWeight:700,color:C.bg0}}>{nome?.[0]?.toUpperCase()||'?'}</div>
          <span className="hide-mobile" style={{color:C.t1}}>{nome}</span>
        </div>
        <button className="lo" onClick={sair} title="Sair" style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,background:'none',border:`1.5px solid ${C.bord}`,borderRadius:9,cursor:'pointer',color:C.t2,fontSize:'.85rem'}}>🚪</button>
      </div>
    </header>

    {/* Banner vencimento */}
    {alertaVenc&&(
      <div style={{background:alertaVenc.urgente?`${C.red}18`:`${C.accent}12`,borderBottom:`1px solid ${alertaVenc.urgente?C.red:C.accent}40`,padding:'.6rem 1.4rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',fontSize:'.78rem',color:alertaVenc.urgente?C.red:C.accent}}>
        <span>{alertaVenc.urgente?'🚨':'⚠️'} Seu plano <strong>{alertaVenc.plano}</strong> vence em <strong>{alertaVenc.diasRestantes} dia{alertaVenc.diasRestantes!==1?'s':''}</strong> ({new Date(alertaVenc.expiraEm).toLocaleDateString('pt-BR')}). Renove para não perder o acesso.</span>
        <button onClick={()=>setAlertaVenc(null)} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:'1rem',flexShrink:0}}>✕</button>
      </div>
    )}

    {/* Drawer mobile */}
    {isMobile&&drawerOpen&&<div onClick={()=>setDrawerOpen(false)} style={{position:'fixed',inset:0,zIndex:150,background:'rgba(0,0,0,.6)',backdropFilter:'blur(3px)'}}/>}
    {isMobile&&(
      <nav style={{position:'fixed',top:56,left:0,bottom:0,zIndex:160,background:C.bg1,borderRight:`1px solid ${C.bord}`,overflowY:'auto',padding:'1rem .9rem',width:240,display:'flex',flexDirection:'column',gap:'.9rem',transform:drawerOpen?'translateX(0)':'translateX(-100%)',transition:'transform .25s ease'}}>
        <SidebarContent/>
      </nav>
    )}

    <div className="app-layout">
      {!isMobile&&<nav className="app-sidebar"><SidebarContent/></nav>}
      <main className="app-main">
        {cat==='perfil'
          ?<Perfil onVoltar={()=>setCat(null)} token={token} chaveAES={chaveAES} showToast={showToast}/>
          :(cat===null||cat==='favs')
          ?<VistaGeral cat={cat} creds={creds} cats={cats} loading={loading} onVer={setModalVer} onFav={toggleFav} onAbrirCat={id=>{setCat(id);setDrawerOpen(false);}}/>
          :<VistaCat catId={cat} cats={cats} creds={creds} loading={loading} onVer={setModalVer} onFav={toggleFav} onAdd={()=>setModalNovo(cat)}/>
        }
      </main>
    </div>

    {/* Bottom nav mobile */}
    <nav className="bnav" style={{position:'fixed',bottom:0,left:0,right:0,zIndex:140,background:C.bg1,borderTop:`1px solid ${C.bord}`,height:62,alignItems:'center',justifyContent:'space-around',padding:'0 .3rem',paddingBottom:'env(safe-area-inset-bottom,0)'}}>
      {bnItems.map(item=>{
        const active=cat===item.id;
        return <button key={String(item.id)} className="bnnav-btn" onClick={()=>navTo(item.id)}
                 style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'none',border:'none',cursor:'pointer',padding:'.32rem .4rem',borderRadius:9,flex:1,color:active?C.accent:C.t2,transition:'color .15s'}}>
          <span style={{fontSize:'1.25rem',lineHeight:1}}>{item.icon}</span>
          <span style={{fontSize:'.58rem',fontWeight:active?700:500}}>{item.label}</span>
        </button>;
      })}
      <button className="bnnav-btn" onClick={()=>setModalNovaCategoria(true)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'none',border:'none',cursor:'pointer',padding:'.32rem .4rem',borderRadius:9,flex:1,color:C.t3}}>
        <span style={{fontSize:'1.25rem',lineHeight:1}}>＋</span>
        <span style={{fontSize:'.58rem',fontWeight:500}}>Categoria</span>
      </button>
    </nav>

    {/* Toast */}
    {toast&&<div style={{position:'fixed',bottom:isMobile?'70px':'1.3rem',right:'1rem',zIndex:999,background:C.bg3,border:`1px solid ${toast.t==='ok'?C.green:C.red}50`,borderRadius:11,padding:'.68rem .95rem',display:'flex',alignItems:'center',gap:7,fontSize:'.82rem',color:C.t0,boxShadow:C.cardShadow,animation:'up .3s ease',minWidth:200,maxWidth:'calc(100vw - 2rem)'}}>
      {toast.t==='ok'?'✅':'❌'} {toast.m}
    </div>}

    {modalNovo!==null&&<ModalForm cats={cats} chaveAES={chaveAES} token={token} catDefault={modalNovo} onSalvo={async()=>{await loadCreds();setModalNovo(null);showToast('Senha salva! 🔒');}} onClose={()=>setModalNovo(null)}/>}
    {modalVer&&<ModalVer cred={modalVer} cats={cats} onClose={()=>setModalVer(null)} onEditar={()=>{setModalEdit(modalVer);setModalVer(null);}} onDeletar={()=>deletar(modalVer.id)}/>}
    {modalEdit&&<ModalForm cats={cats} chaveAES={chaveAES} token={token} credExistente={modalEdit} onSalvo={async()=>{await loadCreds();setModalEdit(null);showToast('Senha atualizada! 🔒');}} onClose={()=>setModalEdit(null)}/>}
    {modalNovaCategoria&&<ModalNovaCategoria chaveAES={chaveAES} token={token} onSalvo={async()=>{await loadCats();setModalNovaCategoria(false);showToast('Categoria criada!');}} onClose={()=>setModalNovaCategoria(false)}/>}
    {showAdmin&&<PainelAdmin onSair={()=>setShowAdmin(false)}/>}
  </div>;
}

// ── Vistas ───────────────────────────────────────────────────
function Estado({icon,txt,sub}){
  const {tema:C}=useT();
  return <div style={{textAlign:'center',padding:'3rem 2rem',color:C.t2}}>
    <div style={{fontSize:'2.5rem',opacity:.38,marginBottom:'.7rem'}}>{icon}</div>
    <p style={{color:C.t1,fontWeight:600,marginBottom:'.28rem'}}>{txt}</p>
    {sub&&<p style={{fontSize:'.8rem'}}>{sub}</p>}
  </div>;
}

function VistaGeral({cat,creds,cats,loading,onVer,onFav,onAbrirCat}){
  const {tema:C}=useT();
  const [busca,setBusca]=useState('');

  const catsSistema  = cats.filter(c=>c.eh_sistema);
  const catsCustom   = cats.filter(c=>!c.eh_sistema);

  // Na busca: mostra tudo sem filtro de categoria
  // Sem busca: credenciais de sistema normais + categorias personalizadas como pastas
  const isBusca = busca.trim().length > 0;

  let listaFavs     = creds.filter(c=>c.favorito);
  let listaSistema  = creds.filter(c=>catsSistema.some(cs=>cs.id===c.categoriaId));
  let listaCustom   = creds.filter(c=>catsCustom.some(cc=>cc.id===c.categoriaId));

  // Aplica busca
  const filtra = lista => lista.filter(c=>
    (c.titulo||'').toLowerCase().includes(busca.toLowerCase()) ||
    (c.login||'').toLowerCase().includes(busca.toLowerCase())
  );

  const inp={width:'100%',background:C.bg2,border:`1.5px solid ${C.bord}`,borderRadius:12,color:C.t0,fontFamily:'inherit',fontSize:'.9rem',padding:'.78rem .95rem .78rem 2.5rem',outline:'none',transition:'border-color .2s',minHeight:46};

  if(cat==='favs'){
    const lista=isBusca?filtra(listaFavs):listaFavs;
    return <div className="asi">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
        <span style={{fontSize:'1.05rem',fontWeight:700,color:C.t0}}>⭐ Favoritos</span>
        <span style={{color:C.t2,fontSize:'.82rem'}}>{lista.length} item{lista.length!==1?'s':''}</span>
      </div>
      <div style={{position:'relative',marginBottom:'1rem'}}>
        <span style={{position:'absolute',left:'.85rem',top:'50%',transform:'translateY(-50%)',color:C.t2,fontSize:'.95rem',pointerEvents:'none'}}>🔍</span>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar em favoritos…" style={inp}
               onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.bord}/>
      </div>
      {loading?<Estado icon="⏳" txt="Carregando…"/>
       :lista.length===0?<Estado icon="⭐" txt="Nenhum favorito" sub="Marque itens com ⭐ para vê-los aqui"/>
       :<div className="cards-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(255px,1fr))',gap:'.75rem'}}>
          {lista.map(c=>{const ci=cats.find(x=>x.id===c.categoriaId);return <CredCard key={c.id} c={c} catIcon={ci?.icone||'📁'} onVer={()=>onVer(c)} onFav={()=>onFav(c.id)}/>;}) }
        </div>}
    </div>;
  }

  // Vista "Todas"
  const listaSystemaBusca = filtra(listaSistema);
  const listaCustomBusca  = filtra(listaCustom);
  const totalVisible = isBusca
    ? listaSystemaBusca.length + listaCustomBusca.length
    : listaSistema.length + catsCustom.length;

  return <div className="asi">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
      <span style={{fontSize:'1.05rem',fontWeight:700,color:C.t0}}>🔒 Todas as senhas</span>
      <span style={{color:C.t2,fontSize:'.82rem'}}>{totalVisible} item{totalVisible!==1?'s':''}</span>
    </div>
    <div style={{position:'relative',marginBottom:'1.2rem'}}>
      <span style={{position:'absolute',left:'.85rem',top:'50%',transform:'translateY(-50%)',color:C.t2,fontSize:'.95rem',pointerEvents:'none'}}>🔍</span>
      <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar em todas as senhas…" style={inp}
             onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.bord}/>
    </div>

    {loading ? <Estado icon="⏳" txt="Carregando…"/> : <>

      {/* Categorias personalizadas — aparecem como PASTAS */}
      {!isBusca && catsCustom.length>0 && (
        <div style={{marginBottom:'1.4rem'}}>
          <p style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:C.t3,marginBottom:'.6rem'}}>Minhas Categorias</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'.75rem'}}>
            {catsCustom.map(cat=>{
              const qtd=creds.filter(c=>c.categoriaId===cat.id).length;
              return (
                <div key={cat.id} className="cc"
                     onClick={()=>onAbrirCat(cat.id)}
                     style={{display:'flex',alignItems:'center',gap:'.85rem',background:C.bg2,border:`1.5px solid ${C.bord}`,borderRadius:13,padding:'1rem 1.1rem',cursor:'pointer',transition:'all .2s'}}>
                  <div style={{width:44,height:44,borderRadius:11,background:C.bg3,border:`1px solid ${C.bord}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',flexShrink:0}}>{cat.icone}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:'.95rem',color:C.t0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cat.nome}</div>
                    <div style={{fontSize:'.75rem',color:C.t2,marginTop:2}}>{qtd} item{qtd!==1?'s':''}</div>
                  </div>
                  <span style={{color:C.t2,fontSize:'1.1rem',flexShrink:0}}>›</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Na busca: resultados de categorias personalizadas */}
      {isBusca && listaCustomBusca.length>0 && (
        <div style={{marginBottom:'1.4rem'}}>
          <p style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:C.t3,marginBottom:'.6rem'}}>Minhas Categorias</p>
          <div className="cards-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(255px,1fr))',gap:'.75rem'}}>
            {listaCustomBusca.map(c=>{const ci=cats.find(x=>x.id===c.categoriaId);return <CredCard key={c.id} c={c} catIcon={ci?.icone||'📁'} onVer={()=>onVer(c)} onFav={()=>onFav(c.id)}/>;}) }
          </div>
        </div>
      )}

      {/* Credenciais das categorias do sistema */}
      {(isBusca ? listaSystemaBusca : listaSistema).length>0 && (
        <div>
          {catsCustom.length>0 && <p style={{fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:C.t3,marginBottom:'.6rem'}}>Categorias do Sistema</p>}
          <div className="cards-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(255px,1fr))',gap:'.75rem'}}>
            {(isBusca ? listaSystemaBusca : listaSistema).map(c=>{const ci=cats.find(x=>x.id===c.categoriaId);return <CredCard key={c.id} c={c} catIcon={ci?.icone||'📁'} onVer={()=>onVer(c)} onFav={()=>onFav(c.id)}/>;}) }
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {totalVisible===0 && (
        <Estado icon={isBusca?'🔍':'🔒'} txt={isBusca?'Nenhum resultado':'Nenhuma senha cadastrada'} sub={isBusca?'Tente outros termos':'Selecione uma categoria no menu para começar'}/>
      )}
    </>}
  </div>;
}

function VistaCat({catId,cats,creds,loading,onVer,onFav,onAdd}){
  const {tema:C}=useT();
  const [busca,setBusca]=useState('');
  const ci=cats.find(c=>c.id===catId)||{nome:'Categoria',icone:'📁'};
  let lista=creds.filter(c=>c.categoriaId===catId);
  if(busca)lista=lista.filter(c=>(c.titulo||'').toLowerCase().includes(busca.toLowerCase()));
  const inp={width:'100%',background:C.bg2,border:`1.5px solid ${C.bord}`,borderRadius:12,color:C.t0,fontFamily:'inherit',fontSize:'.9rem',padding:'.78rem .95rem .78rem 2.5rem',outline:'none',transition:'border-color .2s',minHeight:46};
  return <div className="asi">
    <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:'1.2rem',flexWrap:'wrap'}}>
      <div style={{width:44,height:44,borderRadius:12,background:C.bg3,border:`1px solid ${C.bord}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem'}}>{ci.icone}</div>
      <div><h2 style={{fontSize:'1.15rem',fontWeight:800,color:C.t0,margin:0}}>{ci.nome}</h2><p style={{color:C.t2,fontSize:'.76rem',margin:0}}>{lista.length} item{lista.length!==1?'s':''}</p></div>
    </div>
    <div style={{position:'relative',marginBottom:'.9rem'}}>
      <span style={{position:'absolute',left:'.85rem',top:'50%',transform:'translateY(-50%)',color:C.t2,fontSize:'.95rem',pointerEvents:'none'}}>🔍</span>
      <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder={`Buscar em ${ci.nome}…`} style={inp}
             onFocus={e=>{e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.bord;}}/>
    </div>
    <button className="acb" onClick={onAdd} style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'.8rem 1rem',background:'transparent',border:`2px dashed ${C.bord}`,borderRadius:12,cursor:'pointer',color:C.t2,fontFamily:'inherit',fontSize:'.88rem',fontWeight:600,marginBottom:'1rem',transition:'all .2s',textAlign:'left'}}>
      <span style={{width:32,height:32,borderRadius:8,background:C.bg3,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.1rem',flexShrink:0}}>＋</span>
      <div><div style={{color:C.t1,fontWeight:700,fontSize:'.88rem'}}>Adicionar em {ci.nome}</div><div style={{color:C.t3,fontSize:'.72rem',marginTop:1}}>Nova entrada nesta categoria</div></div>
    </button>
    {loading?<Estado icon="⏳" txt="Carregando…"/>
     :lista.length===0?<div style={{textAlign:'center',padding:'2.2rem',background:C.bg2,borderRadius:13,border:`1px solid ${C.bord}`}}>
        <div style={{fontSize:'2.2rem',opacity:.35,marginBottom:'.6rem'}}>{ci.icone}</div>
        <p style={{color:C.t1,fontWeight:600,marginBottom:'.25rem'}}>Nenhum cadastrado ainda</p>
      </div>
     :<div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
        {lista.map(c=>(
          <div key={c.id} className="cc" style={{display:'flex',alignItems:'center',gap:'.95rem',background:C.bg2,border:`1.5px solid ${C.bord}`,borderRadius:12,padding:'.88rem 1rem',cursor:'pointer',transition:'all .2s'}} onClick={()=>onVer(c)}>
            <SvcLogo titulo={c.titulo} catIcon={ci.icone} size={40}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:'.93rem',color:C.t0}}>{c.titulo||'—'}</div>
              {c.login&&<div style={{fontSize:'.77rem',color:C.t2,marginTop:1}}>{c.login}</div>}
              {c.camposExtras?.length>0&&<div style={{fontSize:'.72rem',color:C.t3,marginTop:2}}>{c.camposExtras.length} campo{c.camposExtras.length!==1?'s':''} adicional{c.camposExtras.length!==1?'is':''}</div>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
              <button onClick={e=>{e.stopPropagation();onFav(c.id);}} style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:'1rem',color:c.favorito?C.accent:C.t3,lineHeight:1}}>{c.favorito?'⭐':'☆'}</button>
              <span style={{color:C.t2,fontSize:'.9rem'}}>›</span>
            </div>
          </div>
        ))}
      </div>}
  </div>;
}

function CredCard({c,catIcon,onVer,onFav}){
  const {tema:C}=useT();
  return <div className="cc" style={{background:C.bg2,border:`1.5px solid ${C.bord}`,borderRadius:13,padding:'.9rem',cursor:'pointer',transition:'all .2s'}} onClick={onVer}>
    <div style={{display:'flex',alignItems:'center',gap:'.6rem',marginBottom:'.58rem'}}>
      <SvcLogo titulo={c.titulo} catIcon={catIcon} size={36}/>
      <div style={{minWidth:0,flex:1}}>
        <div style={{fontWeight:700,fontSize:'.9rem',color:C.t0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.titulo||'—'}</div>
        <div style={{fontSize:'.75rem',color:C.t2,marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.login||c.categoriaNome||''}</div>
      </div>
    </div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'.52rem',borderTop:`1px solid ${C.bord}`}}>
      <span style={{fontSize:'.7rem',color:C.t3}}>🔒 Criptografado</span>
      <button onClick={e=>{e.stopPropagation();onFav();}} style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:'.93rem',color:c.favorito?C.accent:C.t3,lineHeight:1}}>{c.favorito?'⭐':'☆'}</button>
    </div>
  </div>;
}

// ── Helper cifra credencial ──────────────────────────────────
async function encCred(obj,chaveAES){
  const enc=await criptografarCredencial(obj,chaveAES);
  let camposExtrasEnc=null;
  if(obj.camposExtras?.length>0) camposExtrasEnc=await criptografar(JSON.stringify(obj.camposExtras),chaveAES);
  return{...enc,camposExtrasEnc};
}

// ── Modal: Nova categoria ────────────────────────────────────
function ModalNovaCategoria({chaveAES,token,onSalvo,onClose}){
  const {tema:C}=useT();
  const [nome,setNome]=useState('');const [icone,setIcone]=useState('📁');const [erro,setErro]=useState('');const [load,setLoad]=useState(false);
  async function salvar(){
    if(!nome.trim()){setErro('Dê um nome.');return;}setLoad(true);
    try{const ne=await criptografar(nome.trim(),chaveAES);
      await fetch(`${API}/categorias`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({nomeEnc:ne,icone})});
      await onSalvo();}catch(e){setErro(e.message);}finally{setLoad(false);}
  }
  const bd={position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,.8)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.4rem',backdropFilter:'blur(8px)'};
  const md={background:C.bg2,border:`1px solid ${C.bordH}`,borderRadius:20,width:'100%',maxWidth:440,boxShadow:C.cardShadow,maxHeight:'92vh',overflowY:'auto'};
  return <div style={bd} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={md}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.2rem 1.5rem .9rem',borderBottom:`1px solid ${C.bord}`}}>
        <span style={{fontSize:'1rem',fontWeight:700,color:C.t0}}>Nova Categoria</span>
        <button className="mc" style={{width:30,height:30,background:C.bg3,border:`1px solid ${C.bord}`,borderRadius:8,cursor:'pointer',color:C.t2,fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>✕</button>
      </div>
      <div style={{padding:'1.3rem 1.5rem'}}>
        <Alerta tipo="err" msg={erro}/>
        <Campo label="Nome da categoria"><Txt value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex: Trabalho, Casa, Saúde…" autoComplete="off"/></Campo>
        <Campo label="Ícone">
          <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:'.35rem',marginTop:'.2rem'}}>
            {ICONES.map(i=><button key={i} onClick={()=>setIcone(i)} className="ico-btn"
               style={{width:'100%',aspectRatio:'1',background:i===icone?C.accentD:C.bg3,border:`1.5px solid ${i===icone?C.accent:C.bord}`,borderRadius:8,cursor:'pointer',fontSize:'1.1rem',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>{i}</button>)}
          </div>
        </Campo>
        <div style={{padding:'.7rem .85rem',background:C.accentD,border:`1px solid ${C.accent}30`,borderRadius:9,fontSize:'.76rem',color:C.t1}}>
          🔒 O nome da categoria será cifrado — só você poderá ler.
        </div>
      </div>
      <div style={{padding:'.9rem 1.5rem',borderTop:`1px solid ${C.bord}`,display:'flex',gap:'.7rem'}}>
        <button className="bp" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'.9rem',background:`linear-gradient(135deg,${C.accent},${C.accentL}80)`,color:C.bg0,fontFamily:'inherit',fontSize:'.97rem',fontWeight:700,border:'none',borderRadius:12,cursor:'pointer',minHeight:50}} onClick={salvar} disabled={load}>
          {load?<><Spin/> Criando…</>:'✅ Criar'}
        </button>
        <button className="bg" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'auto',minWidth:90,padding:'.78rem 1rem',background:'transparent',color:C.t1,fontFamily:'inherit',fontSize:'.88rem',fontWeight:600,border:`1.5px solid ${C.bord}`,borderRadius:12,cursor:'pointer'}} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  </div>;
}

// ── Modal: Form nova/editar credencial ───────────────────────
function ModalForm({cats,chaveAES,token,credExistente,catDefault,onSalvo,onClose}){
  const {tema:C}=useT();
  const allCats=[...cats.filter(c=>c.eh_sistema),...cats.filter(c=>!c.eh_sistema)];
  const [catId,setCatId]=useState(credExistente?.categoriaId||catDefault||allCats[0]?.id||1);
  const [f,setF]=useState({titulo:credExistente?.titulo||'',login:credExistente?.login||'',senha:credExistente?.senha||'',urlOuBanco:credExistente?.urlOuBanco||'',senha4dig:credExistente?.senha4dig||'',senha6dig:credExistente?.senha6dig||'',numeroCartao:credExistente?.numeroCartao||'',pinDispositivo:credExistente?.pinDispositivo||'',contaVinculada:credExistente?.contaVinculada||'',notas:credExistente?.notas||''});
  const [extras,setExtras]=useState(credExistente?.camposExtras||[]);
  const [erro,setErro]=useState('');const [load,setLoad]=useState(false);const [logo,setLogo]=useState(null);
  const up=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const catInfo=allCats.find(c=>c.id===catId);
  const ehSistema=catInfo?.eh_sistema??true;
  const catIdx=[1,2,3].indexOf(catId);
  const d=getDomain(f.titulo);
  useEffect(()=>{if(!d){setLogo(null);return;}const i=new Image();i.onload=()=>setLogo(i.src);i.onerror=()=>setLogo(null);i.src=`https://logo.clearbit.com/${d}`;},[d]);
  function addExtra(){setExtras(p=>[...p,{id:Date.now(),nome:'',tipo:'texto',valor:''}]);}
  function updExtra(id,k,v){setExtras(p=>p.map(e=>e.id===id?{...e,[k]:v}:e));}
  function delExtra(id){setExtras(p=>p.filter(e=>e.id!==id));}
  async function salvar(){
    setErro('');if(!f.titulo){setErro('Nome obrigatório.');return;}if(!f.senha){setErro('Senha obrigatória.');return;}
    for(const e of extras)if(!e.nome.trim()){setErro('Preencha o nome de todos os campos adicionais.');return;}
    setLoad(true);
    try{
      const enc=await encCred({...f,camposExtras:extras.map(e=>({nome:e.nome,tipo:e.tipo,valor:e.valor}))},chaveAES);
      if(credExistente){
        await fetch(`${API}/cofre/${credExistente.id}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...enc,categoriaId:catId,favorito:credExistente.favorito})});
      }else{
        await fetch(`${API}/cofre`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({categoriaId:catId,...enc})});
      }
      await onSalvo();
    }catch(e){setErro(e.message);}finally{setLoad(false);}
  }
  const pill=act=>({display:'flex',alignItems:'center',gap:5,padding:'.4rem .8rem',background:act?C.accentD:C.bg3,border:`1.5px solid ${act?C.accent:C.bord}`,borderRadius:99,cursor:'pointer',fontFamily:'inherit',color:act?C.accent:C.t1,fontSize:'.78rem',fontWeight:600,whiteSpace:'nowrap'});
  const bd={position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.78)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.3rem',backdropFilter:'blur(6px)'};
  const md={background:C.bg2,border:`1px solid ${C.bordH}`,borderRadius:20,width:'100%',maxWidth:560,maxHeight:'92vh',overflowY:'auto',boxShadow:C.cardShadow};
  const txtStyle={width:'100%',background:C.bg3,border:`1.5px solid ${C.bord}`,borderRadius:12,color:C.t0,fontFamily:'inherit',fontSize:'1rem',padding:'.78rem .95rem',outline:'none',transition:'border-color .2s',minHeight:48};
  return <div style={bd} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={md}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.2rem 1.5rem .9rem',borderBottom:`1px solid ${C.bord}`}}>
        <span style={{fontSize:'1rem',fontWeight:700,color:C.t0}}>{credExistente?`Editar — ${f.titulo||'Senha'}`:catInfo?`Novo em ${catInfo.nome}`:'Nova Senha'}</span>
        <button className="mc" style={{width:30,height:30,background:C.bg3,border:`1px solid ${C.bord}`,borderRadius:8,cursor:'pointer',color:C.t2,fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>✕</button>
      </div>
      <div style={{padding:'1.2rem 1.5rem'}}>
        <div style={{marginBottom:'1.1rem'}}>
          <p style={{fontSize:'.65rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:C.t3,marginBottom:'.45rem'}}>Categoria</p>
          {/* Se a categoria selecionada é personalizada, mostra ela em destaque e as outras como opção secundária */}
          {catInfo && !catInfo.eh_sistema ? (
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'.6rem .9rem',background:C.accentD,border:`2px solid ${C.accent}50`,borderRadius:11,marginBottom:'.5rem'}}>
                <span style={{fontSize:'1.1rem'}}>{catInfo.icone}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'.88rem',color:C.accent}}>{catInfo.nome}</div>
                  <div style={{fontSize:'.7rem',color:C.t2}}>Categoria selecionada</div>
                </div>
              </div>
              <details style={{marginTop:'.35rem'}}>
                <summary style={{fontSize:'.72rem',color:C.t3,cursor:'pointer',userSelect:'none',padding:'.25rem 0'}}>
                  Trocar categoria ▾
                </summary>
                <div style={{display:'flex',flexWrap:'wrap',gap:'.4rem',marginTop:'.5rem'}}>
                  {allCats.map(c=><button key={c.id} onClick={()=>setCatId(c.id)} style={pill(catId===c.id)}><span>{c.icone}</span>{c.nome}</button>)}
                </div>
              </details>
            </div>
          ) : (
            <div style={{display:'flex',flexWrap:'wrap',gap:'.4rem'}}>
              {allCats.map(c=><button key={c.id} onClick={()=>setCatId(c.id)} style={pill(catId===c.id)}><span>{c.icone}</span>{c.nome}</button>)}
            </div>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'.9rem',background:C.bg3,border:`1.5px solid ${logo||d?`${C.accent}40`:C.bord}`,borderRadius:11,padding:'.76rem .95rem',marginBottom:'1rem',minHeight:56,transition:'border-color .3s'}}>
          <div style={{width:38,height:38,borderRadius:9,background:C.bg4,border:`1px solid ${C.bord}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden'}}>
            {logo?<img src={logo} alt="" style={{width:25,height:25,objectFit:'contain',borderRadius:3}}/>:<span style={{fontSize:'1.2rem'}}>{catInfo?.icone||'📁'}</span>}
          </div>
          {f.titulo?<div style={{fontWeight:700,color:C.t0,fontSize:'.9rem'}}>{f.titulo}</div>:<div style={{color:C.t2,fontSize:'.8rem'}}>Digite o nome para ver a logo</div>}
        </div>
        <Alerta tipo="err" msg={erro}/>
        <Campo label="Nome do Serviço *"><Txt value={f.titulo} onChange={up('titulo')} placeholder="Ex: Nubank, Gmail, iPhone…" autoComplete="off"/></Campo>
        <Campo label="Login / Usuário"><Txt value={f.login} onChange={up('login')} placeholder="email@exemplo.com ou @usuario"/></Campo>
        <Campo label="Senha Principal *"><Pw value={f.senha} onChange={up('senha')} placeholder="Senha deste serviço" autoComplete="new-password"/></Campo>
        {ehSistema&&catIdx===0&&<>
          <div className="grid2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 .9rem'}}>
            <Campo label="Senha 4 dígitos"><Pw value={f.senha4dig} onChange={up('senha4dig')} placeholder="PIN do cartão" autoComplete="off"/></Campo>
            <Campo label="Senha 6 dígitos"><Pw value={f.senha6dig} onChange={up('senha6dig')} placeholder="Senha do banco" autoComplete="off"/></Campo>
          </div>
          <Campo label="Número do Cartão"><Txt value={f.numeroCartao} onChange={up('numeroCartao')} placeholder="0000 0000 0000 0000" maxLength={19}/></Campo>
          <Campo label="Banco / URL"><Txt value={f.urlOuBanco} onChange={up('urlOuBanco')} placeholder="Ex: app.nubank.com.br"/></Campo>
        </>}
        {ehSistema&&catIdx===1&&<Campo label="URL do Site / App"><Txt value={f.urlOuBanco} onChange={up('urlOuBanco')} placeholder="Ex: facebook.com"/></Campo>}
        {ehSistema&&catIdx===2&&<>
          <Campo label="PIN de Desbloqueio"><Pw value={f.pinDispositivo} onChange={up('pinDispositivo')} placeholder="Código de desbloqueio" autoComplete="off"/></Campo>
          <Campo label="Conta Vinculada (Apple ID / Google)"><Txt value={f.contaVinculada} onChange={up('contaVinculada')} placeholder="email@icloud.com"/></Campo>
        </>}
        <Campo label="Notas"><textarea value={f.notas} onChange={up('notas')} placeholder="Informações adicionais…"
            style={{...txtStyle,minHeight:66,resize:'vertical'}} onFocus={e=>{e.target.style.borderColor=C.accent;}} onBlur={e=>{e.target.style.borderColor=C.bord;}}/></Campo>
        <div style={{borderTop:`1px solid ${C.bord}`,paddingTop:'1rem',marginTop:'.5rem'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'.7rem'}}>
            <p style={{fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:C.t2}}>Campos adicionais</p>
            <button onClick={addExtra} style={{display:'flex',alignItems:'center',gap:4,background:'transparent',border:`1px solid ${C.bord}`,borderRadius:8,padding:'.28rem .7rem',cursor:'pointer',color:C.t1,fontFamily:'inherit',fontSize:'.76rem',fontWeight:600,transition:'all .15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.bord;e.currentTarget.style.color=C.t1;}}>＋ Adicionar campo</button>
          </div>
          {extras.length===0&&<p style={{fontSize:'.76rem',color:C.t3,textAlign:'center',padding:'.5rem 0'}}>Campos personalizados: senhas extras, descrições, tokens…</p>}
          {extras.map(e=>(
            <div key={e.id} style={{background:C.bg3,border:`1px solid ${C.bord}`,borderRadius:11,padding:'.85rem',marginBottom:'.65rem'}}>
              <div style={{display:'flex',gap:'.6rem',marginBottom:'.6rem',flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:120}}>
                  <p style={{fontSize:'.65rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',color:C.t3,marginBottom:'.3rem'}}>Nome do campo</p>
                  <Txt value={e.nome} onChange={ev=>updExtra(e.id,'nome',ev.target.value)} placeholder="Ex: Token, Código…"/>
                </div>
                <div style={{width:130}}>
                  <p style={{fontSize:'.65rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',color:C.t3,marginBottom:'.3rem'}}>Tipo</p>
                  <select value={e.tipo} onChange={ev=>updExtra(e.id,'tipo',ev.target.value)}
                          style={{...txtStyle,fontSize:'.82rem',padding:'.65rem .75rem'}} onFocus={ev=>{ev.target.style.borderColor=C.accent;}} onBlur={ev=>{ev.target.style.borderColor=C.bord;}}>
                    {TIPOS_CAMPO.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
                <button onClick={()=>delExtra(e.id)} style={{background:`${C.red}18`,border:`1px solid ${C.red}35`,borderRadius:8,cursor:'pointer',color:C.red,width:34,height:34,alignSelf:'flex-end',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.85rem'}}>✕</button>
              </div>
              <div>
                <p style={{fontSize:'.65rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',color:C.t3,marginBottom:'.3rem'}}>Valor</p>
                {e.tipo==='senha'?<Pw value={e.valor} onChange={ev=>updExtra(e.id,'valor',ev.target.value)} placeholder="Valor secreto" autoComplete="off"/>
                :e.tipo==='nota'?<textarea value={e.valor} onChange={ev=>updExtra(e.id,'valor',ev.target.value)} placeholder="Texto longo…"
                    style={{...txtStyle,minHeight:56,resize:'vertical'}} onFocus={ev=>{ev.target.style.borderColor=C.accent;}} onBlur={ev=>{ev.target.style.borderColor=C.bord;}}/>
                :<Txt value={e.valor} onChange={ev=>updExtra(e.id,'valor',ev.target.value)} placeholder="Valor" type={e.tipo==='numero'?'number':'text'}/>}
              </div>
            </div>
          ))}
          {extras.length>0&&<div style={{fontSize:'.71rem',color:C.t3,textAlign:'center',marginTop:'.2rem'}}>🔒 Todos os campos são cifrados antes de enviar</div>}
        </div>
      </div>
      <div style={{padding:'.9rem 1.5rem',borderTop:`1px solid ${C.bord}`,display:'flex',gap:'.7rem'}}>
        <button className="bp" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'.9rem',background:`linear-gradient(135deg,${C.accent},${C.accentL}80)`,color:C.bg0,fontFamily:'inherit',fontSize:'.97rem',fontWeight:700,border:'none',borderRadius:12,cursor:'pointer',minHeight:50}} onClick={salvar} disabled={load}>
          {load?<><Spin/> Cifrando…</>:'🔒 Salvar com Segurança'}
        </button>
        <button className="bg" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'auto',minWidth:90,padding:'.78rem 1rem',background:'transparent',color:C.t1,fontFamily:'inherit',fontSize:'.88rem',fontWeight:600,border:`1.5px solid ${C.bord}`,borderRadius:12,cursor:'pointer'}} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  </div>;
}

// ── Modal: Ver credencial ────────────────────────────────────
function ModalVer({cred,cats,onClose,onEditar,onDeletar}){
  const {tema:C}=useT();
  const [rev,setRev]=useState(false);const [cp,setCp]=useState(null);
  const copiar=(v,k)=>{navigator.clipboard.writeText(v);setCp(k);setTimeout(()=>setCp(null),1700);};
  const catInfo=cats.find(c=>c.id===cred.categoriaId)||{icone:'📁'};
  const campos=[
    {k:'login',l:'Login',v:cred.login,s:false},{k:'senha',l:'Senha',v:cred.senha,s:true},
    {k:'urlOuBanco',l:'Banco/URL',v:cred.urlOuBanco,s:false},{k:'senha4dig',l:'Senha 4 dígitos',v:cred.senha4dig,s:true},
    {k:'senha6dig',l:'Senha 6 dígitos',v:cred.senha6dig,s:true},{k:'numeroCartao',l:'Número do Cartão',v:cred.numeroCartao,s:true},
    {k:'pinDispositivo',l:'PIN Dispositivo',v:cred.pinDispositivo,s:true},{k:'contaVinculada',l:'Conta Vinculada',v:cred.contaVinculada,s:false},
    {k:'notas',l:'Notas',v:cred.notas,s:false},
  ].filter(c=>c.v);
  const fRow=(k,l,v,s)=><div key={k} style={{marginBottom:'.76rem'}}>
    <div style={{fontSize:'.67rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:C.t2,marginBottom:'.25rem'}}>{l}</div>
    <div style={{display:'flex',alignItems:'center',gap:7,background:C.bg3,border:`1px solid ${C.bord}`,borderRadius:10,padding:'.65rem .9rem'}}>
      <span style={{flex:1,fontSize:'.88rem',color:C.t0,wordBreak:'break-all',fontFamily:s?"'JetBrains Mono','Courier New',monospace":'inherit'}}>{s&&!rev?'••••••••':v}</span>
      <button className="da" style={{background:'none',border:'none',cursor:'pointer',color:C.t2,fontSize:'.88rem',padding:'.1rem',flexShrink:0,lineHeight:1}} onClick={()=>copiar(v,k)}>{cp===k?'✅':'📋'}</button>
      {s&&<button className="da" style={{background:'none',border:'none',cursor:'pointer',color:C.t2,fontSize:'.88rem',padding:'.1rem',flexShrink:0,lineHeight:1}} onClick={()=>setRev(v=>!v)}>{rev?'🙈':'👁️'}</button>}
    </div>
  </div>;
  const bd={position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.78)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.3rem',backdropFilter:'blur(6px)'};
  const md={background:C.bg2,border:`1px solid ${C.bordH}`,borderRadius:20,width:'100%',maxWidth:520,maxHeight:'92vh',overflowY:'auto',boxShadow:C.cardShadow};
  return <div style={bd} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={md}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1.2rem 1.5rem .9rem',borderBottom:`1px solid ${C.bord}`}}>
        <div style={{display:'flex',alignItems:'center',gap:'.7rem'}}><SvcLogo titulo={cred.titulo} catIcon={catInfo.icone} size={30}/><span style={{fontSize:'.98rem',fontWeight:700,color:C.t0}}>{cred.titulo||'—'}</span></div>
        <button className="mc" style={{width:30,height:30,background:C.bg3,border:`1px solid ${C.bord}`,borderRadius:8,cursor:'pointer',color:C.t2,fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>✕</button>
      </div>
      <div style={{padding:'1.2rem 1.5rem'}}>
        <button className="rb" onClick={()=>setRev(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,background:C.bg3,border:`1.5px solid ${C.bord}`,color:C.t1,borderRadius:10,padding:'.44rem .88rem',fontSize:'.8rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginBottom:'1rem'}}>
          {rev?'🙈 Ocultar senhas':'👁️ Mostrar todas as senhas'}
        </button>
        {campos.map(f=>fRow(f.k,f.l,f.v,f.s))}
        {cred.camposExtras?.length>0&&<>
          <div style={{borderTop:`1px solid ${C.bord}`,paddingTop:'.85rem',marginTop:'.5rem',marginBottom:'.7rem'}}><p style={{fontSize:'.67rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:C.t2}}>Campos adicionais</p></div>
          {cred.camposExtras.map((e,i)=>fRow(`ex${i}`,e.nome,e.valor,e.tipo==='senha'))}
        </>}
        {!campos.length&&!cred.camposExtras?.length&&<p style={{color:C.t2,fontSize:'.84rem'}}>Nenhum campo salvo.</p>}
      </div>
      <div style={{padding:'.88rem 1.5rem',borderTop:`1px solid ${C.bord}`,display:'flex',gap:'.65rem'}}>
        <button className="bg" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,flex:1,padding:'.58rem',background:'transparent',color:C.t1,fontFamily:'inherit',fontSize:'.85rem',fontWeight:600,border:`1.5px solid ${C.bord}`,borderRadius:11,cursor:'pointer'}} onClick={onEditar}>✏️ Editar</button>
        <button style={{display:'flex',alignItems:'center',justifyContent:'center',flex:1,padding:'.58rem',background:`${C.red}18`,color:C.red,fontFamily:'inherit',fontSize:'.85rem',fontWeight:600,border:`1.5px solid ${C.red}35`,borderRadius:11,cursor:'pointer'}} onClick={onDeletar}>🗑️ Excluir</button>
        <button className="bg" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'auto',minWidth:78,padding:'.58rem .9rem',background:'transparent',color:C.t1,fontFamily:'inherit',fontSize:'.85rem',fontWeight:600,border:`1.5px solid ${C.bord}`,borderRadius:11,cursor:'pointer'}} onClick={onClose}>Fechar</button>
      </div>
    </div>
  </div>;
}

// ── Perfil com seletor de tema ───────────────────────────────
function Perfil({onVoltar,token,chaveAES,showToast}){
  const {tema:C,temaKey,aplicarTema}=useT();
  const [fp,setFp]=useState({nome:'',sob:''});
  const [emailDec,setEmailDec]=useState('');
  const [msg,setMsg]=useState({t:'',m:''});
  const [load,setLoad]=useState(false);
  useEffect(()=>{
    fetch(`${API}/usuario/perfil`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(async d=>{
      setFp({nome:d.nome,sob:d.sobrenome});
      if(d.email_enc){try{setEmailDec(await descriptografar(d.email_enc,chaveAES));}catch{}}
    });
  },[token,chaveAES]);
  async function salvar(){
    if(!fp.nome||!fp.sob){setMsg({t:'err',m:'Preencha nome e sobrenome.'});return;}setLoad(true);
    try{await fetch(`${API}/usuario/perfil`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({nome:fp.nome,sobrenome:fp.sob})});
      setMsg({t:'ok',m:'Perfil atualizado!'});showToast('Perfil atualizado! ✅');setTimeout(()=>setMsg({t:'',m:''}),3000);}
    catch(e){setMsg({t:'err',m:e.message});}finally{setLoad(false);}
  }
  const btnP={display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'auto',maxWidth:190,padding:'.9rem',background:`linear-gradient(135deg,${C.accent},${C.accentL}80)`,color:C.bg0,fontFamily:'inherit',fontSize:'.97rem',fontWeight:700,border:'none',borderRadius:12,cursor:'pointer',minHeight:50};
  return <div className="asi">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.2rem'}}>
      <span style={{fontSize:'1.05rem',fontWeight:700,color:C.t0}}>Meu Perfil</span>
      <button className="bg" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'auto',padding:'.44rem .88rem',background:'transparent',color:C.t1,fontFamily:'inherit',fontSize:'.82rem',fontWeight:600,border:`1.5px solid ${C.bord}`,borderRadius:12,cursor:'pointer'}} onClick={onVoltar}>← Voltar</button>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:'1.2rem',background:C.bg2,border:`1px solid ${C.bord}`,borderRadius:16,padding:'1.2rem 1.4rem',marginBottom:'1.2rem'}}>
      <div style={{width:52,height:52,borderRadius:'50%',background:`linear-gradient(135deg,${C.accent},${C.accentL})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.3rem',fontWeight:700,color:C.bg0,flexShrink:0,boxShadow:`0 0 14px ${C.accentG}`}}>{fp.nome?.[0]?.toUpperCase()||'?'}</div>
      <div>
        <div style={{fontSize:'1.1rem',fontWeight:700,color:C.t0}}>{fp.nome} {fp.sob}</div>
        {emailDec?<div style={{color:C.t2,fontSize:'.82rem',marginTop:'.18rem'}}>✉️ {emailDec} <span style={{color:C.teal,fontSize:'.7rem',marginLeft:4}}>🔒 cifrado</span></div>
                 :<div style={{color:C.t3,fontSize:'.78rem',marginTop:'.18rem'}}>✉️ E-mail cifrado</div>}
      </div>
    </div>
    <div style={{background:C.bg2,border:`1px solid ${C.bord}`,borderRadius:16,padding:'1.5rem',marginBottom:'1.2rem'}}>
      <p style={{fontSize:'.82rem',color:C.t2,marginBottom:'1rem'}}>Editar dados pessoais</p>
      <Alerta tipo={msg.t} msg={msg.m}/>
      <div className="grid2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 .9rem'}}>
        <Campo label="Nome"><Txt value={fp.nome} onChange={e=>setFp(p=>({...p,nome:e.target.value}))} placeholder="Nome"/></Campo>
        <Campo label="Sobrenome"><Txt value={fp.sob} onChange={e=>setFp(p=>({...p,sob:e.target.value}))} placeholder="Sobrenome"/></Campo>
      </div>
      <button className="bp" style={btnP} onClick={salvar} disabled={load}>{load?<><Spin/> Salvando…</>:'💾 Salvar'}</button>
    </div>

    {/* Seletor de tema */}
    <div style={{background:C.bg2,border:`1px solid ${C.bord}`,borderRadius:16,padding:'1.5rem'}}>
      <p style={{fontSize:'.88rem',fontWeight:700,color:C.t0,marginBottom:'.25rem'}}>🎨 Aparência</p>
      <p style={{fontSize:'.75rem',color:C.t2,marginBottom:'1.1rem',lineHeight:1.55}}>Escolha o tema ideal para o seu perfil de uso. Salvo automaticamente.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'.7rem'}}>
        {Object.entries(TEMAS).map(([key,t])=>(
          <button key={key} onClick={()=>aplicarTema(key)}
                  style={{padding:'.85rem',background:temaKey===key?`${C.accent}15`:C.bg3,border:`2px solid ${temaKey===key?C.accent:C.bord}`,borderRadius:13,cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'all .2s',position:'relative'}}>
            {temaKey===key&&<span style={{position:'absolute',top:5,right:7,fontSize:'.58rem',fontWeight:700,color:C.accent,background:`${C.accent}20`,borderRadius:99,padding:'.1rem .4rem',letterSpacing:'.03em'}}>ATIVO</span>}
            <div style={{fontSize:'1.4rem',marginBottom:'.3rem'}}>{t.emoji}</div>
            <div style={{fontSize:'.82rem',fontWeight:700,color:C.t0,marginBottom:'.15rem'}}>{t.nome}</div>
            <div style={{fontSize:'.71rem',color:C.t2,lineHeight:1.45,marginBottom:'.2rem'}}>{t.desc}</div>
            <div style={{fontSize:'.67rem',color:C.t3}}>👤 {t.perfil}</div>
          </button>
        ))}
      </div>
    </div>
  </div>;
}


// ══════════════════════════════════════════════════════════
// PAINEL ADMIN — Invisível aos usuários comuns
// Acesso: clique 5x no logo 🔐 do header
// ══════════════════════════════════════════════════════════
function PainelAdmin({onSair}){
  const {tema:C}=useT();
  const [tela,setTela]=useState('login');   // login | dashboard
  const [tokenAdmin,setTokenAdmin]=useState(null);
  const [senha,setSenha]=useState('');
  const [totp,setTotp]=useState('');
  const [erro,setErro]=useState('');
  const [load,setLoad]=useState(false);
  const [busca,setBusca]=useState('');
  const [resultBusca,setResultBusca]=useState(null);
  const [msgAcao,setMsgAcao]=useState('');
  const [usuarios,setUsuarios]=useState([]);
  const [loadUsers,setLoadUsers]=useState(false);
  const [dashboard,setDashboard]=useState(null);

  const h=t=>({Authorization:`Bearer ${t||tokenAdmin}`,'Content-Type':'application/json'});

  async function login(){
    setErro('');setLoad(true);
    try{
      const r=await fetch(`${API}/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({senha,totp})});
      const d=await r.json();
      if(!r.ok){setErro(d.erro||'Erro.');return;}
      setTokenAdmin(d.token);
      // Carrega dashboard
      const dr=await fetch(`${API}/admin/dashboard`,{headers:h(d.token)});
      setDashboard(await dr.json());
      setTela('dashboard');
    }catch(e){setErro(e.message);}finally{setLoad(false);}
  }

  async function buscarUsuario(){
    if(!busca.includes('@')){setErro('Digite um e-mail válido.');return;}
    setLoad(true);setResultBusca(null);setErro('');
    try{
      const r=await fetch(`${API}/admin/buscar-usuario`,{method:'POST',headers:h(),body:JSON.stringify({email:busca.toLowerCase().trim()})});
      const d=await r.json();
      if(!r.ok){setErro(d.erro);return;}
      setResultBusca(d);
    }catch(e){setErro(e.message);}finally{setLoad(false);}
  }

  async function acao(endpoint,body,msg){
    setLoad(true);setMsgAcao('');setErro('');
    try{
      const r=await fetch(`${API}/admin/${endpoint}`,{method:'POST',headers:h(),body:JSON.stringify({...body,email:busca.toLowerCase().trim()})});
      const d=await r.json();
      if(!r.ok){setErro(d.erro);return;}
      setMsgAcao(d.mensagem||msg);
      // Recarrega resultado
      await buscarUsuario();
    }catch(e){setErro(e.message);}finally{setLoad(false);}
  }

  async function carregarUsuarios(){
    setLoadUsers(true);
    try{
      const r=await fetch(`${API}/admin/usuarios`,{headers:h()});
      setUsuarios(await r.json());
    }catch{}finally{setLoadUsers(false);}
  }

  const card={background:C.bg2,border:`1px solid ${C.bord}`,borderRadius:16,padding:'1.5rem',marginBottom:'1rem',boxShadow:C.cardShadow};
  const btnP={display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'.75rem 1.2rem',background:`linear-gradient(135deg,${C.accent},${C.accentL}80)`,color:C.bg0,fontFamily:'inherit',fontSize:'.88rem',fontWeight:700,border:'none',borderRadius:10,cursor:'pointer'};
  const btnG={display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:'.7rem 1rem',background:C.bg3,color:C.t1,fontFamily:'inherit',fontSize:'.85rem',fontWeight:600,border:`1px solid ${C.bord}`,borderRadius:10,cursor:'pointer'};
  const btnR={...btnG,background:`${C.red}18`,color:C.red,borderColor:`${C.red}40`};
  const inpSt={width:'100%',background:C.bg3,border:`1.5px solid ${C.bord}`,borderRadius:10,color:C.t0,fontFamily:'inherit',fontSize:'.9rem',padding:'.72rem .9rem',outline:'none',minHeight:44};

  if(tela==='login') return(
    <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.95)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1.5rem'}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={card}>
          <div style={{textAlign:'center',marginBottom:'1.5rem'}}>
            <div style={{fontSize:'2rem',marginBottom:'.5rem'}}>🛡️</div>
            <h2 style={{fontSize:'1.2rem',fontWeight:800,color:C.t0,marginBottom:'.2rem'}}>Painel Administrativo</h2>
            <p style={{fontSize:'.78rem',color:C.t3}}>Acesso restrito ao CEO</p>
          </div>
          {erro&&<div style={{background:`${C.red}18`,color:C.red,border:`1px solid ${C.red}40`,padding:'.7rem .9rem',borderRadius:9,fontSize:'.83rem',marginBottom:'1rem'}}>⚠️ {erro}</div>}
          <div style={{marginBottom:'.85rem'}}>
            <label style={{display:'block',fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:C.t3,marginBottom:'.3rem'}}>Senha Admin</label>
            <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Senha admin" style={inpSt}
                   onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.bord}/>
          </div>
          <div style={{marginBottom:'1.2rem'}}>
            <label style={{display:'block',fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',color:C.t3,marginBottom:'.3rem'}}>Código TOTP (Google Authenticator)</label>
            <input type="text" value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" maxLength={6}
                   style={{...inpSt,fontFamily:"'JetBrains Mono',monospace",letterSpacing:'0.3em',fontSize:'1.1rem',textAlign:'center'}}
                   onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.bord}/>
          </div>
          <div style={{display:'flex',gap:'.7rem'}}>
            <button onClick={login} disabled={load} style={{...btnP,flex:1}}>{load?'Verificando…':'🔐 Entrar'}</button>
            <button onClick={onSair} style={btnG}>Cancelar</button>
          </div>
          <p style={{fontSize:'.68rem',color:C.t3,textAlign:'center',marginTop:'.9rem',lineHeight:1.5}}>
            TOTP não configurado? Acesse<br/><code style={{color:C.accent,fontSize:'.72rem'}}>localhost:3001/api/admin/totp-setup</code>
          </p>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{position:'fixed',inset:0,zIndex:9999,background:C.bg0,overflowY:'auto'}}>
      {/* Header admin */}
      <header style={{background:C.bg1,borderBottom:`1px solid ${C.bord}`,padding:'0 1.4rem',height:54,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:9,fontWeight:700,color:C.t0}}>
          <span style={{fontSize:'1.2rem'}}>🛡️</span>
          <span style={{fontSize:'.95rem'}}>CofRe Admin</span>
          <span style={{background:`${C.red}20`,color:C.red,fontSize:'.62rem',fontWeight:700,padding:'.15rem .5rem',borderRadius:99,border:`1px solid ${C.red}40`,letterSpacing:'.04em'}}>RESTRITO</span>
        </div>
        <button onClick={onSair} style={{...btnG,padding:'.4rem .85rem',fontSize:'.82rem'}}>✕ Sair</button>
      </header>

      <div style={{maxWidth:900,margin:'0 auto',padding:'1.5rem 1.2rem'}}>
        {/* Métricas rápidas */}
        {dashboard&&<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'.85rem',marginBottom:'.85rem'}}>
            {[
              {l:'💰 Receita Total',v:`R$ ${parseFloat(dashboard.receita_total||0).toFixed(2).replace('.',',')}`,c:C.green},
              {l:'👤 Usuários Ativos',v:dashboard.usuarios_ativos,c:C.accent},
              {l:'📋 Assinaturas Ativas',v:dashboard.assinaturas_ativas,c:C.teal},
            ].map(m=>(
              <div key={m.l} style={{background:C.bg2,border:`1px solid ${C.bord}`,borderRadius:12,padding:'1rem 1.2rem'}}>
                <div style={{fontSize:'.75rem',color:C.t2,marginBottom:'.35rem'}}>{m.l}</div>
                <div style={{fontSize:'1.5rem',fontWeight:800,color:m.c}}>{m.v}</div>
              </div>
            ))}
          </div>
          {/* Por plano */}
          {dashboard.por_plano&&dashboard.por_plano.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'.85rem',marginBottom:'1.5rem'}}>
            {dashboard.por_plano.map(p=>{
              const slugIcon={por_acesso:'🔑',mensal:'📅',anual:'🏆'};
              const slugColor={por_acesso:C.accent,mensal:C.teal,anual:C.green};
              const ic=slugIcon[p.slug]||'📦';
              const cc=slugColor[p.slug]||C.t1;
              return(
                <div key={p.slug} style={{background:C.bg2,border:`1px solid ${C.bord}`,borderRadius:12,padding:'1rem 1.2rem',position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:8,right:10,fontSize:'1.3rem',opacity:.18}}>{ic}</div>
                  <div style={{fontSize:'.72rem',color:C.t2,marginBottom:'.2rem',textTransform:'uppercase',letterSpacing:'.04em'}}>{ic} {p.nome||p.slug}</div>
                  <div style={{fontSize:'1.5rem',fontWeight:800,color:cc}}>{p.total||0}</div>
                  <div style={{fontSize:'.72rem',color:C.t3,marginTop:'.2rem'}}>assinatura{(p.total!==1)?'s':''} ativa{(p.total!==1)?'s':''}</div>
                </div>
              );
            })}
          </div>}
        </>}

        {/* SUPORTE A USUÁRIO — Seção principal */}
        <div style={card}>
          <h3 style={{fontSize:'.95rem',fontWeight:700,color:C.t0,marginBottom:'.3rem'}}>🔍 Suporte a Usuário</h3>
          <p style={{fontSize:'.75rem',color:C.t2,marginBottom:'1rem',lineHeight:1.5}}>
            Busque pelo e-mail do usuário para ver status, histórico e tomar ações de suporte.
          </p>
          <div style={{display:'flex',gap:'.7rem',marginBottom:'1rem'}}>
            <input type="email" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="email@dominio.com"
                   style={{...inpSt,flex:1}} onKeyDown={e=>e.key==='Enter'&&buscarUsuario()}
                   onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.bord}/>
            <button onClick={buscarUsuario} disabled={load} style={btnP}>{load?<Spin/>:'🔍 Buscar'}</button>
          </div>

          {erro&&<div style={{background:`${C.red}18`,color:C.red,border:`1px solid ${C.red}40`,padding:'.7rem .9rem',borderRadius:9,fontSize:'.83rem',marginBottom:'.8rem'}}>⚠️ {erro}</div>}
          {msgAcao&&<div style={{background:`${C.green}15`,color:C.green,border:`1px solid ${C.green}40`,padding:'.7rem .9rem',borderRadius:9,fontSize:'.83rem',marginBottom:'.8rem'}}>✅ {msgAcao}</div>}

          {resultBusca&&(
            <div>
              {/* Info do usuário */}
              <div style={{background:C.bg3,border:`1px solid ${C.bord}`,borderRadius:12,padding:'1rem',marginBottom:'1rem'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:'.8rem'}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg,${C.accent},${C.accentL})`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:C.bg0,fontSize:'1rem'}}>{resultBusca.usuario.nome?.[0]?.toUpperCase()}</div>
                  <div>
                    <div style={{fontWeight:700,color:C.t0,fontSize:'.95rem'}}>{resultBusca.usuario.nome} {resultBusca.usuario.sobrenome}</div>
                    <div style={{fontSize:'.75rem',color:C.t2}}>Cadastro: {new Date(resultBusca.usuario.criado_em).toLocaleString('pt-BR')}</div>
                  </div>
                  <div style={{marginLeft:'auto',background:resultBusca.usuario.ativo?`${C.green}20`:`${C.red}20`,color:resultBusca.usuario.ativo?C.green:C.red,fontSize:'.72rem',fontWeight:700,padding:'.2rem .6rem',borderRadius:99,border:`1px solid ${resultBusca.usuario.ativo?C.green:C.red}40`}}>
                    {resultBusca.usuario.ativo?'✅ Ativo':'🚫 Inativo'}
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.5rem',fontSize:'.78rem',color:C.t2}}>
                  <div>1º acesso gratuito: <strong style={{color:resultBusca.usuario.primeiro_acesso_usado?C.t1:C.green}}>{resultBusca.usuario.primeiro_acesso_usado?'Já usado':'Disponível'}</strong></div>
                  <div>Assinatura: <strong style={{color:resultBusca.usuario.assinatura?C.teal:C.t3}}>{resultBusca.usuario.assinatura?`${resultBusca.usuario.assinatura.plano} até ${new Date(resultBusca.usuario.assinatura.expira_em).toLocaleDateString('pt-BR')}`:'Sem plano ativo'}</strong></div>
                </div>
              </div>

              {/* Aviso Zero-Knowledge */}
              <div style={{background:`${C.accent}10`,border:`1px solid ${C.accent}30`,borderRadius:10,padding:'.75rem 1rem',marginBottom:'1rem',fontSize:'.76rem',color:C.t1,lineHeight:1.6}}>
                🔐 <strong>Zero-Knowledge:</strong> Os dados cifrados deste usuário são <strong>irrecuperáveis sem a senha mestra original</strong>. Você pode liberar o acesso para o usuário tentar fazer login com a senha mestra que ele lembra.
              </div>

              {/* Ações de suporte */}
              <div style={{display:'flex',flexWrap:'wrap',gap:'.6rem',marginBottom:'1rem'}}>
                <button onClick={()=>acao('liberar-acesso',{motivo:'suporte CEO'},'Acesso liberado!')} disabled={load} style={btnP}>
                  🔓 Liberar Acesso Gratuito
                </button>
                <button onClick={()=>acao('conceder-assinatura',{plano:'mensal',motivo:'suporte CEO'},'Plano mensal concedido!')} disabled={load} style={btnG}>
                  🌙 Conceder 30 dias
                </button>
                <button onClick={()=>acao('conceder-assinatura',{plano:'anual',motivo:'suporte CEO'},'Plano anual concedido!')} disabled={load} style={btnG}>
                  🏆 Conceder 1 ano
                </button>
                {resultBusca.usuario.ativo
                  ?<button onClick={()=>{const m=prompt('Motivo da desativação:');if(m)acao('desativar-usuario',{motivo:m},'Usuário desativado.');}} disabled={load} style={btnR}>🚫 Desativar Conta</button>
                  :<button onClick={()=>acao('reativar-usuario',{},'Usuário reativado!')} disabled={load} style={btnP}>✅ Reativar Conta</button>
                }
              </div>

              {/* Histórico de acessos */}
              {resultBusca.ultimos_acessos?.length>0&&(
                <details style={{marginBottom:'.7rem'}}>
                  <summary style={{fontSize:'.78rem',fontWeight:700,color:C.t1,cursor:'pointer',padding:'.4rem 0'}}>📊 Histórico de acessos ({resultBusca.ultimos_acessos.length})</summary>
                  <div style={{marginTop:'.5rem',maxHeight:200,overflowY:'auto'}}>
                    {resultBusca.ultimos_acessos.map((l,i)=>(
                      <div key={i} style={{display:'flex',gap:10,padding:'.4rem .5rem',borderRadius:7,background:i%2===0?C.bg3:'transparent',fontSize:'.73rem',color:C.t2,alignItems:'center'}}>
                        <span>{l.sucesso?'✅':'❌'}</span>
                        <span style={{color:C.t1}}>{new Date(l.criado_em).toLocaleString('pt-BR')}</span>
                        <span>{l.ip_origem}</span>
                        <span style={{color:C.t3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{l.user_agent?.split(' ').slice(-2).join(' ')}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Lista de usuários */}
        <div style={card}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
            <h3 style={{fontSize:'.95rem',fontWeight:700,color:C.t0}}>👥 Todos os Usuários</h3>
            <button onClick={carregarUsuarios} disabled={loadUsers} style={btnG}>{loadUsers?<Spin/>:'🔄 Carregar'}</button>
          </div>
          {usuarios.length>0&&(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.78rem',color:C.t1}}>
                <thead><tr style={{borderBottom:`1px solid ${C.bord}`}}>
                  {['Nome','Cadastro','Plano','Vence em','Status'].map(h=><th key={h} style={{textAlign:'left',padding:'.5rem .7rem',color:C.t3,fontWeight:700,fontSize:'.68rem',textTransform:'uppercase'}}>{h}</th>)}
                </tr></thead>
                <tbody>{usuarios.map((u,i)=>(
                  <tr key={u.id} style={{borderBottom:`1px solid ${C.bord}60`,background:i%2===0?C.bg3:'transparent'}}>
                    <td style={{padding:'.5rem .7rem',fontWeight:600,color:C.t0}}>{u.nome} {u.sobrenome}</td>
                    <td style={{padding:'.5rem .7rem'}}>{new Date(u.criado_em).toLocaleDateString('pt-BR')}</td>
                    <td style={{padding:'.5rem .7rem',color:u.plano_nome?C.teal:C.t3}}>{u.plano_nome||'Sem plano'}</td>
                    <td style={{padding:'.5rem .7rem'}}>{u.expira_em?new Date(u.expira_em).toLocaleDateString('pt-BR'):'—'}</td>
                    <td style={{padding:'.5rem .7rem'}}><span style={{background:u.ativo?`${C.green}20`:`${C.red}20`,color:u.ativo?C.green:C.red,padding:'.1rem .45rem',borderRadius:99,fontSize:'.68rem',fontWeight:700}}>{u.ativo?'Ativo':'Inativo'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {usuarios.length===0&&<p style={{color:C.t3,fontSize:'.82rem',textAlign:'center',padding:'1rem'}}>Clique em "Carregar" para ver os usuários</p>}
        </div>

        {/* Aviso sobre recuperação de senha */}
        <div style={{background:`${C.red}10`,border:`1px solid ${C.red}30`,borderRadius:12,padding:'1.1rem 1.2rem',marginBottom:'1rem'}}>
          <p style={{fontSize:'.82rem',fontWeight:700,color:C.red,marginBottom:'.4rem'}}>⚠️ Sobre recuperação de senha mestra</p>
          <p style={{fontSize:'.76rem',color:C.t1,lineHeight:1.65}}>
            O CofRe usa <strong>criptografia Zero-Knowledge</strong>: a senha mestra nunca é enviada ao servidor. Se o usuário esquecer a senha mestra, os dados cifrados <strong>não podem ser recuperados por ninguém</strong> — nem pelo CEO, nem pela equipe técnica. O que você pode fazer:<br/>
            <span style={{display:'block',marginTop:'.4rem'}}>
              ✅ Liberar o acesso (botão acima) para o usuário tentar fazer login<br/>
              ✅ Conceder dias de assinatura como cortesia<br/>
              ✅ Orientar o usuário a tentar senhas que ele costuma usar<br/>
              ❌ Recuperar os dados cifrados (impossível por design)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ROUTER
// ══════════════════════════════════════════════════════════
function Router(){
  const {token}=useAuth();
  const [t,setT]=useState('landing');
  const [showAdminLogin,setShowAdminLogin]=useState(false);

  // Acesso admin via hash #admin na URL (invisível para usuários comuns)
  useEffect(()=>{
    if(window.location.hash==='#admin'){
      window.location.hash='';
      setShowAdminLogin(true);
    }
  },[]);

  if(showAdminLogin) return <PainelAdmin onSair={()=>setShowAdminLogin(false)}/>;
  if(token) return <TelaCofre/>;
  if(t==='login')    return <TelaLogin    onCadastro={()=>setT('cadastro')} onVoltar={()=>setT('landing')}/>;
  if(t==='cadastro') return <TelaCadastro onLogin={()=>setT('login')}       onVoltar={()=>setT('landing')}/>;
  return <TelaLanding onLogin={()=>setT('login')} onCadastro={()=>setT('cadastro')}/>;
}

export default function App(){
  return (
    <TemaProvider>
      <AuthProvider>
        <GlobalStylesComTema/>
        <Router/>
      </AuthProvider>
    </TemaProvider>
  );
}
