import { describe, expect, it } from 'vitest';
import { blankProject } from '@macfolio/desktop-core/site';
import { formatPeriod, languageOptions, parsePeriod, stackOptions, suggest } from './projectInputs';

describe('기간', () => {
	it('프로젝트에 적힌 기간을 읽는다 (날짜 둘, 끝 대신 글, 끝을 모름)', () => {
		expect(parsePeriod('2024.12.26 – 2025.02.05')).toEqual({ start: '2024-12-26', end: '2025-02-05', ongoing: '' });
		expect(parsePeriod('2026.02.05 – 운영 중')).toEqual({ start: '2026-02-05', end: '', ongoing: '운영 중' });
		expect(parsePeriod('2024.10.22 –')).toEqual({ start: '2024-10-22', end: '', ongoing: '' });
		expect(parsePeriod('2024.6.1 - 2024.6.24')).toEqual({ start: '2024-06-01', end: '2024-06-24', ongoing: '' });
		expect(parsePeriod(undefined)).toEqual({ start: '', end: '', ongoing: '' });
	});

	it('날짜 모양이 아니면 null (글로 고친다)', () => {
		expect(parsePeriod('Week 01–15')).toBeNull();
		expect(parsePeriod('2024년 여름')).toBeNull();
	});

	it('같은 모양으로 쓴다. 시작이 없으면 비운다', () => {
		expect(formatPeriod({ start: '2024-12-26', end: '2025-02-05', ongoing: '' })).toBe('2024.12.26 – 2025.02.05');
		expect(formatPeriod({ start: '2026-02-05', end: '', ongoing: '운영 중' })).toBe('2026.02.05 – 운영 중');
		expect(formatPeriod({ start: '2024-10-22', end: '', ongoing: '' })).toBe('2024.10.22 –');
		expect(formatPeriod({ start: '', end: '2025-01-01', ongoing: '' })).toBeUndefined();
	});
});

describe('자동완성 후보', () => {
	const projects = [
		{ ...blankProject('a'), language: 'TypeScript', stack: ['React', 'Vite', 'Firebase'] },
		{ ...blankProject('b'), language: 'JavaScript', stack: ['React', 'Express'] },
	];

	it('언어: 프로젝트들이 쓴 언어 먼저, 겹치지 않게', () => {
		const options = languageOptions(projects);
		expect(options.slice(0, 2)).toEqual(['TypeScript', 'JavaScript']);
		expect(options.filter((option) => option === 'TypeScript')).toHaveLength(1);
		expect(options).toContain('Python');
		expect(options.length).toBeGreaterThan(40);
	});

	it('기술: 많이 쓴 것부터, 다룰 수 있는 기술도, 그다음 자주 쓰는 기술 (겹치지 않게)', () => {
		const options = stackOptions(projects, ['Three.js']);
		expect(options.slice(0, 5)).toEqual(['React', 'Express', 'Firebase', 'Three.js', 'Vite']);
		expect(options.length).toBeGreaterThan(100);
		expect(options.filter((option) => option.toLowerCase() === 'react')).toHaveLength(1);
		expect(options).toContain('PostgreSQL');
	});

	it('친 글자로 고른다: 앞이 맞는 것 먼저, 이미 고른 것은 빼고, 대소문자 무시', () => {
		const options = ['React', 'React Query', 'Preact', 'Vite', 'Redux'];
		expect(suggest(options, 're')).toEqual(['React', 'React Query', 'Redux', 'Preact']);
		expect(suggest(options, 'RE', ['react'])).toEqual(['React Query', 'Redux', 'Preact']);
		expect(suggest(options, '', ['Vite'], 2)).toEqual(['React', 'React Query']);
	});
});
