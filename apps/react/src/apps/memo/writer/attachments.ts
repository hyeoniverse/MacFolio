// 글에 넣는 이미지와 첨부 파일의 모양 (한도, 제목, 파일 이름). 올리는 것은 attachmentsApi.ts

/** API의 한 파일 한도와 같다 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface Uploaded {
	id: string;
	name: string;
	type: string;
	size: number;
	/** 브라우저가 바로 보여 줄 수 있는 이미지인지 (API가 파일 내용으로 판단) */
	image: boolean;
	/** 본문에 넣을 주소 */
	url: string;
}

/** 1.2 MB, 340 KB, 12 B */
export function formatBytes(size: number): string {
	if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
	if (size >= 1024) return `${Math.round(size / 1024)} KB`;
	return `${size} B`;
}

/** 첨부 파일 링크의 제목. 읽기·편집 화면의 CSS가 이 글자로 첨부 파일을 알아본다 (a[title^='첨부 파일']) */
export const ATTACHMENT_TITLE = '첨부 파일';
export const attachmentTitle = (size: number) => `${ATTACHMENT_TITLE} · ${formatBytes(size)}`;

/** 파일 이름에서 확장자를 뺀 것 (이미지 설명의 기본값) */
export const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || name;
