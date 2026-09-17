# Resend — operação da versão 0.7.0

## Estado entregue

O envio real está implementado no backend com outbox Firestore transacional, idempotência, lease, retentativas e webhook. A entrega não criou conta, domínio, chave, webhook ou secrets externos.

## Configuração passo a passo

1. Crie a conta Resend institucional.
2. Cadastre um domínio ou subdomínio efetivamente controlado pelo projeto ou pela instituição responsável.
3. Insira no DNS apenas os registros fornecidos pelo Resend e aguarde a verificação.
4. Se a equipe não puder alterar o DNS de `ifes.edu.br`, use outro domínio/subdomínio autorizado sob seu controle. Não tente spoofing de `ifes.edu.br`.
5. Crie uma API key com o menor escopo disponível para envio.
6. Crie um webhook HTTPS para `https://<api-cloud-run>/api/webhooks/resend`, incluindo os eventos delivered, bounced e complained.
7. Copie o signing secret do webhook.
8. Configure no Cloud Run, por secrets:

```text
RESEND_ENABLED=true
RESEND_API_KEY=<secret>
RESEND_FROM=Olhos do Campus <sistema@dominio-verificado.example>
RESEND_WEBHOOK_SECRET=<signing-secret>
```

9. No painel administrativo, cadastre `notificationEmails` e mantenha `emailNotificationsEnabled=false` até a janela controlada de teste.
10. Na janela de teste, habilite `emailNotificationsEnabled=true`. O sistema exige simultaneamente essa chave e `RESEND_ENABLED=true` até para despachar o teste.
11. Use “Enviar e-mail de teste”. O teste entra na mesma outbox e fica auditável.
12. Confirme o recebimento e o evento delivered no painel; desabilite novamente se o início das notificações reais ainda não foi autorizado.
13. No go-live, habilite definitivamente as notificações reais.

Runtime e aplicação são chaves independentes: o envio real ocorre somente quando `RESEND_ENABLED=true`, o provider está configurado e `emailNotificationsEnabled=true`.

## Privacidade e idempotência

Cada destinatário recebe uma mensagem separada. A outbox não usa e-mail puro como ID: usa hash determinístico. O conteúdo inclui apenas protocolo, categoria, local resumido, prioridade, risco e data necessários. Não inclui chave de acompanhamento, hashes/salts, descrição livre, fotografias, IP, dump Firestore ou os demais destinatários.

O documento da outbox fornece idempotência local e `Idempotency-Key` fornece proteção adicional no Resend. Claims transacionais com lease impedem processamento concorrente ordinário no Cloud Run. Dados `TEST` não criam notificação real.

## Retentativas e incidentes

- erro transitório: `RETRY_PENDING`, com backoff e limite;
- quota/rate limit: `DEFERRED`, com tentativa posterior e alerta administrativo;
- erro permanente: `FAILED`;
- bounce/suppression/complaint: estado terminal, sem retry automático;
- ausência de configuração: envio adiado com mensagem segura, sem perder o item.

O Administrador pode reprocessar itens elegíveis. Delivered, bounced e complained não são recolocados na fila. A contagem lógica usa destinatários, não requisições HTTP: cinco destinatários correspondem a cinco unidades. Os números do painel são observação interna/referência; a cota e o faturamento vigentes devem ser conferidos no provedor.

## Webhook

O endpoint recebe o corpo bruto antes do parser JSON e valida `svix-id`, `svix-timestamp` e `svix-signature` com o signing secret. Evento inválido é rejeitado; ID de evento repetido é deduplicado. O evento atualiza a entrega pelo ID retornado pelo Resend.

Para rotacionar: crie novo signing secret no provedor, atualize o secret do Cloud Run em janela coordenada, publique nova revisão e envie um teste. Não registre o payload integral nos logs.

## Diagnóstico

No painel, verifique ambiente/aplicação habilitados, remetente, destinatários, pendentes, retries, falhas, delivered, bounced, complained, tentativa mais antiga e último erro sanitizado. Nos logs, use correlation ID/outbox ID; nunca filtre ou publique o endereço completo do destinatário.
