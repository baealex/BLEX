import { developerApiRoot, postExamples, type PostMutationWireInput } from './schemas.js';
import type { DeveloperLocale } from './messages.js';

interface ApiExample {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: PostMutationWireInput;
  file?: string;
}

export const apiExamples = {
  me: { method: 'GET', path: `${developerApiRoot}/me` },
  create: {
    method: 'POST',
    path: `${developerApiRoot}/posts`,
    body: postExamples.create,
  },
  publish: { method: 'POST', path: `${developerApiRoot}/posts/$POST_ID/publish`, body: postExamples.publish },
  update: { method: 'PATCH', path: `${developerApiRoot}/posts/$POST_ID`, body: postExamples.update },
  image: { method: 'POST', path: `${developerApiRoot}/images`, file: './cover.png' },
} satisfies Record<string, ApiExample>;

export function exampleCommand(example: ApiExample, locale: DeveloperLocale = 'ko') {
  const lines = [
    `curl --fail-with-body --silent --show-error${example.method === 'GET' ? '' : ` -X ${example.method}`} "$BLEX_ORIGIN${example.path}"`,
    '  -H "Authorization: Bearer $BLEX_TOKEN"',
    `  -H "Accept-Language: ${locale}"`,
  ];
  if (example.body) {
    lines.push(
      '  -H "Content-Type: application/json"',
      `  --data-raw '${JSON.stringify(example.body, null, 2).replaceAll("'", "'\\''")}'`,
    );
  }
  if (example.file) lines.push(`  -F "image=@${example.file}"`);
  return lines.join(' \\\n');
}
