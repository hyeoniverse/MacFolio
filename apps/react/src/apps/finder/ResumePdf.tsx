// 이력서 PDF 문서 (react-pdf). 이력서 Markdown을 읽은 모양(resumeModel.ts)으로 누르는 순간 PDF를 만들어 내려받는다 (resumeDownload.ts).
// 화면이 아니라 종이(A4, pt) 위에 그리는 문서라 색과 크기는 앱의 토큰이 아니라 인쇄 기준 값을 그대로 쓴다.
// 글자는 벡터로 들어가 확대해도 선명하고, 고르거나 찾을 수 있다. 글꼴은 쓴 글자만 담긴다.
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Resume, ResumeEntry, ResumeProject, ResumeSection } from './resumeModel';

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

/** 강점 카드 */
const cards = (entries: ResumeEntry[]) => (
	<View style={s.cards}>
		{entries.map((item) => (
			<View key={item.title} style={s.card}>
				<Text style={s.cardTitle}>{item.title}</Text>
				{item.detail && <Text style={s.cardText}>{item.detail}</Text>}
			</View>
		))}
	</View>
);

/** 제목·설명 목록 (할 수 있는 일처럼 기술이 붙기도 한다) */
const list = (entries: ResumeEntry[]) =>
	entries.map((item) => (
		<View key={item.title} style={s.skill} wrap={false}>
			<Text style={s.skillArea}>{item.title}</Text>
			<View style={s.skillBody}>
				{item.detail && <Text>{item.detail}</Text>}
				{item.tools.length > 0 && <Text style={s.tools}>{item.tools.join(' · ')}</Text>}
			</View>
		</View>
	));

/** 오른쪽에 날짜를 둔 줄 (수상·교육·그 밖의 프로젝트) */
const rows = (entries: ResumeEntry[]) =>
	entries.map((item) => (
		<View key={item.title} style={s.row} wrap={false}>
			<View style={{ flex: 1 }}>
				<Text style={s.strong}>{item.title}</Text>
				{item.detail && <Text style={s.rowDetail}>{item.detail}</Text>}
			</View>
			{item.period && <Text style={s.rowWhen}>{item.period}</Text>}
		</View>
	));

/** 프로젝트 카드: 이름 · 구분 · 기간, 설명과 주소, 기술 칩, 성과 */
const project = (item: ResumeProject) => {
	const [period, ...tags] = item.meta;
	return (
		<View key={item.name} style={s.project} wrap={false}>
			<View style={s.projectHead}>
				<Text style={s.projectName}>{item.name}</Text>
				<Text style={s.tag}>{tags.join(' · ')}</Text>
				{period && <Text style={s.when}>{period}</Text>}
			</View>
			{(item.description || item.url) && (
				<Text>
					{item.description}
					{item.url && (
						<Link style={s.url} src={item.url}>
							{`  ${bare(item.url)}`}
						</Link>
					)}
				</Text>
			)}
			{item.stack.length > 0 && (
				<View style={s.chips}>
					{item.stack.map((tool) => (
						<Text key={tool} style={s.chip}>
							{tool}
						</Text>
					))}
				</View>
			)}
			{item.bullets.length > 0 && (
				<View style={s.bullets}>
					{item.bullets.map((bullet) => (
						<View key={bullet.title} style={s.bullet}>
							<View style={s.dot} />
							<Text style={s.bulletText}>
								<Text style={s.strong}>{bullet.title}</Text>
								{bullet.detail && `  ${bullet.detail}`}
							</Text>
						</View>
					))}
				</View>
			)}
		</View>
	);
};

const section = (item: ResumeSection, index: number) => (
	<View key={`${index}:${item.title}`} style={s.section}>
		{heading(item.title)}
		{item.kind === 'cards' && cards(item.entries)}
		{item.kind === 'list' && list(item.entries)}
		{item.kind === 'rows' && rows(item.entries)}
		{item.kind === 'projects' && item.projects.map(project)}
		{item.kind === 'text' && item.lines.map((line, at) => <Text key={at}>{line}</Text>)}
	</View>
);

export interface ResumePdfProps {
	resume: Resume;
	/** 사진 (data: 주소). 못 받았으면 없다 */
	photo?: string;
}

/**
 * 이력서 PDF 문서. 첫 절이 강점 카드면 머리 바로 아래에 붙여 둔다.
 * react-pdf의 pdf()는 <Document> 요소를 받으므로 컴포넌트가 아니라 요소를 돌려주는 함수로 둔다
 */
export function resumeDocument({ resume, photo }: ResumePdfProps) {
	const [first, ...others] = resume.sections;
	const lead = first?.kind === 'cards' ? first : null;
	return (
		<Document title={`${resume.name}_이력서`} author={resume.name} subject={resume.role}>
			<Page size="A4" style={s.page}>
				<View style={s.header}>
					{photo && <Image style={s.photo} src={photo} />}
					<View style={{ flex: 1 }}>
						{resume.role && <Text style={s.role}>{resume.role}</Text>}
						<Text style={s.name}>{resume.name}</Text>
						{resume.motto && <Text style={s.motto}>{resume.motto}</Text>}
						{resume.contact.length > 0 && <Text style={s.contact}>{resume.contact.join('   |   ')}</Text>}
					</View>
				</View>
				{lead && cards(lead.entries)}
				{(lead ? others : resume.sections).map(section)}
			</Page>
		</Document>
	);
}
