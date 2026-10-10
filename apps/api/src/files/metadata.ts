// 올린 이미지에서 메타데이터(EXIF·XMP·주석)를 지운다. 사진에는 찍은 곳(GPS)·기기·시각이 들어 있고,
// 올린 사람은 그것이 공개된다는 것을 모른다. 그림 자체와 색 정보(ICC)는 그대로 두고,
// JPEG의 방향(Orientation)만은 남긴다: 휴대폰 사진은 방향 값이 없으면 눕거나 뒤집혀 보인다.
// 의존성 없이 형식마다 구조를 따라가며 덜어 내고, 구조가 이상하면 손대지 않고 그대로 돌려준다.

const ORIENTATION_TAG = 0x0112;
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

/** 형식에 맞게 메타데이터를 지운 바이트. 지울 것이 없거나 구조를 읽을 수 없으면 원본 그대로 */
export function stripImageMetadata(data: Uint8Array, type: string): Uint8Array {
	try {
		if (type === 'image/jpeg') return stripJpeg(data);
		if (type === 'image/png') return stripPng(data);
		if (type === 'image/webp') return stripWebp(data);
	} catch {
		// 손상된 파일은 브라우저가 알아서 거른다. 여기서 막지는 않는다
	}
	return data;
}

const ascii = (data: Uint8Array, offset: number, length: number) =>
	String.fromCharCode(...data.subarray(offset, offset + length));
const concat = (parts: Uint8Array[]) => {
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let at = 0;
	for (const part of parts) {
		out.set(part, at);
		at += part.length;
	}
	return out;
};

// ── JPEG: 마커 단위. APP0(JFIF)·APP2(ICC)·APP14(Adobe)는 그림을 그리는 데 쓰이므로 두고, 나머지 APPn과 주석(COM)을 뺀다
const JPEG_KEEP = new Set([0xe0, 0xe2, 0xee]);

function stripJpeg(data: Uint8Array): Uint8Array {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const parts: Uint8Array[] = [data.subarray(0, 2)];
	let orientation: number | null = null;
	let offset = 2;
	let changed = false;
	while (offset + 4 <= data.length && data[offset] === 0xff) {
		const marker = data[offset + 1];
		if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
			parts.push(data.subarray(offset, offset + 2));
			offset += 2;
			continue;
		}
		const length = view.getUint16(offset + 2);
		const end = offset + 2 + length;
		if (marker === 0xda || end > data.length) break; // 그림 데이터(SOS)부터는 그대로
		const isMeta = (marker >= 0xe1 && marker <= 0xef && !JPEG_KEEP.has(marker)) || marker === 0xfe;
		if (marker === 0xe1 && length === ORIENTATION_SEGMENT_LENGTH - 2 && orientation === null) {
			// 이미 방향만 남긴 파일(전에 거친 것): 그대로 둔다
			orientation = readOrientation(data, offset + 4, end) ?? 1;
			parts.push(data.subarray(offset, end));
		} else if (isMeta) {
			if (marker === 0xe1 && orientation === null) orientation = readOrientation(data, offset + 4, end);
			changed = true;
		} else parts.push(data.subarray(offset, end));
		offset = end;
	}
	if (!changed) return data;
	if (orientation !== null && orientation !== 1) parts.splice(1, 0, orientationSegment(orientation));
	parts.push(data.subarray(offset));
	return concat(parts);
}

/** APP1 안의 TIFF에서 Orientation 값. Exif가 아니거나(XMP 등) 없으면 null */
function readOrientation(data: Uint8Array, start: number, end: number): number | null {
	if (!EXIF_HEADER.every((byte, index) => data[start + index] === byte)) return null;
	const tiff = start + EXIF_HEADER.length;
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const little = ascii(data, tiff, 2) === 'II';
	if (!little && ascii(data, tiff, 2) !== 'MM') return null;
	const ifd = tiff + view.getUint32(tiff + 4, little);
	if (ifd + 2 > end) return null;
	const count = view.getUint16(ifd, little);
	for (let index = 0; index < count; index++) {
		const entry = ifd + 2 + index * 12;
		if (entry + 12 > end) return null;
		if (view.getUint16(entry, little) === ORIENTATION_TAG && view.getUint16(entry + 2, little) === 3)
			return view.getUint16(entry + 8, little);
	}
	return null;
}

/** 마커(2)+길이(2)+Exif 머리(6)+TIFF 머리(8)+엔트리 수(2)+엔트리(12)+다음 IFD(4) */
const ORIENTATION_SEGMENT_LENGTH = 2 + 2 + EXIF_HEADER.length + 8 + 2 + 12 + 4;

/** Orientation 하나만 든 APP1 Exif 세그먼트 */
function orientationSegment(orientation: number): Uint8Array {
	const segment = new Uint8Array(ORIENTATION_SEGMENT_LENGTH);
	const view = new DataView(segment.buffer);
	segment.set([0xff, 0xe1]);
	view.setUint16(2, segment.length - 2);
	segment.set(EXIF_HEADER, 4);
	const tiff = 4 + EXIF_HEADER.length;
	segment.set([0x4d, 0x4d, 0x00, 0x2a], tiff); // "MM", 42
	view.setUint32(tiff + 4, 8); // 첫 IFD는 바로 뒤
	const ifd = tiff + 8;
	view.setUint16(ifd, 1);
	view.setUint16(ifd + 2, ORIENTATION_TAG);
	view.setUint16(ifd + 4, 3); // SHORT
	view.setUint32(ifd + 6, 1);
	view.setUint16(ifd + 10, orientation);
	view.setUint32(ifd + 14, 0); // 다음 IFD 없음
	return segment;
}

// ── PNG: 청크 단위. 그림과 무관한 메타데이터 청크만 뺀다 (PNG에는 방향 값이 없다)
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function stripPng(data: Uint8Array): Uint8Array {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const parts: Uint8Array[] = [data.subarray(0, 8)];
	let offset = 8;
	let changed = false;
	while (offset + 12 <= data.length) {
		const end = offset + 12 + view.getUint32(offset);
		if (end > data.length) return data;
		if (PNG_DROP.has(ascii(data, offset + 4, 4))) changed = true;
		else parts.push(data.subarray(offset, end));
		offset = end;
	}
	return changed ? concat(parts) : data;
}

// ── WebP: RIFF 청크 단위. 확장 형식(VP8X)일 때만 EXIF·XMP 청크가 있고, 머리의 깃발에도 적혀 있어 함께 지운다
const WEBP_DROP = new Set(['EXIF', 'XMP ']);
const WEBP_FLAG_EXIF = 0x08;
const WEBP_FLAG_XMP = 0x04;

function stripWebp(data: Uint8Array): Uint8Array {
	if (ascii(data, 12, 4) !== 'VP8X') return data; // 단순 형식에는 메타데이터 자리가 없다
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const parts: Uint8Array[] = [];
	let offset = 12;
	let changed = false;
	while (offset + 8 <= data.length) {
		const size = view.getUint32(offset + 4, true);
		const end = offset + 8 + size + (size % 2); // 홀수 크기는 한 바이트 채운다
		if (end > data.length) return data;
		const name = ascii(data, offset, 4);
		if (WEBP_DROP.has(name)) changed = true;
		else if (name === 'VP8X') {
			const header = new Uint8Array(data.subarray(offset, end));
			header[8] &= ~(WEBP_FLAG_EXIF | WEBP_FLAG_XMP);
			parts.push(header);
		} else parts.push(data.subarray(offset, end));
		offset = end;
	}
	if (!changed) return data;
	const body = concat(parts);
	const head = new Uint8Array(data.subarray(0, 12));
	new DataView(head.buffer).setUint32(4, 4 + body.length, true); // "WEBP" 네 글자 + 청크들
	return concat([head, body]);
}
