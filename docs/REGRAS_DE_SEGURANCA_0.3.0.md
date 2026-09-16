# Regras de segurança — versão 0.3.0

## 1. Firestore

O acesso administrativo ao Firestore ocorre exclusivamente pelo backend com Firebase Admin SDK. `firestore.rules` adota negação integral por padrão:

```text
allow read, write: if false;
```

Consequências:

- clientes anônimos não leem nem escrevem `adminUsers`;
- clientes Google não leem nem escrevem `adminUsers`;
- nenhum cliente lê ou escreve `auditLogs`;
- autenticação por si só não concede acesso administrativo;
- qualquer coleção futura permanece bloqueada até regra explícita e teste correspondente.

O Admin SDK ignora regras de cliente e, portanto, deve ser protegido por IAM, autenticação, autorização e validações do servidor.

## 2. Storage

`storage.rules` nega leitura, escrita e listagem de qualquer objeto. O Storage não é utilizado na versão 0.3.0.

Sua liberação futura depende de:

- remoção de EXIF e outros metadados;
- validação de MIME real;
- limites de tamanho;
- associação com ocorrência;
- caminho não previsível;
- regras de acesso público e administrativo;
- política de retenção;
- testes unitários e de emulador.

## 3. APIs

- saúde: sem autenticação e sem dados internos;
- configuração pública: App Check;
- ocorrências públicas: App Check + ID Token anônimo;
- APIs administrativas: App Check + ID Token Google + autorização Firestore;
- gestão de usuários/auditoria/configurações: papel Administrador.

## 4. Validação e confiança

- Zod valida corpo, parâmetros e consultas;
- o backend ignora papel e autor enviados pelo cliente;
- operações de Atendente são filtradas por campo;
- o identificador de usuário administrativo é hash do e-mail normalizado;
- o UID é vinculado transacionalmente;
- o último Administrador ativo é protegido em transação.

## 5. Dados não registrados

Não são armazenados em auditoria:

- ID Token;
- App Check Token;
- refresh token;
- senha;
- chave de acompanhamento;
- private key;
- arquivo de service account;
- credenciais integrais.

O sistema não inclui endereço IP no objeto da ocorrência.

## 6. Limitações

As regras de negação por padrão são adequadas ao escopo restrito desta versão, mas não constituem a política final das ocorrências e fotografias. Regras adicionais deverão ser desenhadas quando houver persistência definitiva.

---

## Nota histórica adicionada na versão 0.4.0

Este documento permanece como registro da 0.3.0. A inspeção do ZIP-fonte da 0.4.0 confirmou que `PORT` ainda era fixada em 3000 no servidor e que a validação integral da 0.3.0 continuava bloqueada pela instalação de dependências. A versão 0.4.0 corrige a leitura/validação de `process.env.PORT` e registra separadamente os resultados de validação em `TESTES_0.4.0.md`. As regras server-only e deny-by-default descritas aqui foram preservadas.
