# Inspeção do ZIP final — versão 0.7.3

Artefato: `olhos-do-campus-0.7.3.zip`.

## Procedimento

O projeto foi copiado para uma árvore de staging limpa com raiz única `olhos-do-campus-0.7.3/`, excluindo somente artefatos regeneráveis/locais (`node_modules`, `dist`, `work`, `outputs`, `.git`, `.env` real, logs e temporários).

Foi produzida uma primeira geração de verificação, reaberta com `zipfile`, e todos os arquivos foram lidos a partir do próprio ZIP. Após registrar este relatório, o artefato foi regenerado e a mesma inspeção estrutural e de segurança foi repetida sobre o ZIP definitivo entregue ao usuário.

## Resultado da inspeção

- [x] arquivo ZIP reaberto sem erro (`ZipFile.testzip()` sem arquivo corrompido);
- [x] raiz única `olhos-do-campus-0.7.3/` confirmada;
- [x] 364 arquivos-fonte/documentais confirmados;
- [x] `package.json` presente e versão `0.7.3` confirmada;
- [x] `package-lock.json` raiz presente e versão `0.7.3` confirmada;
- [x] `package.json` e `package-lock.json` do Maintenance Worker presentes e versão `0.7.3` confirmada;
- [x] baseline Node preservada como `>=22.22.2 <23`;
- [x] documentos obrigatórios 0.7.3 presentes;
- [x] ausência de `node_modules`, `dist`, `work`, `outputs` e `.git`;
- [x] ausência de `.env` real; somente `.env.example` é permitido;
- [x] JSONs internos parseáveis;
- [x] ausência de padrões fortes compatíveis com API key Resend, webhook secret, chave `sk_`, Google API key ou private key PEM;
- [x] nenhum arquivo temporário de instalação/build incluído;
- [x] código-fonte completo e lockfiles incluídos, sem artefatos compilados.

## Segurança da varredura

A inspeção forte pesquisou no conteúdo do ZIP os formatos:

- `re_` com comprimento compatível com credencial;
- `whsec_` com comprimento compatível com secret;
- `sk_` com comprimento compatível com credencial;
- `AIza...` com comprimento compatível com Google API key;
- cabeçalhos PEM de private key.

Resultado: **zero correspondências fortes**. Nomes de variáveis e placeholders documentais não foram confundidos com credenciais reais.

## SHA-256

A primeira geração usada para validar o procedimento, antes do fechamento deste próprio relatório, apresentou SHA-256 `8c79b74d34f6ab262b8aa83aa1855614e52c39032f6f5eb9e9903be63e69d6b2` e 1.121.596 bytes.

O SHA-256 do **ZIP definitivo** é calculado somente depois que este relatório já está fechado e o artefato é regenerado, pois inserir o hash do próprio ZIP dentro dele alteraria recursivamente o valor. O hash definitivo é registrado na devolutiva de entrega juntamente com a inspeção externa final do arquivo.
