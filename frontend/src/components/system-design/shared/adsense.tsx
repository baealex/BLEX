import React, { useEffect } from 'react';

type Props = {
    className?: string;
    style?: React.CSSProperties;
    client: string;
    slot: string;
    layout?: string;
    layoutKey?: string;
    format?: string;
    responsive?: string;
    pageLevelAds?: boolean;
};

export const Adsense = ({
    className = '',
    style = { display: 'block' },
    client,
    slot,
    layout = '',
    layoutKey = '',
    format = 'auto',
    responsive = 'false',
    pageLevelAds = false,
    ...rest
}: Props) => {
    useEffect(() => {
        const p: any = {};
        if (pageLevelAds) {
            p.google_ad_client = client;
            p.enable_page_level_ads = true;
        }

        try {
            if (typeof window === 'object') {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push(p);
            }
        } catch (e) {
            // pass
        }
    }, []);

    return (
        <ins
            className={`adsbygoogle ${className}`}
            style={style}
            data-ad-client={client}
            data-ad-slot={slot}
            data-ad-layout={layout}
            data-ad-layout-key={layoutKey}
            data-ad-format={format}
            data-full-width-responsive={responsive}
            {...rest}
        />
    );
};