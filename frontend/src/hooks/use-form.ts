import React, { useCallback, useRef } from 'react';

type FormElement =
    HTMLInputElement |
    HTMLSelectElement |
    HTMLTextAreaElement;

export function useForm<T>() {
    const forms = useRef<React.RefObject<FormElement>[]>([]);

    const register = useCallback(<R extends FormElement>(name: keyof T) => {
        const ref = useRef<R>(null);
        forms.current.push(ref);
        return {
            ref,
            name
        };
    }, []);

    const handleSubmit = useCallback((callback: (data: T) => Promise<void> | void) => {
        return (e?: React.FormEvent<HTMLFormElement>) => {
            if (e) {
                e.preventDefault();
            }

            const data = forms.current.reduce((acc, ref) => {
                if (ref.current) {
                    return {
                        ...acc,
                        [ref.current.name]: ref.current.value
                    };
                }
                return acc;
            }, {} as T);

            return callback(data);
        };
    }, []);

    const reset = useCallback(<K extends keyof T>(initData?: Pick<T, K>) => {
        forms.current.forEach(ref => {
            if (ref.current) {
                ref.current.value = initData?.[ref.current.name as K]
                    ? '' + initData[ref.current.name as K]
                    : '';
            }
        });
    }, []);

    const setFocus = useCallback((name: keyof T) => {
        const ref = forms.current.find(ref => ref.current?.name === name);
        if (ref && ref.current) {
            ref.current.focus();
        }
    }, []);

    return {
        handleSubmit,
        reset,
        register,
        setFocus
    };
}
