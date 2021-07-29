import styles from './TagCard.module.scss';
import classNames from 'classnames/bind';

import Link from 'next/link'

import { Card } from '@components/integrated';
import {
    getPostsImage,
} from '@modules/image';

export interface TagCardProps {
    name: string;
    count: number;
    image?: string;
    description?: string;
}

export function TagCard(props: TagCardProps) {
    const {
        image = '',
    } = props;
    
    return (
        <div className="col-lg-4 col-md-6 mt-4">
            <Card isRounded>
                <Link href={`/tags/${props.name}`}>
                    <a className="deep-dark">
                        <img
                            className={classNames(
                                styles.image,
                                'lazy'
                            )}
                            src={getPostsImage(image) + '.preview.jpg'}
                            data-src={getPostsImage(image)}
                            height="400"
                        />
                        <div className="p-3">
                            <div className={styles.title}>
                                {props.name} ({props.count})
                            </div>
                            {props.description && (
                                <p className={styles.description}>
                                    {props.description}
                                </p>  
                            )}
                        </div>
                    </a>
                </Link>
            </Card>
        </div>
    )
}