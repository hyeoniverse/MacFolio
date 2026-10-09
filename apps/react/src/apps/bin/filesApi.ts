// 서버에 올린 파일 (관리자): 목록과 지우기. 글에서 이미지를 빼도 서버의 파일은 남으므로, 어디에서도 쓰지 않는 파일을 찾아 지운다.
// 서버는 자기 DB의 글·예전 버전·배경화면만 보므로, 저장소의 Markdown 글이 가리키는지는 여기서 함께 본다

export interface ServerFile {
	id: string;
	name: string;
	type: string;
	size: number;
	image: boolean;
	/** API 주소 기준 경로 (/files/:id) */
	path: string;
	createdAt: string;
	createdBy: string;
	usedBy: { posts: string[]; revisions: string[]; wallpaper: boolean };
}

export interface FileUsage {
	/** 지워도 지금 보이는 곳이 깨지지 않는지 */
	removable: boolean;
	/** 목록에 보일 설명 */
	label: string;
}

/** 파일을 어디에서 쓰는지. repoPosts는 저장소 글 (주소와 본문) */
export function usageOf(file: ServerFile, repoPosts: { slug: string; body: string }[]): FileUsage {
	const inRepo = repoPosts.filter((post) => post.body.includes(`/files/${file.id}`)).map((post) => post.slug);
	const posts = [...new Set([...file.usedBy.posts, ...inRepo])];
	if (file.usedBy.wallpaper) return { removable: false, label: '배경화면' };
	if (posts.length > 0) return { removable: false, label: `글 ${posts.length}개: ${posts.join(', ')}` };
	if (file.usedBy.revisions.length > 0)
		return { removable: true, label: `예전 버전에서만: ${file.usedBy.revisions.join(', ')}` };
	return { removable: true, label: '쓰는 곳 없음' };
}

/** 1536 → "1.5 KB" */
export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB'];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}

export async function fetchServerFiles(apiUrl: string, fetchImpl: typeof fetch = fetch): Promise<ServerFile[] | null> {
	if (!apiUrl) return null;
	try {
		const response = await fetchImpl(`${apiUrl}/files`, { credentials: 'include' });
		return response.ok ? ((await response.json()) as ServerFile[]) : null;
	} catch {
		return null;
	}
}

/** 지운다. 실패하면 서버가 말한 이유 (쓰는 파일이면 409) */
export async function deleteServerFile(
	apiUrl: string,
	id: string,
	fetchImpl: typeof fetch = fetch
): Promise<{ ok: true } | { ok: false; reason: string }> {
	try {
		const response = await fetchImpl(`${apiUrl}/files/${id}`, { method: 'DELETE', credentials: 'include' });
		if (response.ok) return { ok: true };
		const body = (await response.json().catch(() => ({}))) as { message?: string };
		return { ok: false, reason: body.message ?? '지우지 못했습니다.' };
	} catch {
		return { ok: false, reason: '서버에 연결할 수 없습니다.' };
	}
}
