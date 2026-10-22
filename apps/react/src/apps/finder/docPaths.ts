// 저장소 문서의 경로 목록 (README·CONTRIBUTING과 그 번역, docs/ 아래 모든 .md). 원문은 받지 않는다:
// import.meta.glob을 eager 없이 쓰면 경로(키)는 빌드할 때 정해지고 원문은 부를 때만 받는다.
// 바탕화면 아이콘이 첫 화면에서 Finder 트리를 만드는데, 원문 묶음(docsBundle.ts, 압축해도 75KB)까지 기다리지 않게 나눴다
import { repoPath } from './repoDocs';

const lazySources = import.meta.glob<string>(
	[
		'../../../../../README*.md',
		'../../../../../CONTRIBUTING*.md',
		'../../../../../docs/**/*.md',
		'!../../../../../docs/images/**',
	],
	{ query: '?raw', import: 'default' }
);

/** 문서 경로 (README, CONTRIBUTING이 먼저) */
export const DOC_PATHS = Object.keys(lazySources)
	.map(repoPath)
	.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
