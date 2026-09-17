# GUIA OPERACIONAL DE MIGRAÇÃO E SANEAMENTO — VERSÃO 0.8.0

## SISTEMA INSTITUCIONAL DE MANUTENÇÃO DA INFRAESTRUTURA FÍSICA — OLHOS DO CAMPUS

---

## ⚠️ AVISO CRÍTICO DE SEGURANÇA OPERACIONAL

> **IMPORTANTE**:
> 1. **NUNCA** execute comandos de `--apply` diretamente em produção sem backup prévio e homologação.
> 2. **SEMPRE** execute primeiro em modo `--dry-run` e audite a saída JSON gerada.
> 3. A aplicação em produção exige autorização expressa em Gate Operacional específico.

---

## 1. Migração de Equipes e Acolhimento CGAO (`scripts/migrate080.ts`)

### 1.1. Objetivo
* Reconciliar a equipe `team-cgao` (Coordenação Geral de Administração, Orçamento e Finanças).
* Garantir que `team-cgao` possua `schemaVersion: 2`, `active: true`, `isInitialIntakeTeam: true` e `notificationEmail: cgao.bsf@ifes.edu.br`.
* Desmarcar quaisquer outras equipes que porventura estejam com `isInitialIntakeTeam: true`, garantindo o invariante de **exatamente 1 equipe inicial ativa**.
* Preservar os membros existentes da equipe (`memberAdminUserIds`).
* **NÃO** ativar automaticamente usuários com papel Atendente que estejam legados/inativos (a ativação deve ser individual e intencional).

### 1.2. Execução Segura

#### Passo 1: Execução Diagnóstica (Dry-Run)
```powershell
npx tsx scripts/migrate080.ts --dry-run
```
*Gera relatório JSON no stdout sem realizar nenhuma escrita no Firestore.*

#### Passo 2: Aplicação Controlada (Apenas em Gate Autorizado)
```powershell
$env:ALLOW_080_MIGRATION = "CONFIRM_MIGRATION_0_8"
npx tsx scripts/migrate080.ts --apply
```

### 1.3. Idempotência
O script é totalmente idempotente. Reexecuções subsequentes identificam que `team-cgao` já está conforme e nenhuma outra equipe está marcada como inicial, resultando em `teamUpdatesCount: 0`.

---

## 2. Conciliação de Ambientes Artificiais (`scripts/cleanupArtificialLocations.ts`)

### 2.1. Política de Allowlist Estrita
* O script utiliza a constante `ARTIFICIAL_LOCATION_TARGETS`.
* Na versão 0.8.0, `ARTIFICIAL_LOCATION_TARGETS = []` (vazia por padrão).
* **Nenhum ambiente é considerado artificial automaticamente** apenas por ter sido criado após o seed inicial ou por estar fora dos 60 canônicos.
* Qualquer exclusão de ambiente artificial exige adição explícita e justificada à allowlist pelo Administrador.

### 2.2. Execução

#### Passo 1: Execução Diagnóstica (Dry-Run)
```powershell
npx tsx scripts/cleanupArtificialLocations.ts --dry-run
```
*Com allowlist vazia, o relatório confirma `totalTargets: 0, totalActions: 0`.*

#### Passo 2: Aplicação Controlada
```powershell
$env:ALLOW_080_LOCATION_CLEANUP = "CONFIRM_LOCATION_CLEANUP_0_8"
npx tsx scripts/cleanupArtificialLocations.ts --apply
```
