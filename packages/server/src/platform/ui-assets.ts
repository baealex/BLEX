import { readFile } from 'node:fs/promises';

interface ManifestAsset {
  file: string;
  css?: string[];
}
export const clientAssets = new URL('../../client/', import.meta.url);

export async function readUiAsset(entry: string) {
  const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', clientAssets), 'utf8')) as Record<
    string,
    ManifestAsset
  >;
  const asset = manifest[entry];
  if (!asset) throw new Error(`Build the BLEX browser assets before using ${entry}.`);
  return { script: `/assets/ui/${asset.file}`, css: (asset.css ?? []).map((file) => `/assets/ui/${file}`) };
}
