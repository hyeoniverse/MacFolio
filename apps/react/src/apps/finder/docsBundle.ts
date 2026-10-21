// 빌드할 때 저장소 문서와 그 그림을 묶는다 (Vite import.meta.glob). Finder를 처음 열 때 함께 불러온다.
import { getResume } from '@/shared/site/resumeStore';
import { repoPath } from './repoDocs';
import { RESUME_DOC } from './resumeModel';

const sources = import.meta.glob<string>(
	['../../../../../README.md', '../../../../../CONTRIBUTING.md', '../../../../../docs/*.md'],
	{ query: '?raw', import: 'default', eager: true }
);

const imageUrls = import.meta.glob<string>('../../../../../docs/images/*', {
	query: '?url',
	import: 'default',
	eager: true,
});

/** 저장소 경로 → Markdown 원문 */
export const DOC_SOURCES: Record<string, string> = Object.fromEntries(
	Object.entries(sources).map(([key, source]) => [repoPath(key), source])
);

/** 저장소 경로 → 묶은 그림 주소 */
export const DOC_IMAGES: Record<string, string> = Object.fromEntries(
	Object.entries(imageUrls).map(([key, url]) => [repoPath(key), url])
);

/** 문서 경로 (README, CONTRIBUTING이 먼저) */
export const DOC_PATHS = Object.keys(DOC_SOURCES).sort(
	(a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b)
);

/** Finder에서 읽는 문서의 원문: 저장소 문서, 또는 이력서 Markdown(관리자가 저장한 것, 없으면 기본 이력서). 없으면 undefined */
export const docSource = (path: string): string | undefined => (path === RESUME_DOC ? getResume() : DOC_SOURCES[path]);
