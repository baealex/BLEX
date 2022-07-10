export type PageLayout<T> = (page: JSX.Element, props: T) => JSX.Element;

export interface PageComponent<T> {
    (props: T): JSX.Element;
    static pageLayout?: PageLayout<T>;
}