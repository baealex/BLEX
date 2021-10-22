import styles from './DayNight.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

export interface DayNightProps {
    isNight: boolean,
    onChange: (isNight: boolean) => void;
}

export function DayNight({
    isNight,
    onChange
}: DayNightProps) {
    return (
        <div className={cn('box')} onClick={() => onChange(!isNight)}>
            <div className={cn('ball', { isNight })}/>
            <div className={cn('icon', 'day')}>
                <svg viewBox="0 0 16 16" fill={isNight ? "#333" : "#ef9530"} role="img" aria-labelledby="title-8423672348121429" xmlns="http://www.w3.org/2000/svg"><title id="title-8423672348121429">Light theme icon (depiction of a sun)</title><path d="M7.5 11.465a3.482 3.482 0 01-1.596-.662L4.11 12.596a.5.5 0 01-.707-.707l1.793-1.793A3.482 3.482 0 014.535 8.5H2a.5.5 0 010-1h2.535a3.482 3.482 0 01.662-1.596L3.404 4.11a.5.5 0 01.707-.707l1.793 1.793A3.482 3.482 0 017.5 4.535V2a.5.5 0 011 0v2.535a3.482 3.482 0 011.596.662l1.793-1.793a.5.5 0 01.707.707l-1.793 1.793c.343.458.577 1.003.662 1.596H14a.5.5 0 110 1h-2.535a3.482 3.482 0 01-.662 1.596l1.793 1.793a.5.5 0 01-.707.707l-1.793-1.793a3.482 3.482 0 01-1.596.662V14a.5.5 0 11-1 0v-2.535z"></path></svg>
            </div>
            <div className={cn('icon', 'night')}>
                <svg viewBox="0 0 16 16" fill={isNight ? "#ef9530" : "#333"} role="img" aria-labelledby="title-5834624573919404" xmlns="http://www.w3.org/2000/svg"><title id="title-5834624573919404">Dark theme icon (depiction of a moon)</title><path d="M7.067 3.087a5 5 0 005.466 7.026 5 5 0 11-5.466-7.026z"></path></svg>
            </div>
        </div>
    )
}