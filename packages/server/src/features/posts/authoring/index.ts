import formBody from '@fastify/formbody';
import { type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { contentUploadLimit } from '../../media/content-media.js';
import { editorBodyLimit } from '../services/editor-form.js';
import { AuthoringOptions } from '../shared.js';
import { registerEditorRoutes } from '../http/editor.js';
import { registerManagementRoutes } from '../http/management.js';
import { registerRevisionsRoutes } from '../http/revisions.js';

export { AuthoringUser, AuthoringOptions, AuthoringPostInput } from '../shared.js';
export { parseAuthoringPostInput } from '../services/post-content.js';
export { PostValidationError, AuthoringSaveResult } from '../services/post-store.js';
export { createAuthorPost, updateAuthorPost, publishAuthorDraft, deleteAuthorPost } from '../services/author-api.js';

export function registerAuthoring(app: FastifyInstance, db: PrismaClient, options: AuthoringOptions): void {
  app.register(async (routes) => {
    await routes.register(formBody);
    await routes.register(multipart, {
      limits: { files: 1, fileSize: contentUploadLimit, fields: 40, fieldSize: editorBodyLimit, parts: 41 },
    });
    routes.removeContentTypeParser('application/json');
    routes.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, doneParse) => {
      try {
        doneParse(null, JSON.parse(body as string));
      } catch {
        doneParse(null, {});
      }
    });
    registerEditorRoutes(routes, db, options);
    registerManagementRoutes(routes, db, options);
    registerRevisionsRoutes(routes, db, options);
  });
}
