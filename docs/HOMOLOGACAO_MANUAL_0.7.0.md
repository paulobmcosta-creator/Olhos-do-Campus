# Checklist de homologação manual — versão 0.7.0

Preencha ambiente, data, responsável e evidência antes de aprovar produção.

- [ ] Página inicial carrega no Cloudflare Pages
- [ ] Refresh de rota interna funciona
- [ ] Registro público autentica anonimamente
- [ ] App Check válido
- [ ] Ocorrência sem foto funciona
- [ ] Ocorrência com foto envia para R2
- [ ] EXIF não permanece
- [ ] Foto inicial não é pública
- [ ] Foto de solução publicada aparece na consulta correta
- [ ] Consulta exige protocolo + chave
- [ ] Google Sign-In administrativo funciona
- [ ] Gestor continua com permissões corretas
- [ ] Administrador acessa Infraestrutura e capacidade
- [ ] Gestor não acessa Infraestrutura e capacidade
- [ ] Configuração de `notificationEmails` funciona
- [ ] E-mail teste é registrado em outbox
- [ ] Nova ocorrência REAL cria outbox
- [ ] Ocorrência TEST não cria notificação real
- [ ] Resend recebe mensagem
- [ ] Webhook delivered atualiza outbox
- [ ] Webhook inválido é rejeitado
- [ ] Retry não duplica mensagem
- [ ] R2 reconciliation funciona em dry-run
- [ ] Cleanup pendente é exibido
- [ ] Snapshot R2 aparece
- [ ] Snapshot Firestore aparece
- [ ] Histórico de capacidade aparece
- [ ] Referências operacionais são exibidas como referência, não faturamento
- [ ] Artifact Registry sem snapshot mostra “não coletado”
- [ ] Script de Artifact Registry gera snapshot
- [ ] Cleanup policy do Artifact Registry passa por dry-run
- [ ] Cloud Run não serve mais frontend estático
- [ ] CORS bloqueia origem não autorizada
- [ ] Nenhum secret foi incluído no bundle Vite

## Evidências adicionais

- [ ] Origem Pages cadastrada no Firebase Auth e App Check/reCAPTCHA
- [ ] Bucket R2 permanece privado e sem domínio público
- [ ] Fallback Storage tem prazo/responsável para desativação
- [ ] Logs não contêm chave, descrição, e-mail completo ou corpo de webhook
- [ ] Cron de notificações e cron diário foram observados em UTC
- [ ] Plano de rollback e contatos operacionais foram registrados
