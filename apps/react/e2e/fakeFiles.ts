// 문서 파일(R2)을 흉내 낸다: 시험용 파일 목록을 넣고 /files/*를 작은 PDF·PNG로 답한다. 실제 파일은 쓰지 않는다
import { deflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';
import type { DocumentEntry } from '../src/apps/finder/documents';

export const FAKE_DOCUMENTS: DocumentEntry[] = [
	{ folder: '이력서', name: '시험 이력서.pdf', key: 'resume/test.pdf', kind: 'pdf', size: 2048, updated: '2026-10-01' },
	{ folder: '포트폴리오', name: '시험 그림.png', key: 'portfolio/test.png', kind: 'image', updated: '2026-09-01' },
	// 프로젝트 폴더 (Finder › 프로젝트 › MacFolio)에 올린 발표 자료
	{ folder: 'project:macfolio', name: 'MacFolio 발표.pdf', key: 'projects/macfolio/slides.pdf', kind: 'pdf' },
];

/** 세 쪽짜리 PDF. 쪽마다 "MacFolio test PDF" 와 "Page N" (찾기 시험: "page"는 쪽마다 하나) */
export function tinyPdf(pages = 3): Buffer {
	const font = 3 + pages * 2;
	const objects: string[] = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		`<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages} >>`,
	];
	for (let i = 0; i < pages; i++) {
		const stream = `BT /F1 18 Tf 40 120 Td (MacFolio test PDF) Tj 0 -40 Td (Page ${i + 1}) Tj ET`;
		objects.push(
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`,
			`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
		);
	}
	objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
	let pdf = '%PDF-1.4\n';
	const offsets = objects.map((body, i) => {
		const offset = pdf.length;
		pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
		return offset;
	});
	const xref = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return Buffer.from(pdf, 'latin1');
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc32 = (data: Buffer) => {
	let c = 0xffffffff;
	for (const byte of data) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
};

/** 가로 160 × 세로 100 PNG (위는 하늘색, 아래는 초록) */
export function tinyPng(width = 160, height = 100): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header.set([8, 2, 0, 0, 0], 8);
	const rows = Buffer.alloc((width * 3 + 1) * height);
	for (let y = 0; y < height; y++) {
		const color = y < height * 0.6 ? [159, 211, 255] : [63, 163, 107];
		for (let x = 0; x < width; x++) rows.set(color, y * (width * 3 + 1) + 1 + x * 3);
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(rows)),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

/** 시험용 파일 목록을 넣고, /files/*에 답한다. 받은 주소를 돌려준다 */
export async function fakeFiles(page: Page, documents: DocumentEntry[] = FAKE_DOCUMENTS): Promise<string[]> {
	const requests: string[] = [];
	await page.addInitScript((list) => {
		window.__MACFOLIO_DOCUMENTS__ = list;
	}, documents);
	await page.route('**/files/**', (route) => {
		const url = new URL(route.request().url());
		requests.push(url.pathname + url.search);
		const pdf = url.pathname.endsWith('.pdf');
		return route.fulfill({
			status: 200,
			contentType: pdf ? 'application/pdf' : 'image/png',
			headers: {
				'content-disposition': url.searchParams.get('download') === '1' ? 'attachment' : 'inline',
				'content-security-policy':
					"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'",
			},
			body: pdf ? tinyPdf() : tinyPng(),
		});
	});
	return requests;
}
