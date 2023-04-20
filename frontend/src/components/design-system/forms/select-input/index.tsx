import classNames from 'classnames/bind';
import styles from './SelectInput.module.scss';
const cx = classNames.bind(styles);

interface Props {
    className?: string;
    label: string;
    name: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    children: JSX.Element;
}

export function SelectInput(props: Props) {
    return (
        <>
            <div className={props.className}>
                <label className={cx('label')}>{props.label}</label>
                <div className={cx('group')}>
                    <select
                        name={props.name}
                        className="form-control"
                        onChange={props.onChange}>
                        <option value="">선택하지 않음</option>
                        {props.children}
                    </select>
                    <i className="fas fa-book"></i>
                </div>
            </div>
        </>
    );
}
