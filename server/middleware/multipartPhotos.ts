import Busboy from '@fastify/busboy';
import type { Readable } from 'node:stream';
import type { RequestHandler } from 'express';
import { MAX_PHOTO_BYTES } from '../services/imageProcessingService';
import { HttpError } from '../types/errors';

export interface UploadedPhotoBuffer {
  buffer: Buffer;
  declaredMimeType?: string;
}

export function parsePhotoMultipart(maxFiles: number): RequestHandler {
  return (request, _response, next) => {
    const contentType = request.headers['content-type'] ?? '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
      next(new HttpError(415, 'VALIDATION_ERROR', 'Esta operação exige multipart/form-data.'));
      return;
    }

    let busboy: InstanceType<typeof Busboy>;
    try {
      busboy = new Busboy({
        headers: { ...request.headers, 'content-type': contentType },
        limits: {
          fileSize: MAX_PHOTO_BYTES,
          files: maxFiles,
          fields: 1,
          fieldNameSize: 100,
          fieldSize: 32 * 1024,
          parts: maxFiles + 1,
        },
      });
    } catch {
      next(new HttpError(400, 'VALIDATION_ERROR', 'O corpo multipart informado é inválido.'));
      return;
    }

    const files: UploadedPhotoBuffer[] = [];
    let payloadText: string | undefined;
    let terminalError: HttpError | undefined;
    let pendingFiles = 0;
    let parsingFinished = false;
    let completed = false;

    const finish = (): void => {
      if (completed || !parsingFinished || pendingFiles > 0) return;
      completed = true;
      if (terminalError !== undefined) {
        next(terminalError);
        return;
      }
      if (payloadText === undefined) {
        next(new HttpError(400, 'VALIDATION_ERROR', 'O campo multipart "payload" é obrigatório.'));
        return;
      }
      try {
        request.body = JSON.parse(payloadText) as unknown;
      } catch {
        next(new HttpError(400, 'VALIDATION_ERROR', 'O campo multipart "payload" deve conter JSON válido.'));
        return;
      }
      request.photoFiles = files;
      next();
    };

    busboy.on('field', (fieldname: string, value: string, _fieldnameTruncated: boolean, valueTruncated: boolean) => {
      if (fieldname !== 'payload' || payloadText !== undefined) {
        terminalError ??= new HttpError(400, 'VALIDATION_ERROR', 'O multipart contém campos não autorizados.');
        return;
      }
      if (valueTruncated) {
        terminalError ??= new HttpError(413, 'VALIDATION_ERROR', 'Os dados estruturados excedem o limite permitido.');
        return;
      }
      payloadText = value;
    });

    busboy.on('file', (fieldname: string, stream: Readable, _filename: string, _encoding: string, mimetype: string) => {
      pendingFiles += 1;
      const chunks: Buffer[] = [];
      let truncated = false;
      if (fieldname !== 'photos') {
        terminalError ??= new HttpError(400, 'VALIDATION_ERROR', 'Somente o campo de arquivos "photos" é aceito.');
      }
      stream.on('limit', () => {
        truncated = true;
        terminalError ??= new HttpError(413, 'PHOTO_TOO_LARGE', 'Cada fotografia deve ter no máximo 8 MB.');
      });
      stream.on('data', (chunk: Buffer) => {
        if (!truncated && fieldname === 'photos') chunks.push(Buffer.from(chunk));
      });
      stream.on('error', () => {
        terminalError ??= new HttpError(400, 'PHOTO_CORRUPTED', 'Uma fotografia não pôde ser recebida corretamente.');
      });
      stream.on('end', () => {
        if (!truncated && fieldname === 'photos' && terminalError?.code !== 'PHOTO_COUNT_EXCEEDED') {
          files.push({ buffer: Buffer.concat(chunks), ...(mimetype === '' ? {} : { declaredMimeType: mimetype }) });
        }
        pendingFiles -= 1;
        finish();
      });
    });

    busboy.on('filesLimit', () => {
      terminalError ??= new HttpError(400, 'PHOTO_COUNT_EXCEEDED', `É permitido anexar no máximo ${maxFiles} fotografias nesta etapa.`);
    });
    busboy.on('fieldsLimit', () => {
      terminalError ??= new HttpError(400, 'VALIDATION_ERROR', 'O multipart contém campos em excesso.');
    });
    busboy.on('partsLimit', () => {
      terminalError ??= new HttpError(400, 'PHOTO_COUNT_EXCEEDED', `É permitido anexar no máximo ${maxFiles} fotografias nesta etapa.`);
    });
    busboy.on('error', () => {
      terminalError ??= new HttpError(400, 'VALIDATION_ERROR', 'O corpo multipart não pôde ser processado.');
    });
    busboy.on('finish', () => {
      parsingFinished = true;
      finish();
    });

    request.pipe(busboy);
  };
}
