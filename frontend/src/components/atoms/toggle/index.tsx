import { useRef } from 'react';

export interface ToggleProps {
    label: string;
    onClick: (value: boolean) => void;
    defaultChecked?: boolean;
};

export function Toggle(props: ToggleProps) {
    const checkbox = useRef<HTMLInputElement>(null);

    const onClickCheckbox = () => {
        checkbox.current?.click();
    };

    return (
        <div className="d-flex align-items-center custom-control custom-switch noto">
            <input
                ref={checkbox}
                onClick={(e: any) => props.onClick(e.target.checked)}
                type="checkbox"
                className="custom-control-input c-pointer"
                defaultChecked={props.defaultChecked}
            />
            {props.label && (
                <label className="custom-control-label none-drag c-pointer" onClick={() => onClickCheckbox()}>
                    {props.label}
                </label>
            )}
        </div>
    )
}