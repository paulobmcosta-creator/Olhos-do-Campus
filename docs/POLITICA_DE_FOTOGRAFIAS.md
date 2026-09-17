# Política de fotografias — versão 0.7.0

## Finalidade e minimização

Fotografias servem apenas como evidência operacional de problema ou solução de infraestrutura. O registro público não exige identificação pessoal. Oriente o comunicante a evitar rostos, documentos, placas, telas e outros dados pessoais. A reencodificação remove EXIF/XMP, mas não apaga informação visível nos pixels.

## Quantidade e visibilidade

- até 3 fotografias `INITIAL`, internas por padrão;
- até 3 fotografias `RESOLUTION`, internas por padrão;
- Administrador e Gestor podem visualizar e operar fotos conforme o domínio;
- somente foto de solução pode ser tornada pública pela ação administrativa permitida;
- consulta pública ainda exige App Check, autenticação anônima, protocolo e chave;
- nenhum path físico ou credencial é exposto no DTO público.

## Armazenamento

Produção usa Cloudflare R2 privado, somente pela API. Firestore mantém os metadados e é a fonte de verdade lógica. O navegador não recebe URL pública/signed URL permanente e não usa SDK R2.

Firebase Storage não é armazenamento produtivo na 0.7.0. Ele permanece no Emulator Suite e pode atuar como fallback temporário de leitura durante migração explicitamente habilitada. A propriedade pública Firebase `storageBucket`, quando presente, é compatibilidade de Auth/App Check/AI Studio/emulador.

## Processamento e falhas

O servidor valida assinatura, tipo e limites; decodifica e reencoda para WebP, produz thumbnail, calcula metadados e grava no R2 antes de marcar metadata `READY`. Falha de provider não cria metadata pronta sem bytes válidos. Upload parcial é compensado; falha da exclusão cria tarefa persistente de cleanup.

## Exclusão e retenção

Exclusão de foto usa tombstone/cleanup e auditoria. Expurgo definitivo da ocorrência é exclusivo do Administrador e somente para `TEST`. Não há expurgo comum de ocorrência `REAL`.

O sistema não cria política arbitrária de retenção de fotos reais, nem remove fotos por limite de capacidade. Um prazo institucional futuro exige decisão formal, base legal e implementação separada. Reconciliação apply remove apenas objeto verdadeiramente órfão, após inventário completo e janela de segurança.

