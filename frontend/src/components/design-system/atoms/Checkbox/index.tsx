import { forwardRef } from 'react';

import { Flex } from '../Flex';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>((props, ref) => (
    <Flex align="center" className="form-check">
        <label>
            <input
                ref={ref}
                type="checkbox"
                className="form-check-input c-pointer"
                {...props}
            />
            {props.label && (
                <span className="form-check-label none-drag c-pointer">
                    {props.label}
                </span>
            )}
        </label>
    </Flex>
));
