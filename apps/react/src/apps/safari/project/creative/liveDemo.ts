// 실제 AI를 부르는 데모(번역·요약·커버)가 함께 쓰는 서버 호출. 남은 횟수 칩은 QuotaChip.tsx
import { useCallback, useEffect, useState } from 'react';
import { env } from '@/shared/config/env';
import { cheer } from './demoEvent';

/** 실제 AI를 부르는 데모(번역, 요약, 커버)의 하루 남은 횟수 */
export type Quota = { remaining: number; perIp: number; total: number };

/**
 * 실제 AI를 부르는 데모가 함께 쓰는 서버 호출. 처음에 남은 횟수를 받아 두고, 보낼 때마다 고친다.
 * 실패하면 화면에 그대로 보일 문장을 돌려준다 (서버가 쓴 이유가 있으면 그것을)
 */
export const useLiveDemo = <T>(path: 'translate' | 'summary' | 'cover', what: string) => {
	const api = env.apiUrl;
	const [quota, setQuota] = useState<Quota | null>(null);
	useEffect(() => {
		if (!api) return;
		const controller = new AbortController();
		fetch(`${api}/${path}`, { signal: controller.signal })
			.then((response) => (response.ok ? response.json() : null))
			.then((data) => data && setQuota(data))
			.catch(() => undefined);
		return () => controller.abort();
	}, [api, path]);

	const send = useCallback(
		async (body: object): Promise<{ data: T; error?: undefined } | { data?: undefined; error: string }> => {
			if (!api) {
				cheer(path, 'error');
				return { error: `이 화면에는 ${what} 서버가 연결되어 있지 않습니다.` };
			}
			cheer(path, 'busy');
			try {
				const response = await fetch(`${api}/${path}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				});
				const data = (await response.json().catch(() => ({}))) as T & {
					remaining?: number;
					message?: string | string[];
				};
				// 다 썼으면(429) 남은 횟수가 실려 오지 않을 수 있다
				const remaining = typeof data.remaining === 'number' ? data.remaining : response.status === 429 ? 0 : null;
				if (remaining !== null) setQuota((now) => (now ? { ...now, remaining } : now));
				if (!response.ok) {
					const reason = Array.isArray(data.message) ? data.message[0] : data.message;
					cheer(path, 'error');
					return { error: reason ?? `${what}지 못했습니다.` };
				}
				cheer(path, 'done');
				return { data };
			} catch {
				cheer(path, 'error');
				return { error: '서버에 닿지 못했습니다. 잠시 뒤 다시 해 보세요.' };
			}
		},
		[api, path, what]
	);
	return { quota, send };
};
