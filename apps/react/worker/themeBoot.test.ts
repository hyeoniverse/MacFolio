import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_BOOT, THEME_BOOT_HASH } from './themeBoot';
import { contentSecurityPolicy } from './securityHeaders';
import { STORAGE_KEYS } from '../src/shared/lib/storage';

describe('첫 화면의 인라인 스크립트 (themeBoot)', () => {
	it('CSP에 넣는 해시가 스크립트 내용과 같다 (내용을 바꾸면 이 값으로 고친다)', () => {
		expect(THEME_BOOT_HASH).toBe(`sha256-${createHash('sha256').update(THEME_BOOT, 'utf8').digest('base64')}`);
	});

	it('CSP의 script-src는 이 해시만 인라인으로 허용한다', () => {
		const scriptSrc = contentSecurityPolicy({})
			.split('; ')
			.find((directive) => directive.startsWith('script-src '))!;
		expect(scriptSrc).toContain(`'${THEME_BOOT_HASH}'`);
		expect(scriptSrc).not.toContain("'unsafe-inline'");
	});

	it('설정 저장 키를 글자 그대로 읽는다', () => {
		expect(THEME_BOOT).toContain(`'${STORAGE_KEYS.settings}'`);
	});

	it('index.html에는 넣을 자리만 있다 (빌드가 이 스크립트로 바꾼다)', () => {
		const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
		expect(html).toContain('<!--theme-boot-->');
		expect(html).not.toContain('theme-boot.js');
	});
});
