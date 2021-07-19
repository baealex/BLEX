import {
    SeriesList,
    SeriesListProps,
} from '../../series/series-list';

export interface SereisProps {
    series: SeriesListProps[];
    children: JSX.Element;
}

export function UserSeries(props: SereisProps) {
    return (
        <>
            {props.series.map((item, idx: number) => (
                <SeriesList key={idx} {...item}/>
            ))}
            {props.children}
        </>
    )
}