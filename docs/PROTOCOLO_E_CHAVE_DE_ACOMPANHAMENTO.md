# Protocolo e chave de acompanhamento — versão 0.5.0

## 1. Protocolo

Formato padrão:

```text
INF-2026-000001
```

A função de normalização remove caracteres inadequados e evita duplicar o ano quando um prefixo legado já o contém.

## 2. Contador transacional

O contador anual reside em:

```text
protocolCounters/{year}
```

Exemplo:

```json
{
  "year": 2026,
  "lastSequence": 142,
  "updatedAt": "Timestamp"
}
```

A criação usa uma transação Firestore que lê o contador, calcula a sequência, verifica unicidade, atualiza o contador e cria ocorrência + eventos iniciais. Conflitos entre múltiplas instâncias são tratados pelos retries transacionais do Firestore.

O protocolo já criado é imutável e independe da quantidade de documentos, reinício do processo ou memória local.

## 3. Chave de acompanhamento

Formato gerado:

```text
XXXX-XXXX-XXXX
```

O alfabeto de geração evita caracteres ambíguos e utiliza `crypto.randomInt`, não `Math.random`.

## 4. Derivação criptográfica

A chave é normalizada para maiúsculas e derivada com `scrypt` do Node.js:

- salt aleatório de 16 bytes por ocorrência;
- `N = 16384`;
- `r = 8`;
- `p = 1`;
- saída de 32 bytes.

Persistem somente:

```text
trackingKeyHash
trackingKeySalt
```

Ambos em base64.

A verificação deriva novamente a chave e usa `timingSafeEqual` após validar comprimentos.

## 5. Ciclo de vida da chave original

A chave original:

1. é gerada no serviço de criação;
2. é utilizada para produzir a derivação;
3. é retornada ao comunicante na resposta HTTP de criação;
4. não é colocada no documento Firestore;
5. não é guardada pelo painel administrativo;
6. não é incluída em auditoria/logs;
7. não pode ser recuperada a partir do hash de forma operacional.

## 6. Perda da chave

Não há endpoint de recuperação. Se o comunicante perder a chave, o sistema não consegue revelá-la novamente. Essa propriedade é deliberada para reduzir exposição.

## 7. Acompanhamento sem URL

Endpoint:

```http
POST /api/occurrences/track
Content-Type: application/json

{
  "protocol": "INF-2026-000001",
  "trackingKey": "XXXX-XXXX-XXXX"
}
```

A chave não aparece em path ou query string. O frontend não a grava em `localStorage`/`sessionStorage`. Após a criação, a navegação direta para acompanhamento pode usar apenas estado transitório do React Router, conforme permitido pela arquitetura.

## 8. Enumeração de protocolos

O serviço responde 404 com a mesma mensagem para:

- protocolo inexistente;
- protocolo existente com chave incorreta.

Assim, o endpoint não confirma publicamente a existência do protocolo com base apenas em chave inválida.

## 9. Riscos residuais

A chave ainda é um segredo apresentado ao navegador e pode ser exposta por captura de tela, malware local, compartilhamento indevido ou inspeção do próprio dispositivo. TLS/HTTPS é obrigatório em produção. Não inserir a chave em ferramentas de analytics ou telemetria.
