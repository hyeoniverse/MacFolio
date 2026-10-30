import { useRemoteText } from '@/shared/hooks/useRemoteText';
import { fileNameOf } from '@/shared/lib/fileApps';
import './FilePage.css';

/**
 * 글에 올린 HTML 파일을 페이지로 보인다 (메모의 첨부 파일 링크를 누르면 Safari의 새 탭으로 온다).
 * 받은 HTML을 sandbox iframe의 srcdoc으로 그린다: 스크립트·양식 제출·같은 출처 접근을 모두 막아, 파일 안의 코드가 사이트를 건드리지 못한다.
 * 링크는 새 창으로만 열 수 있다(allow-popups)
 */
const FilePage = ({ url }: { url: string }) => {
	const { text, error } = useRemoteText(url);
	const name = fileNameOf(url);
	return (
		<section className="safari-file" aria-label={name}>
			{error ? (
				<p className="safari-file-status">파일을 불러오지 못했습니다.</p>
			) : text === null ? (
				<p className="safari-file-status">불러오는 중…</p>
			) : (
				<iframe className="safari-file-frame" title={name} sandbox="allow-popups" srcDoc={text} />
			)}
		</section>
	);
};

export default FilePage;
