# Regras de segurança — versão 0.4.0

## 1. Modelo de confiança

O navegador não é fonte confiável para autoria, papel, tempo, `version` atual, identificação administrativa ou campos internos. O backend valida contexto e executa regras de domínio antes de usar Firebase Admin SDK.

## 2. Firestore Rules

Regra efetiva:

```text
allow read, write: if false
```

para todos os documentos acessados por clientes Web.

Isso inclui:

- occurrences;
- events;
- protocolCounters;
- categories;
- locations;
- systemSettings;
- adminUsers;
- auditLogs.

Usuário não autenticado, anônimo ou Google permanece bloqueado no SDK Firestore do navegador. A API Express é o único canal de negócio.

## 3. Storage Rules

Storage permanece integralmente fechado na 0.4.0. Clientes não podem ler, escrever ou listar objetos. A abertura controlada pertence à versão 0.5.0.

## 4. API pública

Criação e acompanhamento exigem:

- App Check;
- Firebase ID Token;
- provedor anônimo;
- validação Zod.

A ocorrência não persiste UID anônimo, IP ou dados de identificação pessoal do comunicante.

## 5. Chave de acompanhamento

- `crypto.randomInt`;
- `scrypt` + salt aleatório;
- `timingSafeEqual`;
- sem texto claro persistido;
- sem URL;
- sem log/auditLog;
- sem recuperação administrativa;
- resposta 404 genérica para combinação incorreta.

## 6. API administrativa

Exige:

- App Check;
- ID Token Google;
- e-mail verificado;
- domínio permitido;
- `adminUsers` ativo;
- UID compatível;
- papel adequado.

Papéis são derivados do servidor, nunca aceitos do body do cliente.

## 7. Concorrência

`expectedVersion` é obrigatório em PATCH. Divergência retorna HTTP 409 e não sobrescreve estado concorrente.

## 8. Integridade de estados

Transições passam por máquina formal. Reabertura de finalizados é restrita a Administrador/Gestor. `resolvedAt` é controlado pelo servidor.

## 9. Duplicidade

O serviço rejeita:

- autorreferência;
- destino inexistente;
- vínculo sem situação Duplicada;
- situação Duplicada sem destino;
- ciclos diretos ou indiretos.

A cadeia é revalidada dentro da transação de atualização.

## 10. Separação público/interno

O DTO público é construído por lista positiva. Eventos `INTERNAL`, atribuição, prioridade administrativa, autoria real e IDs internos não são retornados.

## 11. Auditoria

`auditLogs` permanece separado do histórico da ocorrência. Registros administrativos resumem mudança de situação/atribuição sem copiar descrição integral ou chave.

## 12. Logs

Rotas públicas não registram body. Middlewares de token registram somente mensagem de erro e correlation ID, nunca o token recebido. Não há instrumentação de analytics da chave.

## 13. Segredos

O ZIP não deve conter:

- `.env` real;
- service account;
- private key;
- token real;
- exportação Firestore;
- cache de emulador.

A inspeção final documenta as buscas executadas.
