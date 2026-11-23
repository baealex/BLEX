import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { systemMessage } from '../src/platform/messages.js';

test('server product messages have English sources and complete Korean translations with matching placeholders', () => {
  const catalog = JSON.parse(
    readFileSync(new URL('../../data/ui-messages.ko.json', import.meta.url), 'utf8'),
  ) as Record<string, string>;
  const variables = (message: string) =>
    [...new Set([...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
  let count = 0;
  const visitDirectory = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visitDirectory(path);
      else if (entry.name.endsWith('.ts')) {
        const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node) => {
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'systemMessage'
          ) {
            const [message, , customId] = node.arguments;
            assert.ok(message && ts.isStringLiteral(message), `${path}: use a literal English source`);
            assert.doesNotMatch(message.text, /[가-힣]/, path);
            const id = customId && ts.isStringLiteral(customId) ? customId.text : `server.${message.text}`;
            assert.ok(catalog[id], `${path}: missing translation for ${id}`);
            assert.deepEqual(
              variables(message.text),
              variables(catalog[id]),
              `${path}: placeholder mismatch for ${id}`,
            );
            count += 1;
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }
  };
  visitDirectory(fileURLToPath(new URL('../../src', import.meta.url)));
  assert.ok(count > 100);
});

test('message interpolation keeps authored values in their original language', () => {
  const values = { value0: '작가', value1: '사용자 제목', value2: 'https://site.test/post' };
  assert.equal(
    systemMessage('[{value0}] published a new post. [{value1}]({value2})', values, undefined, 'en'),
    '[작가] published a new post. [사용자 제목](https://site.test/post)',
  );
});
