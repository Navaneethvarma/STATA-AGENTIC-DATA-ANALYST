import { z } from 'zod';
import { getLog, serializeError } from '../../lib/logger.js';
import { renderError } from '../error.js';
import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { DatasetSubResource } from '../../types/dataset.types.js';

const DATASET_DETAIL_PATTERN = new RegExp(`^${ApiRoute.DATASETS}/([a-zA-Z0-9_\\-]+)(?:/([a-zA-Z0-9_\\-]+))?$`);
const datasetUploadSchema = z
  .object({
    filename: z.string().trim().min(1).optional(),
    content: z.string().optional(),
    contentBase64: z.string().min(1).optional(),
  })
  .refine(body => Boolean(body.content || body.contentBase64), {
    message: 'content or contentBase64 is required',
  });
const previewLimitSchema = z.coerce.number().int().min(1).max(1000).default(50);

function toDatasetResponse(dataset: {
  id: string;
  originalFilename: string;
  fileSizeBytes: number;
  format: string;
  rowCount: number;
  columnCount: number;
  schemaFingerprint: string;
  status: string;
  createdAt: string;
}) {
  return {
    id: dataset.id,
    originalFilename: dataset.originalFilename,
    fileSizeBytes: dataset.fileSizeBytes,
    format: dataset.format,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    schemaFingerprint: dataset.schemaFingerprint,
    status: dataset.status,
    createdAt: dataset.createdAt,
  };
}

export const handleDatasetRoutes: RouteHandler = async (ctx) => {
  const log = await getLog('Datasets');
  const { req, pathname, urlObj, services, parseJsonBody, parseBufferBody, getAuthContext, sendJson } = ctx;
  const { storage } = services;

  try {
    if (pathname === ApiRoute.DATASETS_UPLOAD && req.method === HttpMethod.POST) {
      log.info('Uploading a dataset');
      const auth = await getAuthContext();
      const contentType = req.headers['content-type'] || '';

      let filename = 'dataset.csv';
      let buffer: Buffer;

      if (contentType.includes('application/json')) {
        const body = datasetUploadSchema.parse(await parseJsonBody<unknown>());
        filename = body.filename || 'dataset.csv';
        buffer = body.contentBase64
          ? Buffer.from(body.contentBase64, 'base64')
          : Buffer.from(body.content || '', 'utf8');
      } else {
        const queryName = urlObj.searchParams.get('filename');
        const headerFilename = req.headers['x-filename'];
        filename = queryName
          || (typeof headerFilename === 'string' ? headerFilename : undefined)
          || 'uploaded_data.csv';
        buffer = await parseBufferBody();
      }

      const result = await storage.uploadAndRegisterDataset(auth, {
        originalFilename: filename,
        buffer,
      });

      sendJson(HttpStatus.CREATED, {
        dataset: toDatasetResponse(result.dataset),
        profile: result.profile,
      });
      log.info({ status: HttpStatus.CREATED, datasetId: result.dataset.id }, 'Dataset uploaded successfully');
      return true;
    }

    if (pathname === ApiRoute.DATASETS && req.method === HttpMethod.GET) {
      log.info('Listing datasets');
      const auth = await getAuthContext();
      const datasets = await storage.listDatasets(auth);
      sendJson(HttpStatus.OK, datasets.map(toDatasetResponse));
      log.info({ status: HttpStatus.OK, count: datasets.length }, 'Datasets listed successfully');
      return true;
    }

    const datasetMatch = pathname.match(DATASET_DETAIL_PATTERN);
    if (datasetMatch && datasetMatch[1]) {
      const datasetId = datasetMatch[1];
      const subResource = datasetMatch[2];
      const auth = await getAuthContext();

      if (!subResource && req.method === HttpMethod.GET) {
        log.info({ datasetId }, 'Getting dataset details');
        const dataset = await storage.getDataset(auth, datasetId);
        sendJson(HttpStatus.OK, toDatasetResponse(dataset));
        log.info({ status: HttpStatus.OK, datasetId }, 'Dataset details returned successfully');
        return true;
      }

      if (subResource === DatasetSubResource.PROFILE && req.method === HttpMethod.GET) {
        log.info({ datasetId }, 'Getting dataset profile');
        const profile = await storage.getDatasetProfile(auth, datasetId);
        if (!profile) {
          sendJson(HttpStatus.NOT_FOUND, { error: 'Dataset profile not found' });
          return true;
        }
        sendJson(HttpStatus.OK, profile);
        log.info({ status: HttpStatus.OK, datasetId }, 'Dataset profile returned successfully');
        return true;
      }

      if (subResource === DatasetSubResource.PREVIEW && req.method === HttpMethod.GET) {
        log.info({ datasetId }, 'Previewing dataset rows');
        const limit = previewLimitSchema.parse(urlObj.searchParams.get('limit') ?? undefined);
        const preview = await storage.previewDataset(auth, datasetId, limit);
        sendJson(HttpStatus.OK, preview);
        log.info({ status: HttpStatus.OK, datasetId, limit }, 'Dataset preview returned successfully');
        return true;
      }

      if (!subResource && req.method === HttpMethod.DELETE) {
        log.info({ datasetId }, 'Deleting a dataset');
        await storage.deleteDataset(auth, datasetId);
        sendJson(HttpStatus.OK, { message: 'Dataset deleted successfully' });
        log.info({ status: HttpStatus.OK, datasetId }, 'Dataset deleted successfully');
        return true;
      }
    }

    return false;
  } catch (error: unknown) {
    log.error({ error: serializeError(error), method: req.method, path: pathname }, 'Error while handling dataset route');
    renderError(sendJson, error);
    return true;
  }
};
