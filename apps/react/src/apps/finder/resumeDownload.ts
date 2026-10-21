// 이력서 PDF. 그때의 이력서 Markdown(관리자가 저장한 것, 없으면 기본 이력서)으로 브라우저에서 PDF를 만든다.
// 내려받기와, Finder › 이력서의 PDF 파일(미리보기 앱이 열 때마다 새로 만든다) 둘 다 여기서 만든다.
// react-pdf와 글꼴은 커서 처음 만들 때 불러온다 (사이트 첫 화면에는 싣지 않는다).
import { env } from '@/shared/config/env';
import { getProfile, githubLogin } from '@/shared/site/profileStore';
import { getResume, type ResumeLang } from '@/shared/site/resumeStore';
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

/** Finder › 이력서의 PDF 파일 키 (R2에 없는 만든 파일). 미리보기가 이 키를 보면 그때의 Markdown으로 PDF를 만든다 */
export const RESUME_PDF_KEYS: Record<ResumeLang, string> = { ko: 'resume-pdf:ko', en: 'resume-pdf:en' };

/** 만든 이력서 PDF의 키면 그 언어, 아니면 null */
export const resumePdfLang = (key: string): ResumeLang | null =>
	key === RESUME_PDF_KEYS.ko ? 'ko' : key === RESUME_PDF_KEYS.en ? 'en' : null;

/** 이력서 파일 이름 (확장자 없이): 국문 '<이름>_이력서', 영문 'Resume_<Name>'. Finder 문서·PDF와 내려받는 파일이 같이 쓴다 */
export const resumeFileName = (lang: ResumeLang, name: string) =>
	lang === 'en' ? `Resume_${name.replace(/\s+/g, '_')}` : `${name}_이력서`;

/** 이력서 PDF를 만든다 (사진은 프로필의 GitHub 사진) */
export async function resumePdfBlob(lang: ResumeLang = 'ko'): Promise<{ blob: Blob; name: string }> {
	const profile = getProfile();
	const resume = parseResume(getResume(lang));
	const [{ pdf }, { resumeDocument }, photo] = await Promise.all([
		import('@react-pdf/renderer'),
		import('./ResumePdf'),
		ownerPhoto(githubLogin(profile)),
	]);
	const blob = await pdf(resumeDocument({ resume, photo })).toBlob();
	return { blob, name: `${resumeFileName(lang, resume.name || profile.name)}.pdf` };
}

/** 이력서 PDF를 만들어 내려받는다 */
export async function downloadResume(lang: ResumeLang = 'ko'): Promise<void> {
	const { blob, name } = await resumePdfBlob(lang);
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	// 문서에 붙여서 누른다 (Firefox는 떨어진 링크를 누르지 않는다)
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
