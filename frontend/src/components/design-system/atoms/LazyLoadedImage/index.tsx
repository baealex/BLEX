import { useEffect, useRef } from 'react';

interface LazyLoadedImageProps {
    className?: string;
    previewImage: string;
    src: string;
    alt: string;
}

export function LazyLoadedImage({
    className,
    src,
    alt,
    previewImage
}: LazyLoadedImageProps) {
    const ref = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (ref.current && previewImage && src && src !== previewImage) {
            const observer = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) {
                    observer.disconnect();
                    ref.current!.src = src;
                }
            }, { threshold: 0.1 });

            observer.observe(ref.current);
        }
    }, [ref, previewImage, src]);

    return (
        <img
            ref={ref}
            className={className}
            alt={alt}
            src={previewImage}
            data-src={src}
        />
    );
}