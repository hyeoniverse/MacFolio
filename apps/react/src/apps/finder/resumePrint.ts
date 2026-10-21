// 이력서 PDF. Finder 창을 찍지 않고, 프로필·프로젝트·이력서 데이터로 인쇄 전용 HTML을 만들어 보이지 않는 iframe에서 인쇄한다.
// 앱의 화면 모드(다크면 글자가 흰색)와 창 배치에 휘둘리지 않도록, 문서와 스타일을 iframe 안에 따로 둔다.
// 인쇄 전용 문서라 색과 크기는 앱의 토큰이 아니라 종이(A4, pt) 기준 값을 그대로 쓴다.
import { PROJECTS, type Project } from '@/shared/profile';
import { RESUME, type ResumeContent } from '@/shared/profile/resume';
import { getProfile, photoUrl, type SiteProfile } from '@/shared/site/profileStore';

const FRAME_ID = 'resume-print-frame';

const escape = (value: string) =>
	value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** 주소에서 앞의 https://, www.를 뗀 보기용 글자 */
const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

const CSS = `
@font-face { font-family: 'Resume Sans'; font-weight: 400; src: url('/fonts/AppleSDGothicNeoR.ttf'); }
@font-face { font-family: 'Resume Sans'; font-weight: 500; src: url('/fonts/AppleSDGothicNeoM.ttf'); }
@font-face { font-family: 'Resume Sans'; font-weight: 600; src: url('/fonts/AppleSDGothicNeoSB.ttf'); }
@font-face { font-family: 'Resume Sans'; font-weight: 700; src: url('/fonts/AppleSDGothicNeoB.ttf'); }
@page { size: A4; margin: 14mm 16mm 13mm; }
:root { --ink: #16181d; --body: #3a3d44; --muted: #80838b; --line: #e6e7eb; --accent: #2563eb; --tint: #f2f6ff; color-scheme: light; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; }
body { font-family: 'Resume Sans', -apple-system, 'Apple SD Gothic Neo', sans-serif; color: var(--body); font-size: 9.8pt; line-height: 1.6; word-break: keep-all; letter-spacing: -0.01em; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
a { color: inherit; text-decoration: none; }
b { color: var(--ink); font-weight: 600; }
header { display: flex; gap: 20px; align-items: center; }
.photo { flex: none; width: 88px; height: 88px; border-radius: 50%; background: var(--tint); object-fit: cover; }
.role { font-size: 9.5pt; font-weight: 600; color: var(--accent); }
h1 { margin: 0; font-size: 21pt; font-weight: 700; color: var(--ink); line-height: 1.25; }
h1 small { margin-left: 8px; font-size: 10pt; font-weight: 500; color: var(--muted); }
.motto { margin: 3px 0 0; font-size: 12.5pt; font-weight: 600; color: var(--ink); }
.contact { margin-top: 6px; font-size: 8.8pt; color: var(--muted); }
.contact span + span::before { content: '|'; margin: 0 7px; color: #ccc; }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
.card { padding: 10px 12px; background: var(--tint); border-radius: 8px; }
.card b { display: block; font-size: 10.3pt; color: var(--accent); }
.card p { margin: 3px 0 0; font-size: 8.9pt; line-height: 1.5; }
section { margin-top: 22px; }
h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font-size: 12pt; font-weight: 700; color: var(--ink); break-after: avoid; }
h2::after { content: ''; flex: 1; height: 1px; background: var(--line); }
.skills { display: grid; grid-template-columns: 92px 1fr; row-gap: 6px; column-gap: 12px; margin: 0; }
.skills dt { font-weight: 700; color: var(--ink); }
.skills dd { margin: 0; }
.skills small { display: block; font-size: 8.5pt; color: var(--muted); }
.proj { padding-left: 12px; margin-bottom: 20px; border-left: 3px solid var(--accent); break-inside: avoid; }
.ph { display: flex; align-items: baseline; gap: 8px; }
h3 { margin: 0; font-size: 12pt; font-weight: 700; color: var(--ink); }
.tag { font-size: 8.8pt; color: var(--muted); }
.when { margin-left: auto; font-size: 9pt; font-weight: 600; color: var(--ink); white-space: nowrap; font-variant-numeric: tabular-nums; }
.one { margin: 2px 0 0; }
.url { margin-left: 4px; font-size: 8.8pt; color: var(--accent); white-space: nowrap; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.chips span { padding: 0 7px; font-size: 8pt; line-height: 1.75; color: #4b5563; background: #f1f2f4; border-radius: 4px; }
.proj ul { margin: 8px 0 0; padding: 0; list-style: none; }
.proj li { position: relative; margin: 5px 0; padding-left: 12px; }
.proj li::before { content: ''; position: absolute; left: 0; top: 0.7em; width: 4px; height: 4px; border-radius: 50%; background: #b5b8bf; }
.proj li b { margin-right: 4px; }
.mini { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; break-inside: avoid; }
.mini div { padding: 9px 12px; border: 1px solid var(--line); border-radius: 8px; }
.mini h4 { display: flex; gap: 8px; margin: 0; font-size: 10pt; color: var(--ink); }
.mini h4 span { margin-left: auto; font-size: 8.5pt; font-weight: 500; color: var(--muted); }
.mini p { margin: 3px 0 0; font-size: 8.9pt; line-height: 1.5; }
.row { display: flex; align-items: baseline; gap: 12px; padding: 4px 0; break-inside: avoid; }
.row .when { font-weight: 500; color: var(--muted); }
.row small { display: block; font-size: 8.8pt; color: var(--muted); }
`;

/** 이력서 인쇄용 HTML 문서. 숨기거나 지운 프로젝트(PROJECTS에 없는 id)는 건너뛴다. 순수 함수 */
export function resumeHtml(
	profile: SiteProfile,
	projects: readonly Project[],
	resume: ResumeContent,
	/** 연락처 줄에 보일 사이트 주소 (예: macfolio.hyeoniverse.com) */
	site: string,
	photo?: string
): string {
	const e = escape;
	const byId = new Map(projects.map((project) => [project.id, project]));
	const featured = resume.featured.flatMap(({ id, bullets }) => {
		const project = byId.get(id);
		if (!project) return [];
		const link = project.demo ? `<a class="url" href="${e(project.demo)}">${e(bare(project.demo))} ↗</a>` : '';
		return [
			`<article class="proj">
	<div class="ph"><h3>${e(project.name)}</h3><span class="tag">${e(project.context)}</span><span class="when">${e(project.period ?? '')}</span></div>
	<p class="one">${e(project.description)} ${link}</p>
	<div class="chips">${project.stack.map((tool) => `<span>${e(tool)}</span>`).join('')}</div>
	<ul>${bullets.map((bullet) => `<li><b>${e(bullet.title)}</b> ${e(bullet.detail)}</li>`).join('')}</ul>
</article>`,
		];
	});
	const minor = resume.minor.flatMap(({ id, line }) => {
		const project = byId.get(id);
		return project
			? [`<div><h4>${e(project.name)}<span>${e(project.period ?? '')}</span></h4><p>${e(line)}</p></div>`]
			: [];
	});
	const rows = (items: ResumeContent['awards']) =>
		items
			.map(
				(item) =>
					`<div class="row"><span><b>${e(item.title)}</b>${item.detail ? `<small>${e(item.detail)}</small>` : ''}</span><span class="when">${e(item.period)}</span></div>`
			)
			.join('');

	return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${e(profile.name)}_이력서</title>
<style>${CSS}</style>
</head>
<body>
<header>
	${photo ? `<img class="photo" src="${e(photo)}" alt="" />` : ''}
	<div>
		<div class="role">${e(resume.role)}</div>
		<h1>${e(profile.name)}${profile.nameEn ? `<small>${e(profile.nameEn)}</small>` : ''}</h1>
		<p class="motto">${e(resume.motto)}</p>
		<div class="contact"><span>${e(profile.email)}</span><span>${e(bare(profile.github))}</span><span>${e(site)}</span></div>
	</div>
</header>
<div class="cards">${resume.strengths.map((item) => `<div class="card"><b>${e(item.title)}</b><p>${e(item.detail)}</p></div>`).join('')}</div>
<section>
	<h2>할 수 있는 일</h2>
	<dl class="skills">${resume.capabilities.map((item) => `<dt>${e(item.area)}</dt><dd>${e(item.detail)}<small>${e(item.tools.join(' · '))}</small></dd>`).join('')}</dl>
</section>
<section>
	<h2>프로젝트</h2>
	${featured.join('\n')}
	${minor.length ? `<div class="mini">${minor.join('')}</div>` : ''}
</section>
<section><h2>수상 · 자격 · 어학</h2>${rows(resume.awards)}</section>
<section><h2>교육</h2>${rows(resume.education)}</section>
</body>
</html>`;
}

/**
 * 이력서를 인쇄한다 (브라우저 인쇄 창에서 'PDF로 저장'). 보이지 않는 iframe에 문서를 쓰고, 글꼴·그림을 다 불러온 뒤 인쇄한다.
 * iframe은 다음 인쇄 때 바꾼다: 휴대폰 브라우저는 인쇄 창이 떠 있는 동안 문서가 남아 있어야 한다
 */
export function printResume(html: string): void {
	document.getElementById(FRAME_ID)?.remove();
	const frame = document.createElement('iframe');
	frame.id = FRAME_ID;
	frame.title = '이력서 인쇄';
	frame.setAttribute('aria-hidden', 'true');
	frame.tabIndex = -1;
	Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0', opacity: '0' });
	document.body.append(frame);

	const doc = frame.contentDocument!;
	doc.open();
	doc.write(html);
	doc.close();

	const images = [...doc.images].map((image) =>
		image.complete
			? Promise.resolve()
			: new Promise((done) => {
					image.addEventListener('load', done, { once: true });
					image.addEventListener('error', done, { once: true });
				})
	);
	// 그림이 끝내 오지 않아도(주소 막힘 등) 인쇄는 한다
	const loaded = Promise.race([
		Promise.all([doc.fonts.ready, ...images]),
		new Promise((done) => setTimeout(done, 3000)),
	]);
	void loaded.then(() => {
		frame.contentWindow?.focus();
		frame.contentWindow?.print();
	});
}

/** 지금 데이터(관리자가 고친 프로필·프로젝트 포함)로 이력서를 인쇄한다. Finder와 휴대폰 파일 앱의 'PDF로 저장' */
export const printCurrentResume = () => {
	const profile = getProfile();
	printResume(resumeHtml(profile, PROJECTS, RESUME, location.host, photoUrl(profile)));
};
