// ============================================================
// src/services/crypto.js
// Toda a criptografia acontece AQUI, no navegador do usuário.
// O servidor NUNCA recebe ou armazena dados em texto puro.
//
// Fluxo Zero-Knowledge:
//  1. Cadastro: senhaMestra → PBKDF2(salt) → chaveAES
//               chaveAES → AES-GCM(textoPadrao) → verifier salvo no DB
//  2. Login:    senhaMestra + kdfSalt(do servidor) → derivaChave()
//               tentaDeCifrar(verifier) → se OK, chave fica na memória
//  3. Uso:      encrypt(dado, chave) antes de enviar ao servidor
//               decrypt(dado, chave) ao exibir na tela
// ============================================================

const KDF_ITERATIONS = 310_000; // PBKDF2 recomendado pelo NIST (2023)
const KDF_HASH       = 'SHA-256';
const VERIFIER_PLAIN = 'cofre-zero-knowledge-verificador-v1'; // texto fixo

// ── Utilitários de encoding ──────────────────────────────────

export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2)
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

export function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// ── Gera salt aleatório (64 hex chars = 32 bytes) ────────────
export function gerarSalt() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

// ── Importa a senha mestra como material de chave ────────────
async function importarSenhaMestra(senhaMestra) {
  const enc  = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(senhaMestra),
    'PBKDF2',
    false,
    ['deriveKey']
  );
}

// ── Deriva a chave AES-256 a partir da senha mestra + salt ───
export async function derivarChave(senhaMestra, saltHex) {
  const material = await importarSenhaMestra(senhaMestra);
  const salt     = hexToBytes(saltHex);

  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt,
      iterations: KDF_ITERATIONS,
      hash:       KDF_HASH,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,         // não exportável — a chave "morre" com a sessão
    ['encrypt', 'decrypt']
  );
}

// ── Criptografa um texto → JSON { iv, ct } ───────────────────
export async function criptografar(texto, chaveAES) {
  const enc = new TextEncoder();
  const iv  = crypto.getRandomValues(new Uint8Array(12)); // 96 bits para AES-GCM

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    chaveAES,
    enc.encode(texto)
  );

  return JSON.stringify({
    iv: bytesToHex(iv),
    ct: bytesToBase64(new Uint8Array(ciphertext)),
  });
}

// ── Descriptografa JSON { iv, ct } → texto ──────────────────
export async function descriptografar(jsonStr, chaveAES) {
  const { iv, ct } = JSON.parse(jsonStr);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(iv) },
    chaveAES,
    base64ToBytes(ct)
  );

  return new TextDecoder().decode(plaintext);
}

// ── Gera o bloco verificador para cadastro ───────────────────
// Permite que no login o cliente confirme se a senha mestra
// está correta SEM enviar a chave ao servidor.
export async function gerarVerifier(chaveAES) {
  return criptografar(VERIFIER_PLAIN, chaveAES);
}

// ── Valida o verifier retornado pelo servidor no login ───────
// Retorna true se a chave derivada consegue decifrar o verifier.
export async function validarVerifier(verifierJson, chaveAES) {
  try {
    const plaintext = await descriptografar(verifierJson, chaveAES);
    return plaintext === VERIFIER_PLAIN;
  } catch {
    return false; // senha mestra incorreta
  }
}

// ── Criptografa um objeto de credencial inteiro ──────────────
// Recebe { titulo, login, senha, ... } e retorna todos os campos
// criptografados com sufixo "Enc" prontos para enviar ao backend.
export async function criptografarCredencial(dados, chaveAES) {
  const enc = async (val) => val ? criptografar(val, chaveAES) : null;

  return {
    tituloEnc:          await enc(dados.titulo),
    loginEnc:           await enc(dados.login),
    senhaEnc:           await enc(dados.senha),
    urlOuBancoEnc:      await enc(dados.urlOuBanco),
    senha4digEnc:       await enc(dados.senha4dig),
    senha6digEnc:       await enc(dados.senha6dig),
    numeroCartaoEnc:    await enc(dados.numeroCartao),
    pinDispositivoEnc:  await enc(dados.pinDispositivo),
    contaVinculadaEnc:  await enc(dados.contaVinculada),
    notasEnc:           await enc(dados.notas),
  };
}

// ── Descriptografa um objeto de credencial retornado do backend
export async function descriptografarCredencial(row, chaveAES) {
  const dec = async (val) => val ? descriptografar(val, chaveAES) : null;

  return {
    id:             row.id,
    categoriaId:    row.categoria_id,
    categoriaNome:  row.categoria_nome,
    icone:          row.icone,
    favorito:       row.favorito,
    titulo:         await dec(row.titulo_enc),
    login:          await dec(row.login_enc),
    senha:          await dec(row.senha_enc),
    urlOuBanco:     await dec(row.url_ou_banco_enc),
    senha4dig:      await dec(row.senha_4dig_enc),
    senha6dig:      await dec(row.senha_6dig_enc),
    numeroCartao:   await dec(row.numero_cartao_enc),
    pinDispositivo: await dec(row.pin_dispositivo_enc),
    contaVinculada: await dec(row.conta_vinculada_enc),
    notas:          await dec(row.notas_enc),
  };
}
