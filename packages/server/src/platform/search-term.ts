const MAX_SEARCH_LENGTH = 100;

/** Cuts a search term without leaving half of an emoji, which the database driver cannot encode. */
export function searchTerm(value: string | null): string {
  const text = (value ?? '').slice(0, MAX_SEARCH_LENGTH);
  const last = text.charCodeAt(text.length - 1);
  return (last >= 0xd800 && last <= 0xdbff ? text.slice(0, -1) : text).trim();
}
