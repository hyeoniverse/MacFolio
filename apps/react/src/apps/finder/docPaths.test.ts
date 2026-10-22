import { describe, expect, it } from 'vitest';
import { DOC_PATHS } from './docPaths';
import { DOC_SOURCES } from './docsBundle';

describe('저장소 문서 묶기', () => {
	it('저장소의 문서를 따로 적지 않아도 모두 묶는다: 번역(README.en.md)과 docs/ 안 폴더(docs/en/)까지', () => {
		expect(DOC_PATHS).toEqual(
			expect.arrayContaining(['README.md', 'README.en.md', 'CONTRIBUTING.md', 'docs/privacy.md', 'docs/en/privacy.md'])
		);
		expect(DOC_PATHS.some((path) => path.startsWith('docs/images/'))).toBe(false);
	});

	it('Finder 트리의 경로(docPaths)와 원문 묶음(docsBundle)이 같은 문서를 가리킨다', () => {
		expect([...DOC_PATHS].sort()).toEqual(Object.keys(DOC_SOURCES).sort());
	});
});
