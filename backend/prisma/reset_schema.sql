-- Zera TODO o schema público do banco. Usado somente como ÚLTIMO recurso
-- quando o db push fica preso em estado inconsistente (ex.: P1014).
-- O seed roda em seguida e recria os dados-base (setores, admin, contratos).
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;