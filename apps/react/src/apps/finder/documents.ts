// 문서 파일 목록 (이슈 #20). 파일 자체는 저장소가 아니라 R2 버킷(macfolio-files)에 두고,
// 사이트가 같은 주소(/files/<key>)로 내준다 (apps/react/worker/files.ts). 여기에는 무엇을 어느 폴더에 보일지만 적는다.
// 올리는 방법: docs/deployment.md '문서 파일(R2)'. 올리기 전에 전화번호·주소·생년월일·주민등록번호 같은 번호를 지운다.

export const DOCUMENT_FOLDERS = ['이력서', '포트폴리오', '자격증'] as const;
export type DocumentFolder = (typeof DOCUMENT_FOLDERS)[number];

export interface DocumentEntry {
	/** 보일 폴더 (문서 안) */
	folder: DocumentFolder;
	/** 보이는 이름 (예: '이력서.pdf') */
	name: string;
	/** R2 키 (예: 'resume/resume.pdf'). 확장자는 pdf·png·jpg·jpeg·webp만 */
	key: string;
	kind: 'pdf' | 'image';
	/** 크기 (바이트, 보기용) */
	size?: number;
	/** 수정일 (YYYY-MM-DD) */
	updated?: string;
}

declare global {
	/** E2E 테스트가 넣는 시험용 파일 목록 (실제 파일 대신) */
	var __MACFOLIO_DOCUMENTS__: DocumentEntry[] | undefined;
}

/**
 * 공개하는 파일. 예:
 * { folder: '이력서', name: '이력서.pdf', key: 'resume/resume.pdf', kind: 'pdf', updated: '2026-10-18' },
 */
export const DOCUMENTS: DocumentEntry[] = [];

/** 지금 보일 파일 목록. 시험에서는 window.__MACFOLIO_DOCUMENTS__가 대신한다 */
export const documentEntries = (): DocumentEntry[] => globalThis.__MACFOLIO_DOCUMENTS__ ?? DOCUMENTS;

/** 파일 주소 (/files/<key>). download면 내려받기(attachment) */
export const fileUrl = (key: string, download = false) =>
	`/files/${key.split('/').map(encodeURIComponent).join('/')}${download ? '?download=1' : ''}`;

/** 크기 보기 (예: 1.2 MB) */
export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
