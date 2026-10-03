// 저장소의 Markdown 문서(README, CONTRIBUTING, docs/)를 빌드할 때 묶어 Finder의 '문서' 폴더에 둔다.
// 저장소 문서가 바뀌면 다음 배포에서 사이트의 문서도 함께 바뀐다.

export const REPO_URL = 'https://github.com/hyeoniverse/MacFolio';
const RAW_URL = 'https://raw.githubusercontent.com/hyeoniverse/MacFolio/main';

/** 저장소 안 경로로 바꾼다: '../../../../../docs/a.md' → 'docs/a.md' */
export const repoPath = (globKey: string) => globKey.replace(/^(\.\.\/)+/, '');

/** 경로 정리: a/./b/../c → a/c. 저장소 밖으로 나가면 null */
export function normalizePath(path: string): string | null {
	const parts: string[] = [];
	for (const part of path.split('/')) {
		if (part === '' || part === '.') continue;
		if (part === '..') {
			if (!parts.length) return null;
			parts.pop();
		} else parts.push(part);
	}
	return parts.join('/');
}

export type LinkTarget = { type: 'doc'; path: string } | { type: 'external'; url: string };

/**
 * 문서 안 링크가 가리키는 곳. 묶어 둔 문서면 Finder에서 열고, 저장소의 다른 파일은 GitHub에서, 바깥 주소는 그대로 연다.
 * 같은 문서 안 #제목 링크는 GitHub의 그 문서 주소로 연다 (Finder 본문에는 제목 앵커가 없다).
 */
export function resolveLink(from: string, href: string, docs: ReadonlySet<string>): LinkTarget {
	if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return { type: 'external', url: href };
	const [pathPart, hash = ''] = href.split('#');
	const base = from.includes('/') ? from.slice(0, from.lastIndexOf('/') + 1) : '';
	const target = pathPart ? normalizePath(pathPart.startsWith('/') ? pathPart : base + decodeURI(pathPart)) : from;
	if (target === null) return { type: 'external', url: REPO_URL };
	if (docs.has(target) && !hash) return { type: 'doc', path: target };
	return { type: 'external', url: `${REPO_URL}/blob/main/${encodeURI(target)}${hash ? `#${hash}` : ''}` };
}

/** 문서 안 그림 주소. 묶어 둔 그림이면 그 주소, 아니면 GitHub의 원본 파일 */
export function resolveImage(from: string, src: string, images: Readonly<Record<string, string>>): string {
	if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) return src;
	const base = from.includes('/') ? from.slice(0, from.lastIndexOf('/') + 1) : '';
	const target = normalizePath(src.startsWith('/') ? src : base + src);
	if (target === null) return src;
	return images[target] ?? `${RAW_URL}/${encodeURI(target)}`;
}

/** 문서 제목: 첫 # 제목, 없으면 파일 이름 */
export function docTitle(path: string, source: string): string {
	return /^#\s+(.+)$/m.exec(source)?.[1].trim() ?? path.split('/').at(-1)!;
}
