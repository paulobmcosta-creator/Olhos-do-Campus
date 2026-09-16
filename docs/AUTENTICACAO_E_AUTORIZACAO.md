# Autenticação e autorização — versão 0.6.0

## Princípios

A autenticação comprova a identidade técnica Firebase. A autorização administrativa é uma decisão adicional, executada no servidor a partir do Firestore. Estar autenticado, possuir e-mail institucional ou pertencer ao domínio permitido não concede acesso automaticamente.

A arquitetura permanece:

```text
Frontend → Express → App Check → Firebase Auth → autorização → serviço → repositório → Firestore/Storage
```

Firestore e Storage permanecem `deny-all` ao cliente Web.

## Área pública

- Firebase Authentication anônima;
- nenhuma identificação pessoal obrigatória para registrar ocorrência;
- UID não é apresentado na interface pública;
- criação e acompanhamento exigem sessão técnica válida;
- acompanhamento exige protocolo e chave de acompanhamento;
- a chave não é colocada na URL;
- nenhum endereço IP é armazenado no documento da ocorrência.

A expressão institucional correta é **“registro sem identificação pessoal obrigatória”**.

## Área administrativa

- Google Sign-In via Firebase Authentication;
- e-mail verificado;
- domínio administrativo permitido;
- cadastro prévio em `adminUsers`;
- usuário ativo;
- vínculo de UID coerente;
- papel administrativo ativo.

A versão 0.6.0 possui somente:

- `Administrador`;
- `Gestor`.

`Atendente` é reconhecido apenas como valor legado para bloqueio e resolução explícita. Um documento legado não recebe autorização de Gestor nem qualquer promoção automática. Somente Administrador pode decidir entre converter explicitamente para Gestor ou inativar.

## Identificador do cadastro

O documento administrativo permanece localizado por identificador derivado do e-mail normalizado. No primeiro acesso autorizado, o UID Firebase pode ser vinculado transacionalmente conforme a regra existente. UID divergente é rejeitado.

## Perfil confiável

O backend constrói o perfil autorizado com dados validados pelo Firebase e pelo `adminUsers`. Campos enviados pelo navegador não constituem fonte de autorização ou auditoria.

`department` é campo legado e não é utilizado como mecanismo principal de autorização na 0.6.0. A associação operacional passa por `teamIds` e `operationalTeams`.

## Separação de papéis

**Gestor administra ocorrências. Administrador administra o sistema e também ocorrências.**

A matriz detalhada está em `MATRIZ_DE_PERMISSOES_0.6.0.md`. Entre outras restrições, Gestor não gerencia usuários, equipes, catálogo de categorias/locais, SLA/calendário, auditoria global nem expurgo definitivo de `TEST`.

## Respostas de segurança

| Situação | HTTP | Exemplo de código |
|---|---:|---|
| Sem ID Token | 401 | `UNAUTHENTICATED` |
| Token inválido/expirado/revogado | 401 | `INVALID_TOKEN` |
| App Check ausente quando obrigatório | 401 | `APP_CHECK_REQUIRED` |
| App Check inválido | 403 | `APP_CHECK_INVALID` |
| Provedor não permitido | 403 | `PROVIDER_NOT_ALLOWED` |
| E-mail não verificado | 403 | `EMAIL_NOT_VERIFIED` |
| Domínio não permitido | 403 | `DOMAIN_NOT_ALLOWED` |
| Usuário não autorizado | 403 | `ADMIN_NOT_AUTHORIZED` |
| Cadastro inativo | 403 | `ADMIN_INACTIVE` |
| Papel legado aguardando resolução | 403 | `LEGACY_ROLE_REQUIRES_RESOLUTION` |
| Papel insuficiente | 403 | `FORBIDDEN` |
| Conflito de versão | 409 | `VERSION_CONFLICT`/equivalente |

## Auditoria

A autorização e as mutações administrativas relevantes geram eventos de auditoria. Tokens, chaves de acompanhamento e credenciais não são copiados para `auditLogs`. A auditoria global é exclusiva de Administrador; Gestores continuam vendo apenas o histórico funcional permitido de cada ocorrência.
