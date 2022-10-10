import { forwardRef } from 'react';

export interface CheckBoxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export const CheckBox = forwardRef<HTMLInputElement, CheckBoxProps>((props, ref) => (
    <div className="d-flex align-items-center form-check">
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
    </div>
));
