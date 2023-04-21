import React from 'react';

export interface FormControlProps {
    className?: string;
    required?: boolean;
    invalid?: boolean;
    children: React.ReactNode | React.ReactNode[];
}

export function FormControl(props: FormControlProps) {
    return (
        <div className={props.className}>
            {React.Children.map(props.children, (child) => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child, {
                        required: props.required,
                        invalid: props.invalid
                    } as unknown as typeof child);
                }
                return child;
            })}
        </div>
    );
}
