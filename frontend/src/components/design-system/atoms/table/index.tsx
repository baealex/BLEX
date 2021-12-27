import styles from './Table.module.scss';

export interface TableProps {
    head: string[];
    body: string[][];
}

export function Table({
    head,
    body,
}: TableProps) {
    return (
        <div className={styles.wrap}>
            <table>
                <thead>
                    <tr>
                        {head.map((text, idx) => (
                            <th key={idx}>{text}</th>    
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {body.map((row, bodyIdx) => (
                        <tr key={bodyIdx}>
                            {row.map((text, rowIdx) => (
                                <td
                                    key={rowIdx}
                                    data-title={head[rowIdx]}
                                >
                                    {text}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}