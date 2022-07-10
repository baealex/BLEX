interface SortedOptions<T> {
    key?: keyof T;
    reverse?: boolean;
}

export function sorted<T>(list: readonly T[], {
    key = undefined,
    reverse = false
}: SortedOptions<T>) {
    const newList = [...list];

    if (key) {
        newList.sort((left, right) =>
            left[key] < right[key]
                ? -1
                : left[key] > right[key]
                    ? 1
                    : 0
        );
    } else {
        newList.sort();
    }

    return reverse
        ? newList.reverse()
        : newList;
}