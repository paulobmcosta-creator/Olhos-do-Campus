# Processamento de imagens — versão 1.0.0

## Entradas aceitas

- JPEG;
- PNG;
- WebP.

Limites: 8 MB por arquivo recebido, até 3 fotografias iniciais, até 3 fotografias de solução e até 40 milhões de pixels decodificados por imagem. GIF, SVG, TIFF, BMP, PDF, conteúdo arbitrário, imagens corrompidas e conteúdo cujo formato real diverge do MIME declarado são rejeitados.

## Cliente

`src/utils/image.ts` realiza a otimização de tráfego e uma primeira sanitização: valida MIME/tamanho preliminar, decodifica a imagem, limita o maior lado a 1600 px e recria os pixels em `canvas`. A recriação em canvas evita encaminhar o arquivo original e seus metadados ao servidor.

A codificação de saída segue esta ordem de compatibilidade:

1. WebP com qualidade 0,82, quando o navegador consegue codificar canvas em `image/webp`;
2. JPEG com qualidade 0,82 quando WebP não está disponível, incluindo Safari/iOS;
3. PNG como último fallback compatível.

O nome original do arquivo não é preservado. A saída intermediária usa `photo.webp`, `photo.jpg` ou `photo.png`, conforme o formato efetivamente produzido pelo navegador, e retorna também uma `ObjectURL` para pré-visualização. As Object URLs são revogadas na remoção, substituição ou desmontagem.

A etapa no cliente **não é barreira de segurança** e não substitui o processamento autoritativo no servidor.

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

Independentemente de o cliente enviar WebP, JPEG ou PNG sanitizado, o arquivo persistido pelo fluxo normal é novamente processado no servidor e convertido para WebP.

## Transparência e animação

WebP preserva canal alfa quando presente. Em navegadores sem codificação WebP no canvas, o fallback JPEG é priorizado por eficiência para fotografias; PNG permanece disponível como último fallback compatível. A aplicação não amplia imagens pequenas e rejeita entradas multi-frame/multi-page para evitar animações.

## Comprovação automatizada

`tests/fixtures/photo-with-exif-gps.jpg` e `photo-with-exif-gps-xmp.jpg` são fixtures sintéticas, sem fotografias reais de usuários. Os testes do servidor verificam orientação, remoção de EXIF/GPS/texto/XMP, ausência de metadata no arquivo resultante, dimensões, proporção, não ampliação, WebP, miniatura e checksum.

`tests/imageClient.test.ts` verifica também o caminho compatível com Safari/iOS: quando a tentativa de exportar o canvas em WebP devolve outro formato, o cliente tenta JPEG e mantém PNG como fallback final.

A simples existência de função chamada “sanitize” não é usada como evidência: a suíte inspeciona o arquivo resultante com `sharp.metadata()` no processamento autoritativo.
