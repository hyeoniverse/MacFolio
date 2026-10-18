import React, { useCallback, useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdf } from '@/apps/preview/pdf';
import PdfView from '@/apps/preview/PdfView';
import ImageView from '@/apps/preview/ImageView';
import '@/apps/preview/Preview.css';
import { fileUrl } from './documents';
import type { FileItem } from './files';

/**
 * 휴대폰 파일 앱의 문서 파일 보기 (iOS의 훑어보기처럼 앱 안에서 화면을 채운다). 데스크톱은 미리보기 앱(apps/preview)이 연다.
 * PDF는 미리보기 앱과 같은 pdf.js 보기로 쪽을 폭에 맞춰 세로로 잇고, 아래에 지금 쪽을 띄운다. 그림은 화면에 맞춘다.
 * 공유(다운로드·새 탭)는 위 오른쪽 버튼 (FinderMobile)
 */
const FileView: React.FC<{ item: FileItem }> = ({ item }) => {
	const [doc, setDoc] = useState<PDFDocumentProxy | 'error' | null>(null);
	const [page, setPage] = useState(1);
	useEffect(() => {
		if (item.kind !== 'pdf') return;
		let alive = true;
		loadPdf(fileUrl(item.key)).then(
			(loaded) => alive && setDoc(loaded),
			() => alive && setDoc('error')
		);
		return () => {
			alive = false;
		};
	}, [item.key, item.kind]);
	const ignoreScale = useCallback(() => undefined, []);

	if (item.kind === 'image')
		return (
			<div className="finder-file-phone">
				<ImageView fileKey={item.key} name={item.name} zoom={null} padding={16} />
			</div>
		);
	return (
		<div className="finder-file-phone">
			{doc === 'error' ? (
				<p className="preview-note">PDF를 열 수 없습니다.</p>
			) : doc ? (
				<>
					<PdfView
						doc={doc}
						zoom={null}
						padding={12}
						onScale={ignoreScale}
						onPage={setPage}
						query=""
						matchCounts={[]}
						activeMatch={-1}
						label={item.name}
					/>
					{doc.numPages > 1 && (
						<span className="finder-file-page" aria-live="polite">
							{page} / {doc.numPages}
						</span>
					)}
				</>
			) : (
				<p className="preview-note">여는 중…</p>
			)}
		</div>
	);
};

export default FileView;
