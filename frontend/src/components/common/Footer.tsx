interface FooterProps {
    bgdark: boolean;
    children: JSX.Element;
};

export default function Footer(props: FooterProps) {
    return (
        <footer className={`page-footer font-small ${props.bgdark ? 'bg-rdark' : ''}`}>
            {props.children}
            <div className="footer-copyright text-center py-3">
                Copyright 2020 &copy; <a href="https://baejino.com">BaeJino</a>.
            </div>
        </footer>
    );
}