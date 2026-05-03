-- ============================================================
-- MIGRAÇÃO DO BANCO DE DADOS — CofRe
-- Execute este script no MySQL Workbench ANTES de usar o sistema
-- Ele detecta a versão atual e faz o upgrade automaticamente
-- ============================================================

USE cofre_senhas;

-- ── PASSO 1: Verifica se a tabela está na versão antiga (com CPF) ─────
-- Se a coluna 'cpf' existir, fazemos a migração para email_hash
-- Se já tiver email_hash, pula tudo (banco já está atualizado)

-- Adiciona colunas novas SE não existirem
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS email_hash CHAR(64)     NULL COMMENT 'SHA-256 do email para lookup',
  ADD COLUMN IF NOT EXISTS email_enc  TEXT          NULL COMMENT 'Email cifrado AES-GCM pelo frontend';

-- ── PASSO 2: Se havia CPF e email, faz o SHA-256 do email ──────────────
-- Isso preenche email_hash com SHA-256(email) para usuários antigos
UPDATE usuarios
SET email_hash = SHA2(LOWER(TRIM(email)), 256)
WHERE email_hash IS NULL AND email IS NOT NULL AND email != '';

-- ── PASSO 3: Remove a coluna CPF se ainda existir ──────────────────────
-- (só executa se a coluna existir — o IF NOT EXISTS do MariaDB)
-- Para MySQL padrão, use o bloco abaixo:

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'cofre_senhas'
    AND TABLE_NAME   = 'usuarios'
    AND COLUMN_NAME  = 'cpf'
);

-- Remove cpf se existir (executa via prepared statement)
SET @drop_cpf = IF(@col_exists > 0,
  'ALTER TABLE usuarios DROP COLUMN cpf',
  'SELECT "CPF ja foi removido" AS status'
);
PREPARE stmt FROM @drop_cpf;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remove a coluna "email" antiga (o email agora fica cifrado em email_enc)
-- NÃO vamos remover — mantemos email como fallback para recuperação
-- Apenas garantimos que email_hash está preenchido

-- ── PASSO 4: Torna email_hash NOT NULL e adiciona índice único ─────────
ALTER TABLE usuarios MODIFY COLUMN email_hash CHAR(64) NOT NULL;

-- Adiciona índice único se não existir
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'cofre_senhas'
    AND TABLE_NAME   = 'usuarios'
    AND INDEX_NAME   = 'uq_email_hash'
);
SET @create_idx = IF(@idx_exists = 0,
  'ALTER TABLE usuarios ADD UNIQUE KEY uq_email_hash (email_hash)',
  'SELECT "Indice ja existe" AS status'
);
PREPARE stmt2 FROM @create_idx;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- ── PASSO 5: Garante tabela log_acessos atualizada ─────────────────────
ALTER TABLE log_acessos
  ADD COLUMN IF NOT EXISTS email_hash_tentado CHAR(64) NULL;

-- ── RESULTADO ──────────────────────────────────────────────────────────
SELECT
  id,
  CONCAT(nome, ' ', sobrenome) AS nome_completo,
  email,
  IF(email_hash IS NOT NULL, CONCAT(LEFT(email_hash,8),'...') , 'FALTANDO') AS email_hash_preview,
  IF(email_enc  IS NOT NULL, 'SIM', 'NAO (usuario precisa recriar conta)') AS email_enc_ok,
  criado_em
FROM usuarios
ORDER BY criado_em DESC;

SELECT 'Migracao concluida com sucesso!' AS resultado;
