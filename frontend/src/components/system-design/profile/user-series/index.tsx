import {
    SeriesList,
    SeriesListProps
} from '../../series/series-list';

export interface SeriesProps {
    series: SeriesListProps[];
    children?: JSX.Element;
}

export function UserSeries(props: SeriesProps) {
    return (
        <>
            {props.series.map((item) => (
                <SeriesList key={item.url} {...item}/>
            ))}
            {props.children}
        </>
    );
}
