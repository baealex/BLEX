import type { Prisma } from '@prisma/client';

export async function deleteSeriesRows(
  tx: Prisma.TransactionClient,
  where: Prisma.board_seriesWhereInput,
): Promise<number> {
  const related = { board_series: where };
  await tx.post.updateMany({ where: related, data: { series_id: null } });
  await tx.board_seriesconfigmeta.deleteMany({ where: related });
  return (await tx.board_series.deleteMany({ where })).count;
}
