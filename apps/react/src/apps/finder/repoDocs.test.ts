import { describe, expect, it } from 'vitest';
import { docTitle, normalizePath, repoPath, resolveImage, resolveLink, REPO_URL } from './repoDocs';

const docs = new Set(['README.md', 'CONTRIBUTING.md', 'docs/deployment.md', 'docs/backend-design.md']);

describe('repoPath · normalizePath', () => {
	it('glob 경로를 저장소 경로로', () => {
		expect(repoPath('../../../../../docs/deployment.md')).toBe('docs/deployment.md');
		expect(repoPath('../../../../../README.md')).toBe('README.md');
	});

	it('. 과 .. 를 풀고, 저장소 밖으로 나가면 null', () => {
		expect(normalizePath('docs/./images/../deployment.md')).toBe('docs/deployment.md');
		expect(normalizePath('../README.md')).toBeNull();
	});
});

describe('resolveLink', () => {
	it('묶어 둔 문서는 Finder에서 연다 (상대 경로는 문서 위치 기준)', () => {
		expect(resolveLink('README.md', 'docs/deployment.md', docs)).toEqual({ type: 'doc', path: 'docs/deployment.md' });
		expect(resolveLink('docs/backend-design.md', 'deployment.md', docs)).toEqual({
			type: 'doc',
			path: 'docs/deployment.md',
		});
		expect(resolveLink('docs/backend-design.md', '../README.md', docs)).toEqual({ type: 'doc', path: 'README.md' });
	});

	it('저장소의 다른 파일과 #제목은 GitHub, 바깥 주소는 그대로', () => {
		expect(resolveLink('README.md', 'apps/api/README.md', docs)).toEqual({
			type: 'external',
			url: `${REPO_URL}/blob/main/apps/api/README.md`,
		});
		expect(resolveLink('README.md', 'CONTRIBUTING.md#저장소-설정', docs)).toEqual({
			type: 'external',
			url: `${REPO_URL}/blob/main/CONTRIBUTING.md#저장소-설정`,
		});
		expect(resolveLink('README.md', 'https://example.com', docs)).toEqual({
			type: 'external',
			url: 'https://example.com',
		});
		expect(resolveLink('README.md', 'mailto:a@example.com', docs)).toEqual({
			type: 'external',
			url: 'mailto:a@example.com',
		});
	});
});

describe('resolveImage', () => {
	const images = { 'docs/images/desktop.jpg': '/assets/desktop-abc.jpg' };
	it('묶어 둔 그림은 그 주소, 아니면 GitHub 원본', () => {
		expect(resolveImage('README.md', 'docs/images/desktop.jpg', images)).toBe('/assets/desktop-abc.jpg');
		expect(resolveImage('docs/deployment.md', 'images/desktop.jpg', images)).toBe('/assets/desktop-abc.jpg');
		expect(resolveImage('README.md', 'apps/react/a.jpg', images)).toBe(
			'https://raw.githubusercontent.com/hyeoniverse/MacFolio/main/apps/react/a.jpg'
		);
		expect(resolveImage('README.md', 'https://img.shields.io/x', images)).toBe('https://img.shields.io/x');
	});
});

it('docTitle: 첫 # 제목, 없으면 파일 이름', () => {
	expect(docTitle('docs/deployment.md', '머리말\n\n# 배포\n\n## 하나')).toBe('배포');
	expect(docTitle('docs/x.md', '제목 없음')).toBe('x.md');
});
