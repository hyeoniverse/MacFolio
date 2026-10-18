// PDF 읽기 (pdf.js). 미리보기 창을 처음 열 때만 불러온다 (라이브러리와 작업 스크립트가 크다).
// 같은 파일은 한 번만 연다 (사이드바의 작은 쪽 그림과 본문이 같은 문서를 쓴다)
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

let library: Promise<typeof import('pdfjs-dist')> | null = null;

/**
 * pdf.js와 작업 스크립트(worker). 작업 스크립트는 같은 출처의 파일이라 CSP worker-src 'self'로 된다.
 * 기본 빌드는 아주 새 문법(Map.getOrInsertComputed 등)을 써서 Safari·조금 오래된 Chrome에서 깨지므로 legacy 빌드를 쓴다
 */
function pdfjs() {
	library ??= Promise.all([
		import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<typeof import('pdfjs-dist')>,
		import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
	]).then(([lib, worker]) => {
		lib.GlobalWorkerOptions.workerSrc = worker.default;
		return lib;
	});
	return library;
}

const documents = new Map<string, Promise<PDFDocumentProxy>>();

/** 주소의 PDF를 연다. 실패하면 다음에 다시 시도할 수 있게 잊는다 */
export function loadPdf(url: string): Promise<PDFDocumentProxy> {
	let doc = documents.get(url);
	if (!doc) {
		doc = pdfjs().then((lib) => lib.getDocument({ url }).promise);
		doc.catch(() => documents.delete(url));
		documents.set(url, doc);
	}
	return doc;
}

export { pdfjs };

/** 글자 조각 (글자 층의 span 하나와 짝) */
export const textItems = (content: TextContent): string[] =>
	content.items.filter((item): item is TextItem => 'str' in item).map((item) => item.str);

/** 글 안에서 찾는 말이 나오는 자리들 (대소문자 무시) */
export function occurrences(text: string, query: string): number[] {
	const needle = query.toLocaleLowerCase();
	if (!needle) return [];
	const haystack = text.toLocaleLowerCase();
	const found: number[] = [];
	for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) found.push(at);
	return found;
}

/** 쪽마다 찾은 개수. 찾기는 글자 조각 안에서만 한다 (조각을 넘는 말은 화면 칠하기와 맞지 않아 세지 않는다) */
export async function countMatches(doc: PDFDocumentProxy, query: string): Promise<number[]> {
	const counts: number[] = [];
	for (let n = 1; n <= doc.numPages; n++) {
		const page = await doc.getPage(n);
		const items = textItems(await page.getTextContent());
		counts.push(items.reduce((sum, str) => sum + occurrences(str, query).length, 0));
	}
	return counts;
}
