import { useEffect, useMemo, useState } from 'react';
import { getPostRepository } from '@/apps/memo/repository';
import { env } from '@/shared/config/env';
import { fetchServerFiles, usageOf, type ServerFile } from './filesApi';

/** 서버 파일과 쓰는 곳. 처음 열 때와 지운 뒤에 다시 읽는다 */
export function useServerFiles(enabled: boolean) {
	const [files, setFiles] = useState<ServerFile[] | null>(null);
	const [repoPosts, setRepoPosts] = useState<{ slug: string; body: string }[]>([]);
	const [reloads, setReloads] = useState(0);

	useEffect(() => {
		let alive = true;
		getPostRepository()
			.list()
			.then((posts) => alive && setRepoPosts(posts))
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		if (!enabled) return;
		let alive = true;
		fetchServerFiles(env.apiUrl).then((list) => alive && setFiles(list ?? []));
		return () => {
			alive = false;
		};
	}, [enabled, reloads]);

	const rows = useMemo(
		() => (files ?? []).map((file) => ({ file, usage: usageOf(file, repoPosts) })),
		[files, repoPosts]
	);
	return { loaded: files !== null, rows, reload: () => setReloads((count) => count + 1) };
}
