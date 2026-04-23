
-- ============================================================
-- CORREÇÕES ADICIONAIS AO SCHEMA — Aplique após o schema principal
-- ============================================================

-- Fix 1: Trigger updated_at para tabela usuarios (estava faltando)
drop trigger if exists trg_usuarios_atualizado_em on public.usuarios;
create trigger trg_usuarios_atualizado_em
before update on public.usuarios
for each row
execute function public.set_updated_em();

-- Fix 2: Índice no plano da tabela cobrancas_pix (estava no MySQL, faltou no PG)
create index if not exists idx_cobrancas_pix_plano
  on public.cobrancas_pix (plano);

-- Fix 3: Índice em plano_ativo do historico_sessoes (melhora dashboard admin)
create index if not exists idx_historico_sessoes_plano
  on public.historico_sessoes (plano_ativo);

-- Fix 4: RLS desabilitado nas tabelas (backend acessa via service role)
-- O backend usa a connection string direta com privilégios totais
-- As políticas de segurança são implementadas no próprio código Node.js
-- Se quiser habilitar RLS no futuro, use a service_role key no backend
alter table public.usuarios             disable row level security;
alter table public.credenciais          disable row level security;
alter table public.sessoes              disable row level security;
alter table public.acessos_gratuitos    disable row level security;
alter table public.cobrancas_pix        disable row level security;
alter table public.assinaturas          disable row level security;
alter table public.categorias_credenciais disable row level security;
alter table public.log_acessos          disable row level security;
alter table public.historico_sessoes    disable row level security;
alter table public.preferencias_usuario disable row level security;
alter table public.admin_totp           disable row level security;
alter table public.admin_sessoes        disable row level security;
alter table public.planos               disable row level security;
