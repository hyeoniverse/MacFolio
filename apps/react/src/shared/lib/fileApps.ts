// 글에 올린 첨부 파일을 사이트 안의 어느 앱으로 여는지 (macOS에서 파일을 열면 종류에 맞는 앱이 뜨듯).
// 확장자로 정한다: 올린 파일의 주소(/files/<id>)에는 확장자가 없어 파일 이름을 본다

/** 첨부 파일을 여는 앱 */
export type FileApp =
	/** 미리보기: PDF는 쪽을 그리고, 그림은 크게 본다 */
	| { app: 'preview'; kind: 'pdf' | 'image' }
	/** 텍스트 편집기: Markdown은 서식대로, 나머지 글자 파일은 고정폭 그대로 */
	| { app: 'textedit'; markdown: boolean }
	/** Safari: HTML 문서를 페이지로 */
	| { app: 'safari' };

const IMAGES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg']);
const MARKDOWN = new Set(['md', 'markdown']);
const TEXT = new Set(['txt', 'text', 'log', 'csv', 'tsv', 'json', 'yaml', 'yml', 'xml', 'toml', 'ini']);
const HTML = new Set(['html', 'htm']);

/** 파일 이름의 확장자로 여는 앱을 정한다. 사이트 안에 맞는 앱이 없으면 null (내려받는다) */
export function fileAppOf(name: string): FileApp | null {
	const extension = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1]?.toLowerCase();
	if (!extension) return null;
	if (extension === 'pdf') return { app: 'preview', kind: 'pdf' };
	if (IMAGES.has(extension)) return { app: 'preview', kind: 'image' };
	if (MARKDOWN.has(extension)) return { app: 'textedit', markdown: true };
	if (TEXT.has(extension)) return { app: 'textedit', markdown: false };
	if (HTML.has(extension)) return { app: 'safari' };
	return null;
}

/** Safari가 첨부 파일 탭으로 여는 요청의 id 앞머리 (프로젝트 id와 겹치지 않게) */
export const FILE_TAB_PREFIX = 'file:';

/** 텍스트 편집기·Safari가 주소만 받고도 파일 이름을 보이게, 연 첨부 파일의 이름을 기억한다 (탭이 닫혀도 같은 탭 안에서는 남는다) */
const names = new Map<string, string>();

export const rememberFileName = (url: string, name: string) => void names.set(url, name);

/** 주소로 연 파일의 이름. 기억한 것이 없으면 주소의 마지막 조각 */
export const fileNameOf = (url: string) =>
	names.get(url) ?? decodeURIComponent(url.split(/[?#]/)[0].split('/').at(-1) ?? url);

/** 텍스트 편집기·Safari가 연 것이 저장소 문서·프로젝트가 아니라 주소로 받은 파일인지 */
export const isRemoteFile = (path: string) => /^https?:\/\//.test(path);
