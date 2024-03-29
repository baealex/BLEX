import React, { useEffect } from 'react';

interface Props {
    className?: string;
    style?: React.CSSProperties;
    client: string;
    slot: string;
    layout?: string;
    layoutKey?: string;
    format?: string;
    responsive?: string;
    pageLevelAds?: boolean;
}

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
        try {
            if (typeof window === 'object') {
                (window.adsbygoogle = window.adsbygoogle || []).push({
                    google_ad_client: client,
                    enable_page_level_ads: pageLevelAds
                });
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
