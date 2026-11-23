import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { developerApiRoot, postParams } from './schemas.js';

export async function registerDeveloperOpenApi(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'BLEX Developer API',
        version: '1.0.0',
        description:
          'Manage your own posts from external tools.\n\nStart with the [quickstart](/docs/developer-api/quickstart). Create a token in [Token management](/settings/developer-api) and enter the full value in Authorize. Bearer is added automatically.\n\nSuccessful responses contain data; errors contain error. Reading posts requires posts:read. Creating, editing, publishing, deleting, and uploading images requires posts:write.',
      },
      components: {
        securitySchemes: {
          DeveloperBearerAuth: {
            type: 'http',
            scheme: 'bearer',
            description: 'Enter the full token starting with blex_pat_ from Token management.',
          },
        },
      },
      tags: [{ name: 'Account' }, { name: 'Posts' }, { name: 'Tags and series' }, { name: 'Images' }],
    },
    transform: ({ schema, url }) => ({
      schema: {
        ...schema,
        ...(schema?.params ? { params: postParams } : {}),
        hide: !url.startsWith(`${developerApiRoot}/`) || !schema?.operationId,
      },
      url: url.replace(':postId', ':post_id'),
    }),
    transformObject: (document) => {
      if (!('openapiObject' in document)) return document.swaggerObject;
      const { openapiObject } = document;
      // The handler accepts an omitted body and supplies an empty object before validation.
      const publish = openapiObject.paths?.[`${developerApiRoot}/posts/{post_id}/publish`]?.post;
      if (publish?.requestBody && !('$ref' in publish.requestBody)) publish.requestBody.required = false;
      return openapiObject;
    },
  });
}
