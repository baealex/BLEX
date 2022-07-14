import { useRef } from 'react';

export interface CheckBoxProps {
    label: string;
    onClick: (value: boolean) => void;
    defaultChecked: boolean;
}

export function CheckBox(props: CheckBoxProps) {
    const checkbox = useRef<HTMLInputElement>(null);

    const onClickCheckbox = () => {
        checkbox.current?.click();
    };

    return (
        <div className="d-flex align-items-center form-group form-check">
            <input
                ref={checkbox}
                onClick={(e) => props.onClick(e.currentTarget.checked)}
                type="checkbox"
                className="form-check-input c-pointer"
                defaultChecked={props.defaultChecked}
            />
            {props.label && (
                <label className="form-check-label none-drag c-pointer" onClick={() => onClickCheckbox()}>
                    {props.label}
                </label>
            )}
        </div>
    );
}