import type { Prisma, PrismaClient } from '@prisma/client';

export type PostTextField = 'title' | 'subtitle' | 'slug' | 'description' | 'tags' | 'content';

const confirmBatch = 100;
const likeWildcard = /[%_]/;

const fieldFilter: Record<PostTextField, (keyword: string) => Prisma.PostWhereInput> = {
  title: (keyword) => ({ title: { contains: keyword } }),
  subtitle: (keyword) => ({ subtitle: { contains: keyword } }),
  slug: (keyword) => ({ slug: { contains: keyword } }),
  description: (keyword) => ({ description: { contains: keyword } }),
  tags: (keyword) => ({ tags: { some: { name: { contains: keyword } } } }),
  content: (keyword) => ({ content: { html: { contains: keyword } } }),
};

const fieldText = {
  title: { select: { title: true }, read: (row: { title: string }) => [row.title] },
  subtitle: { select: { subtitle: true }, read: (row: { subtitle: string }) => [row.subtitle] },
  slug: { select: { slug: true }, read: (row: { slug: string }) => [row.slug] },
  description: { select: { description: true }, read: (row: { description: string }) => [row.description] },
  tags: {
    select: { tags: { select: { name: true } } },
    read: (row: { tags: Array<{ name: string }> }) => row.tags.map(({ name }) => name),
  },
  content: {
    select: { content: { select: { html: true } } },
    read: (row: { content: { html: string } | null }) => [row.content?.html ?? ''],
  },
} as const;

/** SQLite LIKE folds ASCII letters only. */
function foldAscii(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export function containsLiteral(text: string, keyword: string): boolean {
  return foldAscii(text).includes(foldAscii(keyword));
}

/**
 * Ids of posts whose field contains any keyword literally. Prisma's `contains` is an SQLite LIKE that cannot
 * escape `%` or `_`, so a keyword holding one only narrows the candidates, which are confirmed here in small batches.
 */
export async function postIdsMatching(
  db: PrismaClient | Prisma.TransactionClient,
  base: Prisma.PostWhereInput,
  field: PostTextField,
  keywords: string[],
): Promise<Set<number>> {
  const ids = new Set<number>();
  const plain = keywords.filter((keyword) => !likeWildcard.test(keyword));
  const wildcards = keywords.filter((keyword) => likeWildcard.test(keyword));
  if (plain.length) {
    const rows = await db.post.findMany({
      where: { AND: [base, { OR: plain.map(fieldFilter[field]) }] },
      select: { id: true },
    });
    for (const { id } of rows) ids.add(id);
  }
  if (!wildcards.length) return ids;
  const { select, read } = fieldText[field];
  const candidates = { AND: [base, { OR: wildcards.map(fieldFilter[field]) }] };
  for (let cursor = 0; ; ) {
    const batch = (await db.post.findMany({
      where: { AND: [candidates, { id: { gt: cursor } }] },
      orderBy: { id: 'asc' },
      take: confirmBatch,
      select: { id: true, ...select },
    })) as unknown as Array<{ id: number } & Parameters<typeof read>[0]>;
    for (const row of batch) {
      const texts = (read as (value: unknown) => string[])(row);
      if (texts.some((text) => wildcards.some((keyword) => containsLiteral(text, keyword)))) ids.add(row.id);
    }
    const last = batch.at(-1);
    if (batch.length < confirmBatch || !last) return ids;
    cursor = last.id;
  }
}
