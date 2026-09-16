# Processamento de imagens — versão 0.5.0

## Entradas aceitas

- JPEG;
- PNG;
- WebP.

Limites: 8 MB por arquivo recebido, até 3 fotografias iniciais, até 3 fotografias de solução e até 40 milhões de pixels decodificados por imagem. GIF, SVG, TIFF, BMP, PDF, conteúdo arbitrário, imagens corrompidas e conteúdo cujo formato real diverge do MIME declarado são rejeitados.

## Cliente

`src/utils/image.ts` realiza otimização de tráfego: valida MIME/tamanho preliminar, decodifica a imagem, limita o maior lado a 1600 px, recria pixels em canvas, gera WebP com qualidade 0,82 e retorna `File` + `ObjectURL` de pré-visualização. Object URLs são revogadas na remoção, substituição ou desmontagem. Essa etapa **não é barreira de segurança**.

## Servidor — processamento autoritativo

`server/services/imageProcessingService.ts` usa `sharp`:

1. verifica tamanho recebido;
2. lê metadados estruturais com limite de pixels;
3. confirma formato real `jpeg|png|webp` e consistência com MIME declarado;
4. rejeita imagem inválida, múltiplas páginas/frames e dimensão excessiva;
5. aplica auto-orientação;
6. redimensiona com `fit: inside` e `withoutEnlargement`;
7. reencoda integralmente em WebP qualidade 82;
8. gera miniatura WebP até 480 px;
9. calcula SHA-256 sobre a imagem principal final.

A implementação não chama métodos de preservação de metadata. A saída é uma nova codificação e não preserva EXIF, GPS, XMP, IPTC, comentários ou nome original.

## Transparência e animação

WebP preserva canal alfa quando presente. A aplicação não amplia imagens pequenas e rejeita entradas multi-frame/multi-page para evitar animações.

## Comprovação automatizada

`tests/fixtures/photo-with-exif-gps.jpg` e `photo-with-exif-gps-xmp.jpg` são fixtures sintéticas, sem fotografias reais de usuários. Os testes verificam orientação, remoção de EXIF/GPS/texto/XMP, ausência de metadata no arquivo resultante, dimensões, proporção, não ampliação, WebP, miniatura e checksum.

A simples existência de função chamada “sanitize” não é usada como evidência: a suíte inspeciona o arquivo resultante com `sharp.metadata()`.
