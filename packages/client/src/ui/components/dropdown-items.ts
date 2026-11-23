/** Gives every item its own value, because two items can share a label. */
export function keyedDropdownItems<Item extends { id?: string; label: string }>(
    items: readonly Item[]
): Array<{ item: Item; value: string }> {
    const seen = new Map<string, number>();
    return items.map((item) => {
        const base = item.id ?? item.label;
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        return { item, value: count === 0 ? base : `${base}\u0000${count}` };
    });
}
