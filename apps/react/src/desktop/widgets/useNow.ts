import { useEffect, useState } from 'react';

/** 지금 시각. intervalMs마다 다시 그린다 (시계는 1초, 날짜는 1분) */
export function useNow(intervalMs: number): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(new Date()), intervalMs);
		return () => window.clearInterval(timer);
	}, [intervalMs]);
	return now;
}
