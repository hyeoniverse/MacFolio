import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stripImageMetadata } from './metadata.js';
import { sniffImage } from './rules.js';

// test/fixtures: 4×2 그림에 EXIF(Orientation 6, 기기 이름, GPS 37°33′N 126°58′E)·XMP·주석을 넣은 것
const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../../test/fixtures/${name}`, import.meta.url)));
const text = (data: Uint8Array) => Buffer.from(data).toString('latin1');

/** JPEG 마커 목록 (SOS까지) */
function jpegMarkers(data: Uint8Array): string[] {
	const markers: string[] = [];
	for (let offset = 2; offset < data.length && data[offset] === 0xff;) {
		const marker = data[offset + 1];
		markers.push(marker.toString(16));
		if (marker === 0xda) break;
		offset += 2 + ((data[offset + 2] << 8) | data[offset + 3]);
	}
	return markers;
}

/** PNG 청크 이름 목록 */
function pngChunks(data: Uint8Array): string[] {
	const chunks: string[] = [];
	for (let offset = 8; offset + 12 <= data.length;) {
		const length = new DataView(data.buffer, data.byteOffset).getUint32(offset);
		chunks.push(text(data.subarray(offset + 4, offset + 8)));
		offset += 12 + length;
	}
	return chunks;
}

/** WebP 청크 이름 목록과 RIFF 머리에 적힌 크기 */
function webpChunks(data: Uint8Array): { chunks: string[]; riffSize: number; flags: number } {
	const view = new DataView(data.buffer, data.byteOffset);
	const chunks: string[] = [];
	let flags = 0;
	for (let offset = 12; offset + 8 <= data.length;) {
		const name = text(data.subarray(offset, offset + 4));
		chunks.push(name);
		if (name === 'VP8X') flags = data[offset + 8];
		const size = view.getUint32(offset + 4, true);
		offset += 8 + size + (size % 2);
	}
	return { chunks, riffSize: view.getUint32(4, true), flags };
}

describe('이미지 메타데이터 지우기', () => {
	it('JPEG: EXIF(GPS·기기)·XMP·주석을 빼고 방향(Orientation)만 남긴다', () => {
		const before = fixture('exif.jpg');
		expect(text(before)).toContain('TestCam');
		expect(jpegMarkers(before)).toEqual(['e0', 'e1', 'e1', 'fe', 'db', 'db', 'c0', 'c4', 'c4', 'c4', 'c4', 'da']);

		const after = stripImageMetadata(before, 'image/jpeg');
		expect(sniffImage(after)).toBe('image/jpeg');
		expect(after.length).toBeLessThan(before.length);
		expect(text(after)).not.toContain('TestCam');
		expect(text(after)).not.toContain('xpacket');
		expect(text(after)).not.toContain('hello');
		// 남긴 APP1은 Orientation 하나뿐 (마커 포함 36바이트), JFIF(APP0)와 그림 데이터는 그대로
		expect(jpegMarkers(after)).toEqual(['e1', 'e0', 'db', 'db', 'c0', 'c4', 'c4', 'c4', 'c4', 'da']);
		expect(text(after.subarray(2, 10))).toBe('\xff\xe1\0\x22Exif');
		expect(text(after.subarray(12, 16))).toBe('MM\0\x2a');
		expect(after[31]).toBe(6); // IFD 엔트리의 값 자리 (빅 엔디언 SHORT의 아래 바이트)
		expect(text(after.subarray(38, 42))).toBe('\xff\xe0\0\x10');
		// 그림 데이터는 같다
		const sos = (data: Uint8Array) => text(data).lastIndexOf('\xff\xda');
		expect(text(after).slice(sos(after))).toBe(text(before).slice(sos(before)));
	});

	it('JPEG: 방향이 1(정방향)이거나 없으면 APP1을 아예 두지 않는다', () => {
		const before = fixture('exif.jpg');
		// 픽스처의 Orientation 값(6)을 1로 바꾼다
		const flipped = new Uint8Array(before);
		const index = text(before).indexOf('\x01\x12\x00\x03\x00\x00\x00\x01\x00\x06');
		expect(index).toBeGreaterThan(0);
		flipped[index + 9] = 1;
		expect(jpegMarkers(stripImageMetadata(flipped, 'image/jpeg'))[0]).toBe('e0');
		// 메타데이터가 없는 JPEG는 그대로 (같은 객체)
		const clean = stripImageMetadata(before, 'image/jpeg');
		expect(stripImageMetadata(clean, 'image/jpeg')).toBe(clean);
	});

	it('PNG: eXIf·tEXt 같은 메타데이터 청크를 빼고 그림 청크는 둔다', () => {
		const before = fixture('exif.png');
		expect(pngChunks(before)).toEqual(['IHDR', 'tEXt', 'eXIf', 'IDAT', 'IEND']);
		const after = stripImageMetadata(before, 'image/png');
		expect(sniffImage(after)).toBe('image/png');
		expect(pngChunks(after)).toEqual(['IHDR', 'IDAT', 'IEND']);
		expect(text(after)).not.toContain('TestCam');
		expect(stripImageMetadata(after, 'image/png')).toBe(after);
	});

	it('WebP: EXIF·XMP 청크를 빼고, VP8X 깃발과 RIFF 크기를 맞춘다', () => {
		const before = fixture('exif.webp');
		expect(webpChunks(before)).toMatchObject({ chunks: ['VP8X', 'VP8 ', 'EXIF', 'XMP '], riffSize: before.length - 8 });
		expect(webpChunks(before).flags & 0x0c).toBe(0x0c);
		const after = stripImageMetadata(before, 'image/webp');
		expect(sniffImage(after)).toBe('image/webp');
		expect(webpChunks(after)).toEqual({ chunks: ['VP8X', 'VP8 '], riffSize: after.length - 8, flags: 0 });
		expect(text(after)).not.toContain('TestCam');
		expect(stripImageMetadata(after, 'image/webp')).toBe(after);
	});

	it('GIF와 구조가 이상한 파일은 그대로 둔다', () => {
		const gif = new TextEncoder().encode('GIF89a\0\0');
		expect(stripImageMetadata(gif, 'image/gif')).toBe(gif);
		const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x45]); // 길이가 파일을 넘는 APP1
		expect(stripImageMetadata(broken, 'image/jpeg')).toBe(broken);
		const shortPng = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 99, 0x65, 0x58, 0x49, 0x66,
		]);
		expect(stripImageMetadata(shortPng, 'image/png')).toBe(shortPng);
	});
});
