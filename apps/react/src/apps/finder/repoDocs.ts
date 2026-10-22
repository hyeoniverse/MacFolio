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

/** Finder에 묶어 두는 문서의 모양 (docsBundle.ts의 glob과 같다): README·CONTRIBUTING과 그 번역(README.en.md), docs/ 아래 모든 .md (그림 폴더는 빼고) */
const BUNDLED_DOC = /^((README|CONTRIBUTING)[^/]*\.md|docs\/(?!images\/)(?:[^/]+\/)*[^/]+\.md)$/;

/**
 * 글 안 링크가 GitHub의 저장소 문서(…/blob/main/docs/a.md)를 가리키면 그 문서 경로. 아니면 null.
 * 메모 글의 문서 링크를 새 탭 대신 Finder에서 열 때 쓴다. 문서 안 #제목 링크는 GitHub에서 연다 (Finder 본문에는 제목 앵커가 없다)
 */
export function bundledDocOf(href: string | undefined): string | null {
	const prefix = `${REPO_URL}/blob/main/`;
	if (!href?.startsWith(prefix) || href.includes('#') || href.includes('?')) return null;
	let path: string | null;
	try {
		path = normalizePath(decodeURI(href.slice(prefix.length)));
	} catch {
		return null;
	}
	return path && BUNDLED_DOC.test(path) ? path : null;
}

/** 문서 안 그림 주소. 묶어 둔 그림이면 그 주소, 아니면 GitHub의 원본 파일 */
export function resolveImage(from: string, src: string, images: Readonly<Record<string, string>>): string {
	if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) return src;
	const base = from.includes('/') ? from.slice(0, from.lastIndexOf('/') + 1) : '';
	const target = normalizePath(src.startsWith('/') ? src : base + src);
	if (target === null) return src;
	return images[target] ?? `${RAW_URL}/${encodeURI(target)}`;
}

/**
 * <picture>의 <source media>가 화면 모드를 고르는 것이면 그 모드 (GitHub README의 라이트·다크 그림).
 * Finder는 시스템이 아니라 사이트의 화면 모드를 따르므로, media를 그대로 두지 않고 이 값으로 고른다
 */
export function colorSchemeOf(media: string | undefined): 'light' | 'dark' | null {
	return (/prefers-color-scheme:\s*(light|dark)/.exec(media ?? '')?.[1] as 'light' | 'dark' | undefined) ?? null;
}

/** 문서 제목: 첫 # 제목, 없으면 파일 이름 */
export function docTitle(path: string, source: string): string {
	return /^#\s+(.+)$/m.exec(source)?.[1].trim() ?? path.split('/').at(-1)!;
}
