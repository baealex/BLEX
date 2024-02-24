import classNames from 'classnames/bind';
import styles from './DateInput.module.scss';
const cx = classNames.bind(styles);

import React from 'react';
import { default as ReactDatePicker } from 'react-datepicker';

import 'react-datepicker/dist/react-datepicker.css';

import { BaseInput } from '../BaseInput';

export interface DateInputProps {
    placeholder?: string;
    className?: string;
    showTime?: boolean;
    minDate?: Date;
    maxDate?: Date;
    selected: Date | null;
    style?: React.CSSProperties;
    onChange: (date: Date) => void;
}

export const DateInput = ({
    showTime = false,
    style,
    ...props
}: DateInputProps) => {
    return (
        <div className={cx('date-input')}>
            <ReactDatePicker
                customInput={(
                    <BaseInput
                        tag="input"
                        icon={(<i className="far fa-calendar-alt" />)}
                        style={style}
                    />
                )}
                dateFormat={showTime ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd'}
                showTimeSelect={showTime}
                placeholderText={props.placeholder}
                {...props}
            />
        </div>
    );
};
