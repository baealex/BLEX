import classNames from 'classnames/bind';
import styles from './KeywordInput.module.scss';
const cx = classNames.bind(styles);

import { Badge } from '~/components/design-system';

type inputType = 'text' | 'password';

interface Props {
    className?: string;
    label: string;
    type: inputType;
    name: string;
    maxLength: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    value: string;
    placeholder: string;
}

export function KeywordInput(props: Props) {
    const badges = [...new Set(props.value.replace(/[\s\\,\\.]/g, '-').split('-').filter(x => !!x))];

    return (
        <>
            <div className={props.className}>
                <label className={cx('label')}>
                    {props.label}
                </label>
                <div className="group">
                    <input
                        type={props.type ? props.type : 'text'}
                        name={props.name}
                        className="form-control"
                        maxLength={props.maxLength}
                        onChange={(e) => props.onChange(e)}
                        value={props.value}
                        placeholder={props.placeholder}
                    />
                </div>
                <div className="mt-2">
                    {badges.map((badge) => (
                        <Badge>{badge}</Badge>
                    ))}
                </div>
            </div>
        </>
    );
}
