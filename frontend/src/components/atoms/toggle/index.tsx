import { useRef } from 'react';

interface Props {
    label: string;
    onClick: (value: boolean) => void;
    defaultChecked?: boolean;
};

export default function Toggle(props: Props) {
    const checkbox = useRef<HTMLInputElement>(null);

    const onClickCheckbox = () => {
        checkbox.current?.click();
    };

    return (
        <div className="custom-control custom-switch noto">
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