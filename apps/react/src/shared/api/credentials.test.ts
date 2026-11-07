import { describe, expect, it } from 'vitest';
import { credentialsFor } from './credentials';

const API = 'https://macfolio-api.hyeoniverse.com';

describe('credentialsFor', () => {
	it('배포 사이트는 API와 사이트가 같아 쿠키를 붙인다', () => {
		expect(credentialsFor('macfolio.hyeoniverse.com', API)).toBe('include');
	});

	it('PR 미리보기(workers.dev)는 사이트가 달라 쿠키 없이 읽는다: 서버가 Allow-Credentials를 보내지 않는 주소', () => {
		expect(credentialsFor('feat-x-macfolio.hyeoniverse.workers.dev', API)).toBe('omit');
	});

	it('로컬 개발(localhost, IP)은 쿠키를 붙인다', () => {
		expect(credentialsFor('localhost', 'http://localhost:4000')).toBe('include');
		expect(credentialsFor('127.0.0.1', 'http://localhost:4000')).toBe('include');
		expect(credentialsFor('localhost', API)).toBe('include');
	});

	it('API 주소를 해석하지 못하면 기존처럼 쿠키를 붙인다', () => {
		expect(credentialsFor('macfolio.hyeoniverse.com', 'not a url')).toBe('include');
	});
});
