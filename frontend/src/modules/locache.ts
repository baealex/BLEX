interface LocacheProps {
    key: string;
    owner?: string;
    refreshSeconds?: number;
}

interface Storage {
    owner: string;
    created: string;
    data: any;
}

export function setLocache(props: LocacheProps, data: any) {
    if ('localStorage' in window) {
        const storage = {
            owner: props.owner || '',
            created: new Date().toString(),
            data
        } as Storage;
        localStorage.setItem(props.key, JSON.stringify(storage));
    }
    return data;
}

export async function getLocache(props: LocacheProps, initValue: any): Promise<any> {
    if ('localStorage' in window) {
        const storage = localStorage.getItem(props.key);
        if (!storage) {
            return setLocache(props, await initValue());
        }

        const {
            owner,
            created,
            data,
        } = JSON.parse(storage) as Storage;

        if (data === undefined) {
            return setLocache(props, await initValue());
        }

        if (props.owner && props.owner != owner) {
            return setLocache(props, await initValue());
        }

        if (props.refreshSeconds) {
            if (((new Date() as any) - (new Date(created) as any)) / 1000 > props.refreshSeconds) {
                return setLocache(props, await initValue());
            }
        }

        return data;
    }
    return await initValue();
}

export function destroyLocache(key: string) {
    if ('localStorage' in window) {
        localStorage.removeItem(key);
    }
}