import { type RouteHandler, HttpMethod, HttpStatus, ApiRoute } from '../types.js';
import { DatasetSubResource } from '../../types/dataset.types.js';

const DATASET_DETAIL_PATTERN = new RegExp(`^${ApiRoute.DATASETS}/([a-zA-Z0-9_\\-]+)(?:/([a-zA-Z0-9_\\-]+))?$`);

export const handleDatasetRoutes: RouteHandler = async (ctx) => {
  const { req, pathname, urlObj, services, parseJsonBody, parseBufferBody, getAuthContext, sendJson } = ctx;
  const { storage } = services;

  if (pathname === ApiRoute.DATASETS_UPLOAD && req.method === HttpMethod.POST) {
    const auth = await getAuthContext();
    const contentType = req.headers['content-type'] || '';

    let filename = 'dataset.csv';
    let buffer: Buffer;

    if (contentType.includes('application/json')) {
      const body = await parseJsonBody();
      filename = body.filename || 'dataset.csv';
      if (body.contentBase64) {
        buffer = Buffer.from(body.contentBase64, 'base64');
      } else if (body.content) {
        buffer = Buffer.from(body.content, 'utf8');
      } else {
        sendJson(HttpStatus.BAD_REQUEST, { error: 'content or contentBase64 is required' });
        return true;
      }
    } else {
      const queryName = urlObj.searchParams.get('filename');
      filename = queryName || (req.headers['x-filename'] as string) || 'uploaded_data.csv';
      buffer = await parseBufferBody();
    }

    const result = await storage.uploadAndRegisterDataset(auth, {
      originalFilename: filename,
      buffer,
    });

    sendJson(HttpStatus.CREATED, {
      dataset: {
        id: result.dataset.id,
        originalFilename: result.dataset.originalFilename,
        fileSizeBytes: result.dataset.fileSizeBytes,
        format: result.dataset.format,
        rowCount: result.dataset.rowCount,
        columnCount: result.dataset.columnCount,
        schemaFingerprint: result.dataset.schemaFingerprint,
        status: result.dataset.status,
        createdAt: result.dataset.createdAt,
      },
      profile: result.profile,
    });
    return true;
  }

  if (pathname === ApiRoute.DATASETS && req.method === HttpMethod.GET) {
    const auth = await getAuthContext();
    const datasets = await storage.listDatasets(auth);
    sendJson(
      HttpStatus.OK,
      datasets.map(d => ({
        id: d.id,
        originalFilename: d.originalFilename,
        fileSizeBytes: d.fileSizeBytes,
        format: d.format,
        rowCount: d.rowCount,
        columnCount: d.columnCount,
        schemaFingerprint: d.schemaFingerprint,
        status: d.status,
        createdAt: d.createdAt,
      }))
    );
    return true;
  }

  const datasetMatch = pathname.match(DATASET_DETAIL_PATTERN);
  if (datasetMatch && datasetMatch[1]) {
    const datasetId = datasetMatch[1];
    const subResource = datasetMatch[2];
    const auth = await getAuthContext();

    if (!subResource && req.method === HttpMethod.GET) {
      const dataset = await storage.getDataset(auth, datasetId);
      sendJson(HttpStatus.OK, {
        id: dataset.id,
        originalFilename: dataset.originalFilename,
        fileSizeBytes: dataset.fileSizeBytes,
        format: dataset.format,
        rowCount: dataset.rowCount,
        columnCount: dataset.columnCount,
        schemaFingerprint: dataset.schemaFingerprint,
        status: dataset.status,
        createdAt: dataset.createdAt,
      });
      return true;
    }

    if (subResource === DatasetSubResource.PROFILE && req.method === HttpMethod.GET) {
      const profile = await storage.getDatasetProfile(auth, datasetId);
      if (!profile) {
        sendJson(HttpStatus.NOT_FOUND, { error: 'Dataset profile not found' });
        return true;
      }
      sendJson(HttpStatus.OK, profile);
      return true;
    }

    if (subResource === DatasetSubResource.PREVIEW && req.method === HttpMethod.GET) {
      const limit = parseInt(urlObj.searchParams.get('limit') || '50', 10);
      const preview = await storage.previewDataset(auth, datasetId, limit);
      sendJson(HttpStatus.OK, preview);
      return true;
    }

    if (!subResource && req.method === HttpMethod.DELETE) {
      await storage.deleteDataset(auth, datasetId);
      sendJson(HttpStatus.OK, { message: 'Dataset deleted successfully' });
      return true;
    }
  }

  return false;
};
