import { useRef } from 'react';

export interface ToggleProps {
    label: string;
    onClick: (value: boolean) => void;
    defaultChecked?: boolean;
}

export function Toggle(props: ToggleProps) {
    const checkbox = useRef<HTMLInputElement>(null);

    const onClickCheckbox = () => {
        checkbox.current?.click();
    };

    return (
        <div className="d-flex align-items-center custom-control custom-switch">
            <input
                ref={checkbox}
                type="checkbox"
                defaultChecked={props.defaultChecked}
                className="custom-control-input c-pointer"
                onClick={(e) => props.onClick(e.currentTarget.checked)}
            />
            {props.label && (
                <label className="custom-control-label none-drag c-pointer" onClick={() => onClickCheckbox()}>
                    {props.label}
                </label>
            )}
        </div>
    );
}