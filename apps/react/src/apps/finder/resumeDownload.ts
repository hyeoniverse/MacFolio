// 이력서 PDF 내려받기. 누르는 순간의 이력서 Markdown(관리자가 저장한 것, 없으면 기본 이력서)으로 브라우저에서 PDF를 만든다.
// react-pdf와 글꼴은 커서 처음 누를 때 불러온다 (사이트 첫 화면에는 싣지 않는다).
import { env } from '@/shared/config/env';
import { getProfile, githubLogin } from '@/shared/site/profileStore';
import { getResume } from '@/shared/site/resumeStore';
import { parseResume } from './resumeModel';

/**
 * 사진을 data: 주소로 (PDF 안에 넣는다). fetch는 CSP(connect-src)가 GitHub를 막으므로 그림으로 불러와 canvas로 옮긴다.
 * GitHub 사진을 못 받으면 사이트에 있는 사진(GitHub 앱과 같은 대체), 그것도 안 되면 사진 없이 만든다
 */
function photoData(src: string): Promise<string | undefined> {
	return new Promise((resolve) => {
		const image = new Image();
		image.crossOrigin = 'anonymous';
		const timer = setTimeout(() => resolve(undefined), 4000);
		image.onload = () => {
			clearTimeout(timer);
			try {
				const canvas = document.createElement('canvas');
				canvas.width = image.naturalWidth;
				canvas.height = image.naturalHeight;
				canvas.getContext('2d')!.drawImage(image, 0, 0);
				resolve(canvas.toDataURL('image/png'));
			} catch {
				resolve(undefined);
			}
		};
		image.onerror = () => {
			clearTimeout(timer);
			resolve(undefined);
		};
		image.src = src;
	});
}

/** GitHub 프로필 사진 (주소 바꿈 없이 CORS로 받는 주소), 안 되면 사이트의 사진 */
const ownerPhoto = async (login: string) =>
	(login ? await photoData(`https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=280`) : undefined) ??
	(await photoData(`${env.imageUrl}/me.png`));

/** 이력서 PDF를 만들어 '<이름>_이력서.pdf'로 내려받는다 (사진은 프로필의 GitHub 사진) */
export async function downloadResume(): Promise<void> {
	const profile = getProfile();
	const resume = parseResume(getResume());
	const [{ pdf }, { resumeDocument }, photo] = await Promise.all([
		import('@react-pdf/renderer'),
		import('./ResumePdf'),
		ownerPhoto(githubLogin(profile)),
	]);
	const blob = await pdf(resumeDocument({ resume, photo })).toBlob();
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${resume.name || profile.name}_이력서.pdf`;
	// 문서에 붙여서 누른다 (Firefox는 떨어진 링크를 누르지 않는다)
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
