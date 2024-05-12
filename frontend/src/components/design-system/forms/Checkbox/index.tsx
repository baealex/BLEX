import styles from './Checkbox.module.scss';

import { forwardRef } from 'react';

import { Flex } from '~/components/design-system';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>((props, ref) => (
    <Flex align="center" className={styles.checkbox}>
        <label>
            <input
                ref={ref}
                type="checkbox"
                className={styles.input}
                {...props}
            />
            {props.label && (
                <span className={styles.label}>
                    {props.label}
                </span>
            )}
        </label>
    </Flex>
));
