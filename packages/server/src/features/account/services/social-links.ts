import type { Prisma, PrismaClient } from '@prisma/client';
import { safeExternalUrl } from './profile.js';
import { Body, UpdateResult, positiveId, stringValue } from '../shared.js';

type SocialLink = { id: number; name: string; value: string; order: number };

interface SocialMutation {
  updates: SocialLink[];
  creates: Array<Omit<SocialLink, 'id'>>;
  deletes: number[];
}

function splitLegacyItems(value: string): string[] {
  return value.split('&').filter(Boolean);
}

function socialValueError(): UpdateResult {
  return { ok: false, message: '소셜 링크를 확인해 주세요. HTTPS 주소와 쉼표, 앰퍼샌드가 없는 값을 사용하세요.' };
}

function validateSocialFields(name: string, value: string, orderValue: string): number | null {
  if (!name || name.length > 50 || name.includes(',') || name.includes('&') || value.length > 255 || value.includes(',') || value.includes('&')) return null;
  if (!value.startsWith('https://') || !safeExternalUrl(value)) return null;
  if (!/^-?\d+$/.test(orderValue)) return null;
  const order = Number(orderValue);
  return Number.isSafeInteger(order) && order >= 0 ? order : null;
}

function parseSocialMutation(body: Body, mode: 'legacy' | 'form'): SocialMutation | UpdateResult {
  if (mode === 'form') {
    const intent = stringValue(body.intent);
    const name = stringValue(body.name);
    const value = stringValue(body.value);
    const orderValue = stringValue(body.order);
    if (intent === 'delete') {
      const id = positiveId(body.id);
      return id ? { updates: [], creates: [], deletes: [id] } : socialValueError();
    }
    const order = validateSocialFields(name, value, orderValue);
    if (order === null) return socialValueError();
    if (intent === 'create') return { updates: [], creates: [{ name, value, order }], deletes: [] };
    if (intent === 'update') {
      const id = positiveId(body.id);
      return id ? { updates: [{ id, name, value, order }], creates: [], deletes: [] } : socialValueError();
    }
    return socialValueError();
  }

  const updates: SocialLink[] = [];
  const creates: Array<Omit<SocialLink, 'id'>> = [];
  const deletes: number[] = [];
  for (const item of splitLegacyItems(stringValue(body.update))) {
    const values = item.split(',');
    if (values.length !== 4) return socialValueError();
    const id = positiveId(values[0]);
    const order = validateSocialFields(values[1], values[2], values[3]);
    if (!id || order === null) return socialValueError();
    updates.push({ id, name: values[1], value: values[2], order });
  }
  for (const item of splitLegacyItems(stringValue(body.create))) {
    const values = item.split(',');
    if (values.length !== 3) return socialValueError();
    const order = validateSocialFields(values[0], values[1], values[2]);
    if (order === null) return socialValueError();
    creates.push({ name: values[0], value: values[1], order });
  }
  for (const item of splitLegacyItems(stringValue(body.delete))) {
    const id = positiveId(item);
    if (!id) return socialValueError();
    deletes.push(id);
  }
  return { updates, creates, deletes };
}

export async function applySocialMutation(
  db: PrismaClient,
  userId: number,
  body: Body,
  mode: 'legacy' | 'form',
): Promise<UpdateResult> {
  const mutation = parseSocialMutation(body, mode);
  if ('ok' in mutation) return mutation;
  try {
    await db.$transaction(async (transaction: Prisma.TransactionClient) => {
      for (const link of mutation.updates) {
        const result = await transaction.$executeRaw`
          UPDATE board_userlinkmeta
             SET name = ${link.name}, value = ${link.value}, "order" = ${link.order}
           WHERE id = ${link.id} AND user_id = ${userId}
        `;
        if (Number(result) === 0) {
          const [collision] = await transaction.$queryRaw<Array<{ exists: number | bigint }>>`
            SELECT EXISTS (SELECT 1 FROM board_userlinkmeta WHERE id = ${link.id}) AS "exists"
          `;
          if (collision?.exists) throw new Error('social-link-conflict');
          await transaction.$executeRaw`
            INSERT INTO board_userlinkmeta (id, name, value, created_date, updated_date, user_id, "order")
            VALUES (${link.id}, ${link.name}, ${link.value}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${userId}, ${link.order})
          `;
        }
      }
      for (const link of mutation.creates) {
        await transaction.$executeRaw`
          INSERT INTO board_userlinkmeta (name, value, created_date, updated_date, user_id, "order")
          VALUES (${link.name}, ${link.value}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${userId}, ${link.order})
        `;
      }
      for (const id of mutation.deletes) {
        await transaction.$executeRaw`DELETE FROM board_userlinkmeta WHERE id = ${id} AND user_id = ${userId}`;
      }
    });
  } catch {
    return socialValueError();
  }
  return { ok: true };
}
