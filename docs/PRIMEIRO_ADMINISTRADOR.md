# Primeiro Administrador — versão 0.5.0

## 1. Finalidade

O sistema não promove automaticamente usuários pelo domínio. O primeiro Administrador deve ser previamente autorizado por um operador com acesso técnico ao Firestore ou aos emuladores.

## 2. Pré-requisitos

- dependências instaladas;
- project ID definido;
- `ALLOWED_ADMIN_DOMAINS` configurado;
- emulador ativo ou Application Default Credentials válidas;
- e-mail institucional pertencente a um domínio permitido.

## 3. Dry-run

```bash
npm run firebase:bootstrap-admin -- --email=usuario@example.edu.br --display-name="Nome Institucional" --dry-run
```

No emulador:

```bash
npm run firebase:bootstrap-admin -- --email=usuario@example.edu.br --display-name="Nome Institucional" --emulator --dry-run
```

O dry-run mostra projeto, identificador do documento, e-mail normalizado e ambiente, sem gravar dados.

## 4. Criação

```bash
npm run firebase:bootstrap-admin -- --email=usuario@example.edu.br --display-name="Nome Institucional"
```

No emulador:

```bash
npm run firebase:bootstrap-admin -- --email=usuario@example.edu.br --display-name="Nome Institucional" --emulator
```

O script:

1. normaliza e valida o e-mail;
2. valida o domínio;
3. calcula SHA-256 do e-mail normalizado;
4. verifica existência do documento;
5. cria `adminUsers/{hash}` com papel Administrador e estado ativo;
6. registra auditoria;
7. não imprime tokens ou credenciais.

## 5. Sobrescrita intencional

Se o documento já existir, a execução é interrompida. A opção `--force` deve ser usada somente após revisão:

```bash
npm run firebase:bootstrap-admin -- --email=usuario@example.edu.br --force
```

Ela promove o cadastro existente a Administrador ativo, preservando campos não substituídos pelo merge. Não use como rotina de gestão; após o primeiro acesso, utilize a interface administrativa.

## 6. Primeiro login

A autorização não cria conta Google. A pessoa deve entrar com a conta Google correspondente. No primeiro acesso autorizado, o UID Firebase é vinculado transacionalmente. Tentativa posterior com UID diferente é negada.

## 7. Revogação e continuidade

A revogação deve ser feita pela interface de gestão. O sistema impede inativação ou rebaixamento do último Administrador ativo. Antes de revogar um Administrador, confirme a existência de outro Administrador ativo e funcional.

## 8. Segurança

- não inserir e-mail diretamente no código;
- não criar senha própria;
- não armazenar JSON de service account;
- não usar `--force` sem revisão;
- não compartilhar saída que contenha dados pessoais além do necessário;
- não executar contra project ID desconhecido.

## Banco nomeado

Na 0.5.0 o script usa a mesma resolução de `projectId`/`firestoreDatabaseId` do servidor e imprime o banco de destino antes da operação. Para o projeto provisionado pelo AI Studio, confirme que o banco exibido é `ai-studio-olhosdocampus-63a884f8-f929-40fc-8c6e-326a409c40cf`.
