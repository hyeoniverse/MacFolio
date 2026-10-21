// 이력서 PDF 문서 (react-pdf). 누르는 순간의 프로필·프로젝트·이력서 데이터로 PDF를 바로 만들어 내려받는다 (resumeDownload.ts).
// 화면이 아니라 종이(A4, pt) 위에 그리는 문서라 색과 크기는 앱의 토큰이 아니라 인쇄 기준 값을 그대로 쓴다.
// 글자는 벡터로 들어가 확대해도 선명하고, 고르거나 찾을 수 있다. 글꼴은 쓴 글자만 담긴다.
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Project } from '@/shared/profile';
import type { ResumeContent, ResumeEntry } from '@/shared/profile/resume';
import type { SiteProfile } from '@/shared/site/profileStore';

const FAMILY = 'Resume Sans';
Font.register({
	family: FAMILY,
	fonts: [
		{ src: '/fonts/AppleSDGothicNeoR.ttf', fontWeight: 400 },
		{ src: '/fonts/AppleSDGothicNeoB.ttf', fontWeight: 700 },
	],
});
// 한글은 낱말 중간에서 줄을 나누지 않는다 (react-pdf의 기본 하이픈 나누기를 끈다)
Font.registerHyphenationCallback((word) => [word]);

const INK = '#16181d';
const BODY = '#3a3d44';
const MUTED = '#80838b';
const LINE = '#e6e7eb';
const ACCENT = '#2563eb';
const TINT = '#f2f6ff';

const s = StyleSheet.create({
	page: {
		paddingVertical: 40,
		paddingHorizontal: 44,
		fontFamily: FAMILY,
		fontSize: 9.5,
		lineHeight: 1.55,
		color: BODY,
	},
	header: { flexDirection: 'row', alignItems: 'center', gap: 18 },
	photo: { width: 74, height: 74, borderRadius: 37, backgroundColor: TINT, objectFit: 'cover' },
	role: { fontSize: 9, fontWeight: 700, color: ACCENT },
	name: { fontSize: 21, fontWeight: 700, color: INK, lineHeight: 1.25 },
	nameEn: { fontSize: 10, fontWeight: 400, color: MUTED },
	motto: { marginTop: 2, fontSize: 12, fontWeight: 700, color: INK },
	contact: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5, fontSize: 8.5, color: MUTED },
	cards: { flexDirection: 'row', gap: 7, marginTop: 14 },
	card: { flex: 1, padding: 9, backgroundColor: TINT, borderRadius: 6 },
	cardTitle: { fontSize: 10, fontWeight: 700, color: ACCENT },
	cardText: { marginTop: 2, fontSize: 8.5, lineHeight: 1.45 },
	section: { marginTop: 18 },
	heading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
	headingText: { fontSize: 12, fontWeight: 700, color: INK },
	headingRule: { flex: 1, height: 1, backgroundColor: LINE },
	skill: { flexDirection: 'row', marginBottom: 5 },
	skillArea: { width: 80, fontWeight: 700, color: INK },
	skillBody: { flex: 1 },
	tools: { fontSize: 8, color: MUTED },
	project: { marginBottom: 14, paddingLeft: 10, borderLeftWidth: 2.5, borderLeftColor: ACCENT },
	projectHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
	projectName: { fontSize: 11.5, fontWeight: 700, color: INK },
	tag: { flex: 1, fontSize: 8.5, color: MUTED },
	when: { fontSize: 8.5, fontWeight: 700, color: INK },
	url: { fontSize: 8.5, color: ACCENT, textDecoration: 'none' },
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4 },
	chip: {
		paddingHorizontal: 5,
		paddingVertical: 1,
		fontSize: 7.5,
		color: '#4b5563',
		backgroundColor: '#f1f2f4',
		borderRadius: 3,
	},
	bullets: { marginTop: 5 },
	bullet: { flexDirection: 'row', marginTop: 3 },
	dot: { width: 3.5, height: 3.5, marginTop: 5, marginRight: 7, borderRadius: 2, backgroundColor: '#b5b8bf' },
	bulletText: { flex: 1 },
	strong: { fontWeight: 700, color: INK },
	minors: { flexDirection: 'row', gap: 7 },
	minor: { flex: 1, padding: 8, borderWidth: 1, borderColor: LINE, borderRadius: 6 },
	minorHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
	minorName: { fontSize: 9.5, fontWeight: 700, color: INK },
	minorWhen: { fontSize: 8, color: MUTED },
	minorText: { marginTop: 2, fontSize: 8.5, lineHeight: 1.45 },
	row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
	rowDetail: { fontSize: 8.5, color: MUTED },
	rowWhen: { fontSize: 8.5, color: MUTED },
});

/** 주소에서 앞의 https://, www.를 뗀 보기용 글자 */
const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/** 절 제목과 오른쪽으로 이어지는 선 (요소를 돌려주는 함수: 이 파일은 컴포넌트를 내보내지 않는다) */
const heading = (text: string) => (
	<View style={s.heading} minPresenceAhead={40}>
		<Text style={s.headingText}>{text}</Text>
		<View style={s.headingRule} />
	</View>
);

/** 수상·교육 줄: 왼쪽 제목·설명, 오른쪽 날짜 */
const rows = (items: ResumeEntry[]) => (
	<>
		{items.map((item) => (
			<View key={item.title} style={s.row} wrap={false}>
				<View style={{ flex: 1 }}>
					<Text style={s.strong}>{item.title}</Text>
					{item.detail && <Text style={s.rowDetail}>{item.detail}</Text>}
				</View>
				<Text style={s.rowWhen}>{item.period}</Text>
			</View>
		))}
	</>
);

export interface ResumePdfProps {
	profile: SiteProfile;
	projects: readonly Project[];
	resume: ResumeContent;
	/** 연락처 줄에 보일 사이트 주소 (예: macfolio.hyeoniverse.com) */
	site: string;
	/** 사진 (data: 주소). 못 받았으면 없다 */
	photo?: string;
}

/**
 * 이력서 PDF 문서. 숨기거나 지운 프로젝트(PROJECTS에 없는 id)는 건너뛴다.
 * react-pdf의 pdf()는 <Document> 요소를 받으므로 컴포넌트가 아니라 요소를 돌려주는 함수로 둔다
 */
export function resumeDocument({ profile, projects, resume, site, photo }: ResumePdfProps) {
	const byId = new Map(projects.map((project) => [project.id, project]));
	const minors = resume.minor.flatMap(({ id, line }) => {
		const project = byId.get(id);
		return project ? [{ project, line }] : [];
	});
	return (
		<Document title={`${profile.name}_이력서`} author={profile.name} subject={resume.role}>
			<Page size="A4" style={s.page}>
				<View style={s.header}>
					{photo && <Image style={s.photo} src={photo} />}
					<View style={{ flex: 1 }}>
						<Text style={s.role}>{resume.role}</Text>
						<Text style={s.name}>
							{profile.name}
							{profile.nameEn && <Text style={s.nameEn}>{`  ${profile.nameEn}`}</Text>}
						</Text>
						<Text style={s.motto}>{resume.motto}</Text>
						<Text style={s.contact}>{[profile.email, bare(profile.github), site].filter(Boolean).join('   |   ')}</Text>
					</View>
				</View>

				<View style={s.cards}>
					{resume.strengths.map((item) => (
						<View key={item.title} style={s.card}>
							<Text style={s.cardTitle}>{item.title}</Text>
							<Text style={s.cardText}>{item.detail}</Text>
						</View>
					))}
				</View>

				<View style={s.section}>
					{heading('할 수 있는 일')}
					{resume.capabilities.map((item) => (
						<View key={item.area} style={s.skill} wrap={false}>
							<Text style={s.skillArea}>{item.area}</Text>
							<View style={s.skillBody}>
								<Text>{item.detail}</Text>
								<Text style={s.tools}>{item.tools.join(' · ')}</Text>
							</View>
						</View>
					))}
				</View>

				<View style={s.section}>
					{heading('프로젝트')}
					{resume.featured.map(({ id, bullets }) => {
						const project = byId.get(id);
						if (!project) return null;
						return (
							<View key={id} style={s.project} wrap={false}>
								<View style={s.projectHead}>
									<Text style={s.projectName}>{project.name}</Text>
									<Text style={s.tag}>{project.context}</Text>
									{project.period && <Text style={s.when}>{project.period}</Text>}
								</View>
								<Text>
									{project.description}
									{project.demo && (
										<Link style={s.url} src={project.demo}>
											{`  ${bare(project.demo)}`}
										</Link>
									)}
								</Text>
								<View style={s.chips}>
									{project.stack.map((tool) => (
										<Text key={tool} style={s.chip}>
											{tool}
										</Text>
									))}
								</View>
								<View style={s.bullets}>
									{bullets.map((bullet) => (
										<View key={bullet.title} style={s.bullet}>
											<View style={s.dot} />
											<Text style={s.bulletText}>
												<Text style={s.strong}>{bullet.title}</Text>
												{`  ${bullet.detail}`}
											</Text>
										</View>
									))}
								</View>
							</View>
						);
					})}
					{minors.length > 0 && (
						<View style={s.minors} wrap={false}>
							{minors.map(({ project, line }) => (
								<View key={project.id} style={s.minor}>
									<View style={s.minorHead}>
										<Text style={s.minorName}>{project.name}</Text>
										{project.period && <Text style={s.minorWhen}>{project.period}</Text>}
									</View>
									<Text style={s.minorText}>{line}</Text>
								</View>
							))}
						</View>
					)}
				</View>

				<View style={s.section}>
					{heading('수상 · 자격 · 어학')}
					{rows(resume.awards)}
				</View>
				<View style={s.section}>
					{heading('교육')}
					{rows(resume.education)}
				</View>
			</Page>
		</Document>
	);
}
