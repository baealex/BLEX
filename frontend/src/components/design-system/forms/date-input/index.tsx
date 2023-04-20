import React from 'react';
import { default as ReactDatePicker } from 'react-datepicker';

import 'react-datepicker/dist/react-datepicker.css';

import { BaseInput } from '../base-input';

export interface DateInputProps {
    className?: string;
    showTime?: boolean;
    selected: Date;
    onChange: (date: Date) => void;
}

export const DateInput = ({
    showTime = false,
    ...props
}: DateInputProps) => {
    return (
        <ReactDatePicker
            customInput={<BaseInput />}
            dateFormat={showTime ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd'}
            showTimeSelect={showTime}
            {...props}
        />
    );
};
