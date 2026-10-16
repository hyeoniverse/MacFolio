import { describe, expect, it } from 'vitest';
import { blend, gradientStart, imageRect, isDarkColor, parseColor, toneFor } from './statusBarTone';

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

	it('대비가 큰 쪽: iOS 파랑 위는 흰색, 베이지·회갈색 배경화면 위는 검은색 (휘도 0.4가 아니라 대비로 가른다)', () => {
		expect(toneFor(['#3b82f6'])).toBe('light');
		expect(toneFor(['#2f7fd1'])).toBe('light');
		// 셀로시아 배경화면 왼쪽 위 같은 회갈색: 흰 글자는 대비 3 언저리, 검은 글자는 5 넘게
		expect(toneFor(['rgb(165, 148, 135)'])).toBe('dark');
		expect(toneFor(['#b8efed'])).toBe('dark');
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

describe('imageRect', () => {
	it('cover: 상자를 꽉 채우고 넘친 쪽은 가운데로 자른다', () => {
		expect(imageRect({ width: 390, height: 844 }, { width: 1000, height: 1000 }, 'cover')).toEqual({
			x: -227,
			y: 0,
			width: 844,
			height: 844,
		});
	});

	it('contain: 상자 안에 다 들어가게 가운데에', () => {
		expect(imageRect({ width: 400, height: 200 }, { width: 100, height: 100 }, 'contain')).toEqual({
			x: 100,
			y: 0,
			width: 200,
			height: 200,
		});
	});

	it('그 밖(fill, auto 등)은 상자에 맞춰 늘인다', () => {
		expect(imageRect({ width: 300, height: 100 }, { width: 10, height: 10 }, 'fill')).toEqual({
			x: 0,
			y: 0,
			width: 300,
			height: 100,
		});
	});
});

describe('blend', () => {
	it('반투명한 유리 위젯은 밑의 색에 겹쳐 본다', () => {
		expect(blend([255, 255, 255], 0.22, [0, 0, 0])).toEqual([56, 56, 56]);
		expect(blend([0, 0, 0], 1, [255, 255, 255])).toEqual([0, 0, 0]);
	});
});
