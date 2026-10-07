import { describe, expect, it } from 'vitest';
import { gradientStart, isDarkColor, parseColor, toneFor } from './statusBarTone';

describe('parseColor', () => {
	it('#rgb, #rrggbb, rgb(), rgba()', () => {
		expect(parseColor('#fff')).toEqual([255, 255, 255]);
		expect(parseColor('#3b82f6')).toEqual([59, 130, 246]);
		expect(parseColor('rgb(35, 31, 32)')).toEqual([35, 31, 32]);
		expect(parseColor('rgba(248, 246, 240, 1)')).toEqual([248, 246, 240]);
	});

	it('투명하거나 읽을 수 없는 색은 null', () => {
		expect(parseColor('rgba(0, 0, 0, 0)')).toBeNull();
		expect(parseColor('transparent')).toBeNull();
	});
});

describe('isDarkColor', () => {
	it('어두운 막대(파랑, 검정) 위에는 흰 글자', () => {
		expect(isDarkColor('#3b82f6')).toBe(true);
		expect(isDarkColor('#231f20')).toBe(true);
	});

	it('밝은 막대(흰색, 미색, 옅은 청록) 위에는 검은 글자', () => {
		expect(isDarkColor('#ffffff')).toBe(false);
		expect(isDarkColor('#f8f6f0')).toBe(false);
		expect(isDarkColor('#b8efed')).toBe(false);
	});
});

describe('toneFor', () => {
	it('밑의 바탕이 밝으면 검은 글자(dark), 어두우면 흰 글자(light)', () => {
		expect(toneFor(['rgb(255, 255, 255)', '#f3f4f6', '#ffffff'])).toBe('dark');
		expect(toneFor(['#3b82f6', '#3b82f6', '#3b82f6'])).toBe('light');
		expect(toneFor(['rgb(28, 28, 30)', null, 'rgb(28, 28, 30)'])).toBe('light');
	});

	it('여러 곳을 읽으면 평균으로 (대부분 어두우면 흰 글자)', () => {
		expect(toneFor(['#000000', '#000000', '#ffffff'])).toBe('light');
	});

	it('읽은 색이 없거나 모두 투명이면 null (앱의 기본을 쓴다)', () => {
		expect(toneFor([null, null])).toBeNull();
		expect(toneFor(['rgba(0, 0, 0, 0)'])).toBeNull();
	});
});

describe('gradientStart', () => {
	it('그라데이션의 첫 색 (사진 위의 어두운 띠)', () => {
		expect(gradientStart('linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.32) 60%, rgba(0, 0, 0, 0))')).toBe(
			'rgba(0, 0, 0, 0.62)'
		);
	});

	it('그라데이션이 아니면 null', () => {
		expect(gradientStart('none')).toBeNull();
		expect(gradientStart('url("a.png")')).toBeNull();
	});
});
