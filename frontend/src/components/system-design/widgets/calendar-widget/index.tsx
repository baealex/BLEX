import { useEffect, useState } from 'react';

import { Card, Flex, Progress, Text } from '~/components/design-system';

const WEEKDAYS = [
    '일',
    '월',
    '화',
    '수',
    '목',
    '금',
    '토'
];

export function CalendarWidget() {
    const [year, setYear] = useState(0);
    const [month, setMonth] = useState(0);
    const [day, setDay] = useState(0);
    const [weekday, setWeekday] = useState('');

    const [remainingTodayPercent, setRemainingTodayPercent] = useState(0);
    const [remainingMonthPercent, setRemainingMonthPercent] = useState(0);
    const [remainingYearPercent, setRemainingYearPercent] = useState(0);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | null = null;

        const calculateRemaining = () => {
            const now = new Date();
            const today = now.getDate();
            const month = now.getMonth();
            const year = now.getFullYear();
            const weekday = now.getDay();

            setDay(today);
            setMonth(month + 1);
            setYear(year);
            setWeekday(WEEKDAYS[weekday]);

            const totalDay = 1000 * 60 * 60 * 24;
            const totalMonth = 1000 * 60 * 60 * 24 * 30;
            const totalYear = 1000 * 60 * 60 * 24 * 30 * 12;

            const dayTotal = new Date(year, month, today).getTime();
            const monthTotal = new Date(year, month, 1).getTime();
            const yearTotal = new Date(year, 1, 1).getTime();

            const remainingDay = now.getTime() - dayTotal;
            const remainingMonth = now.getTime() - monthTotal;
            const remainingYear = now.getTime() - yearTotal;

            setRemainingTodayPercent(((remainingDay / totalDay) * 100));
            setRemainingMonthPercent(((remainingMonth / totalMonth) * 100));
            setRemainingYearPercent(((remainingYear / totalYear) * 100));

            timeout = setTimeout(calculateRemaining, 10000);
        };

        calculateRemaining();

        return () => {
            if (timeout) {
                clearTimeout(timeout);
            }
        };
    }, []);

    return (
        <Card hasShadow isRounded className="p-3">
            <Flex align="center" gap={2}>
                <Text fontWeight={600} className="gray-dark">
                    <i className="fas fa-calendar-alt" />
                </Text>
                <Text fontWeight={600} className="gray-dark">
                    Calendar
                </Text>
            </Flex>

            <Flex className="my-3" direction="column" align="center" gap={1}>
                <Text fontSize={3}>{year}년 {month}월</Text>
                <Text fontWeight={600}>{day}일</Text>
                <Text fontSize={3}>{weekday}요일</Text>
            </Flex>


            <Flex direction="column" gap={2}>
                <Flex justify="between" align="center" className="w-100">
                    <Text fontSize={3}>오늘</Text>
                    <Text fontSize={2}>{remainingTodayPercent.toFixed(2)}%</Text>
                </Flex>
                <Progress type="bar" value={Math.round(100 - remainingTodayPercent)} />

                <Flex justify="between" align="center" className="w-100">
                    <Text fontSize={3}>이번 달</Text>
                    <Text fontSize={2}>{remainingMonthPercent.toFixed(2)}%</Text>
                </Flex>
                <Progress type="bar" value={Math.round(100 - remainingMonthPercent)} />

                <Flex justify="between" align="center" className="w-100">
                    <Text fontSize={3}>올해</Text>
                    <Text fontSize={2}>{remainingYearPercent.toFixed(2)}%</Text>
                </Flex>
                <Progress type="bar" value={Math.round(100 - remainingYearPercent)} />
            </Flex>
        </Card>
    );
}