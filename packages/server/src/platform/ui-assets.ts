import { readFile } from 'node:fs/promises';

interface ManifestAsset {
  file: string;
  css?: string[];
}
export const clientAssets = new URL('../../client/', import.meta.url);

async function readManifestAsset(entry: string): Promise<ManifestAsset> {
  const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', clientAssets), 'utf8')) as Record<
    string,
    ManifestAsset
  >;
  const asset = manifest[entry];
  if (!asset) throw new Error(`Build the BLEX browser assets before using ${entry}.`);
  return asset;
}

export async function readUiAsset(entry: string) {
  const asset = await readManifestAsset(entry);
  return { script: `/assets/ui/${asset.file}`, css: (asset.css ?? []).map((file) => `/assets/ui/${file}`) };
}

/** The URL of an entry that builds to a single file, such as a stylesheet. */
export async function readUiFile(entry: string) {
  return `/assets/ui/${(await readManifestAsset(entry)).file}`;
}

/** The site styles and Pretendard's faces that every page links, by their hashed URLs. */
export async function readSiteStylesheets() {
  const { css } = await readUiAsset('src/appearance/site-client.ts');
  if (css.length !== 1) throw new Error('The BLEX site stylesheet was not built.');
  return { theme: css[0], fonts: await readUiFile('styles/fonts/pretendard/pretendardvariable-dynamic-subset.css') };
}
