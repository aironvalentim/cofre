-- ============================================================
-- CofRe — Schema MySQL v6
-- Execute no MySQL Workbench: Database > Run SQL Script
-- ============================================================
DROP DATABASE IF EXISTS cofre_senhas;
CREATE DATABASE cofre_senhas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cofre_senhas;

-- ── Usuários ─────────────────────────────────────────────────
CREATE TABLE usuarios (
  id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email_hash    CHAR(64)         NOT NULL,
  email_enc     TEXT             NOT NULL,
  nome          VARCHAR(100)     NOT NULL,
  sobrenome     VARCHAR(100)     NOT NULL,
  senha_hash    VARCHAR(255)     NOT NULL,
  kdf_salt      VARCHAR(64)      NOT NULL,
  verifier_iv   VARCHAR(32)      NOT NULL,
  verifier_ct   TEXT             NOT NULL,
  ativo         TINYINT(1)       NOT NULL DEFAULT 1,
  criado_em     DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_email_hash (email_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Controle de primeiro acesso gratuito ─────────────────────
CREATE TABLE acessos_gratuitos (
  email_hash           CHAR(64)   NOT NULL,
  usado_em             DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  primeiro_login_feito TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (email_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Planos disponíveis ────────────────────────────────────────
CREATE TABLE planos (
  id           TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug         VARCHAR(20)      NOT NULL,
  nome         VARCHAR(60)      NOT NULL,
  descricao    VARCHAR(255)     NOT NULL,
  preco        DECIMAL(8,2)     NOT NULL,
  duracao_dias INT              NULL,
  ativo        TINYINT(1)       NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO planos (slug, nome, descricao, preco, duracao_dias) VALUES
  ('por_acesso','Por Acesso',  'R$ 2,00 por sessão. Pague só quando usar. Ideal para uso eventual.',2.00,NULL),
  ('mensal',    'Plano Mensal','R$ 34,90/mês. Acesso ilimitado por 30 dias. Vale a partir de 17 acessos/mês.',34.90,30),
  ('anual',     'Plano Anual', 'R$ 299,00/ano. R$ 24,92/mês — 29% off vs mensal. Melhor custo-benefício.',299.00,366);

-- ── Assinaturas ativas ────────────────────────────────────────
CREATE TABLE assinaturas (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email_hash  CHAR(64)         NOT NULL,
  plano_id    TINYINT UNSIGNED NOT NULL,
  status      ENUM('ATIVA','EXPIRADA','CANCELADA') NOT NULL DEFAULT 'ATIVA',
  inicio_em   DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expira_em   DATETIME(6)      NOT NULL,
  txid_origem VARCHAR(35)      NULL,
  PRIMARY KEY (id),
  KEY idx_assin_email  (email_hash),
  KEY idx_assin_expira (expira_em),
  CONSTRAINT fk_assin_plano FOREIGN KEY (plano_id) REFERENCES planos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Categorias ────────────────────────────────────────────────
CREATE TABLE categorias_credenciais (
  id         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED  NULL,
  nome_enc   TEXT             NOT NULL,
  icone      VARCHAR(10)      NOT NULL DEFAULT '📁',
  eh_sistema TINYINT(1)       NOT NULL DEFAULT 0,
  criado_em  DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_cat_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO categorias_credenciais (usuario_id, nome_enc, icone, eh_sistema) VALUES
  (NULL,'Banco e Cartão','💳',1),
  (NULL,'Redes Sociais e Apps','📱',1),
  (NULL,'Dispositivos','💻',1);

-- ── Credenciais ───────────────────────────────────────────────
CREATE TABLE credenciais (
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  usuario_id          BIGINT UNSIGNED  NOT NULL,
  categoria_id        INT UNSIGNED     NOT NULL,
  titulo_enc          TEXT             NOT NULL,
  login_enc           TEXT             NULL,
  senha_enc           TEXT             NOT NULL,
  url_ou_banco_enc    TEXT             NULL,
  senha_4dig_enc      TEXT             NULL,
  senha_6dig_enc      TEXT             NULL,
  numero_cartao_enc   TEXT             NULL,
  pin_dispositivo_enc TEXT             NULL,
  conta_vinculada_enc TEXT             NULL,
  notas_enc           TEXT             NULL,
  campos_extras_enc   TEXT             NULL,
  favorito            TINYINT(1)       NOT NULL DEFAULT 0,
  criado_em           DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em       DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  excluido_em         DATETIME(6)      NULL,
  PRIMARY KEY (id),
  KEY idx_usuario   (usuario_id),
  KEY idx_categoria (categoria_id),
  CONSTRAINT fk_cred_usuario   FOREIGN KEY (usuario_id)   REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_cred_categoria FOREIGN KEY (categoria_id) REFERENCES categorias_credenciais (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Cobranças Pix ─────────────────────────────────────────────
CREATE TABLE cobrancas_pix (
  id           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  txid         VARCHAR(35)      NOT NULL,
  email_hash   CHAR(64)         NOT NULL,
  valor        DECIMAL(8,2)     NOT NULL,
  plano        VARCHAR(20)      NOT NULL DEFAULT 'por_acesso',
  status       ENUM('ATIVA','CONCLUIDA','EXPIRADA') NOT NULL DEFAULT 'ATIVA',
  qrcode_img   MEDIUMTEXT       NULL,
  copia_cola   TEXT             NULL,
  token_acesso VARCHAR(64)      NULL,
  criado_em    DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  pago_em      DATETIME(6)      NULL,
  expira_em    DATETIME(6)      NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_txid (txid),
  KEY idx_pix_email (email_hash),
  KEY idx_pix_token (token_acesso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Sessões ───────────────────────────────────────────────────
CREATE TABLE sessoes (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(128)    NOT NULL,
  ip_origem  VARCHAR(45)     NULL,
  expira_em  DATETIME(6)     NOT NULL,
  criado_em  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_token (token_hash),
  KEY idx_sessao_usuario (usuario_id),
  CONSTRAINT fk_sessao FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Log de acessos (auditoria completa para o programador) ───
CREATE TABLE log_acessos (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email_hash     CHAR(64)        NULL,
  ip_origem      VARCHAR(45)     NULL,
  user_agent     VARCHAR(500)    NULL,
  sucesso        TINYINT(1)      NOT NULL DEFAULT 0,
  motivo_falha   VARCHAR(100)    NULL,
  plano_na_epoca VARCHAR(20)     NULL,
  criado_em      DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_log_email (email_hash),
  KEY idx_log_data  (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Histórico de sessões (para auditoria do proprietário) ────
CREATE TABLE historico_sessoes (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id   BIGINT UNSIGNED NOT NULL,
  email_hash   CHAR(64)        NOT NULL,
  ip_origem    VARCHAR(45)     NULL,
  user_agent   VARCHAR(500)    NULL,
  plano_ativo  VARCHAR(20)     NULL,
  iniciou_em   DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  encerrou_em  DATETIME(6)     NULL,
  motivo_saida VARCHAR(30)     NULL COMMENT 'logout | inatividade | expirado',
  PRIMARY KEY (id),
  KEY idx_hist_usuario (usuario_id),
  KEY idx_hist_email   (email_hash),
  KEY idx_hist_data    (iniciou_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Preferências do usuário (tema) ───────────────────────────
CREATE TABLE preferencias_usuario (
  email_hash  CHAR(64)    NOT NULL,
  tema        VARCHAR(20) NOT NULL DEFAULT 'escuro',
  definido_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (email_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Admin TOTP ────────────────────────────────────────────────
CREATE TABLE admin_totp (
  id        TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  secret_b32 VARCHAR(255)    NOT NULL,
  ativo     TINYINT(1)       NOT NULL DEFAULT 1,
  criado_em DATETIME(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE admin_sessoes (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash VARCHAR(128)    NOT NULL,
  ip_origem  VARCHAR(45)     NULL,
  expira_em  DATETIME(6)     NOT NULL,
  criado_em  DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SELECT 'Banco CofRe v6 criado com sucesso!' AS status;
