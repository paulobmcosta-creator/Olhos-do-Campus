export interface ArtifactRegistryImageRecord {
  IMAGE?: string;
  image?: string;
  DIGEST?: string;
  digest?: string;
  TAGS?: string | string[];
  tags?: string | string[];
  CREATE_TIME?: string;
  createTime?: string;
  UPDATE_TIME?: string;
  updateTime?: string;
  IMAGE_SIZE_BYTES?: number | string;
  imageSizeBytes?: number | string;
  sizeBytes?: number | string;
  [key: string]: unknown;
}

export interface ParsedArtifactRegistryResult {
  totalBytes: number;
  versionCount: number;
  repository?: string;
}

function extractSizeBytes(record: ArtifactRegistryImageRecord): number | undefined {
  const metadata = record.metadata !== null && typeof record.metadata === 'object' ? (record.metadata as Record<string, unknown>) : undefined;
  const candidate = record.imageSizeBytes ?? record.IMAGE_SIZE_BYTES ?? record.sizeBytes ?? metadata?.imageSizeBytes ?? metadata?.IMAGE_SIZE_BYTES ?? metadata?.sizeBytes;
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
    return candidate;
  }
  if (typeof candidate === 'string' && candidate.trim() !== '') {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return undefined;
}

export function parseArtifactRegistryRecords(
  records: unknown[],
  repositoryName?: string,
): ParsedArtifactRegistryResult {
  if (!Array.isArray(records)) {
    throw new Error('ARTIFACT_REGISTRY_PARSER_ERROR: A entrada de registros do Artifact Registry deve ser um array.');
  }

  if (records.length === 0) {
    return {
      totalBytes: 0,
      versionCount: 0,
      ...(repositoryName !== undefined && repositoryName !== '' ? { repository: repositoryName } : {}),
    };
  }

  let totalBytes = 0;
  let validSizeCount = 0;

  for (let i = 0; i < records.length; i += 1) {
    const item = records[i];
    if (item === null || typeof item !== 'object') {
      throw new Error(`ARTIFACT_REGISTRY_PARSER_ERROR: Registro de imagem na posição ${i} é inválido.`);
    }

    const record = item as ArtifactRegistryImageRecord;
    const size = extractSizeBytes(record);

    if (size !== undefined) {
      totalBytes += size;
      validSizeCount += 1;
    }
  }

  // Defesa: se existem imagens listadas mas nenhuma contém campo de tamanho válido,
  // falhar rápido para evitar persistir bytes = 0 indevidamente.
  if (records.length > 0 && validSizeCount === 0) {
    throw new Error(
      'ARTIFACT_REGISTRY_PARSER_ERROR: Registros de imagem presentes sem campo de tamanho numérico válido. Persistência de bytes = 0 rejeitada.',
    );
  }

  // Se apenas parte dos registros contém tamanho, também rejeitar para não produzir métrica parcial silenciosa
  if (validSizeCount < records.length) {
    throw new Error(
      `ARTIFACT_REGISTRY_PARSER_ERROR: Apenas ${validSizeCount} de ${records.length} imagens possuem tamanho numérico válido. Persistência rejeitada.`,
    );
  }

  return {
    totalBytes,
    versionCount: records.length,
    ...(repositoryName !== undefined && repositoryName !== '' ? { repository: repositoryName } : {}),
  };
}
