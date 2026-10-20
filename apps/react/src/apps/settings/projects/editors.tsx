import { useState } from 'react';
import { type Project, type ProjectChapter, type ProjectPoint } from '@macfolio/desktop-core/site';
import { ListTable } from './ListTable';
import { SwitchRow, TextField } from './fields';
import { ImageField, Lightbox, PicturePopup, UploadButton } from './images';
import { useImageUpload } from './useImageUpload';
import { optional } from './model';

/** 줄 오른쪽의 16:10 썸네일 (그림이 없으면 빈 칸) */
const RowThumb = ({ src }: { src?: string }) => (
	<span className={`projects-row-thumb ${src ? 'filled' : 'empty'}`} aria-hidden="true">
		{src ? <img src={src} alt="" loading="lazy" /> : <i className="fa-regular fa-image" />}
	</span>
);

/** 고를 수 있는 필드를 바꾼다: undefined가 된 키는 지운다 */
const patchOf = <T extends object>(item: T, change: Partial<T>): T => {
	const next = { ...item, ...change };
	for (const key of Object.keys(change) as (keyof T)[]) if (next[key] === undefined) delete next[key];
	return next;
};

type Shot = NonNullable<ProjectPoint['shots']>[number];

/** 화면 목록의 한 줄: 썸네일(누르면 크게 보기), 설명 칸, 그 아래 주소 칸과 고르기·올리기 */
const ShotRow = ({
	name,
	shot,
	update,
	onZoom,
}: {
	/** 줄 이름 ('화면 모음 1'): 칸마다 접근성 이름 앞에 붙인다 */
	name: string;
	shot: Shot;
	update: (next: Shot) => void;
	onZoom: () => void;
}) => {
	const { uploading, error, upload } = useImageUpload((src) => update({ ...shot, src }));
	const video = shot.src.endsWith('.mp4');
	return (
		<div className="projects-shot">
			{shot.src ? (
				<button type="button" className="projects-shot-thumb" aria-label={`${name} 그림 크게 보기`} onClick={onZoom}>
					{video ? <video src={shot.src} muted /> : <img src={shot.src} alt="" loading="lazy" />}
				</button>
			) : (
				<span className="projects-shot-thumb empty" aria-hidden="true">
					<i className="fa-regular fa-image" />
				</span>
			)}
			<div className="projects-shot-fields">
				<input
					className="projects-input"
					aria-label={`${name} 설명`}
					value={shot.alt}
					placeholder="설명을 적습니다."
					onChange={(event) => update({ ...shot, alt: event.target.value })}
				/>
				<div className="projects-shot-source">
					<input
						className="projects-input mono"
						aria-label={`${name} 주소`}
						value={shot.src}
						placeholder="/imgs/… 또는 https://"
						spellCheck={false}
						onChange={(event) => update({ ...shot, src: event.target.value.trim() })}
					/>
					<PicturePopup
						label={`${name} 그림 고르기`}
						value={undefined}
						prompt="고르기…"
						onPick={(src) => src && update({ ...shot, src })}
					/>
					<UploadButton name={`${name} 그림 올리기`} uploading={uploading} onFile={(file) => void upload(file)} />
				</div>
				{error && <p className="projects-error">{error}</p>}
			</div>
		</div>
	);
};

/**
 * 화면 여러 장 (항목 안)과 화면 모음 (그림 탭): 줄마다 그림과 설명을 바로 고친다 (시트를 열지 않는다).
 * 줄을 끌거나 ⌥↑·⌥↓로 순서를 바꾸고, 썸네일을 누르면 목록의 그림을 차례로 크게 본다
 */
export const ShotsEditor = ({
	label,
	title = '화면 여러 장',
	nested = true,
	hint = '글 옆이나 아래에 차례로 보입니다. .mp4 주소는 화면에 보일 때만 도는 영상이 됩니다.',
	shots,
	onChange,
}: {
	label: string;
	title?: string;
	nested?: boolean;
	hint?: string;
	shots: Shot[];
	onChange: (shots: Shot[]) => void;
}) => {
	const [zoomed, setZoomed] = useState<string | null>(null);
	const sources = shots.map((shot) => shot.src).filter(Boolean);
	return (
		<>
			<ListTable<Shot>
				label={label}
				title={title}
				nested={nested}
				hint={hint}
				items={shots}
				onChange={onChange}
				blank={() => ({ src: '', alt: '' })}
				cells={(shot, index, update) => [
					<ShotRow
						key="shot"
						name={`${label} ${index + 1}`}
						shot={shot}
						update={update}
						onZoom={() => setZoomed(shot.src)}
					/>,
				]}
			/>
			{zoomed !== null && sources.includes(zoomed) && (
				<Lightbox items={sources} start={sources.indexOf(zoomed)} onClose={() => setZoomed(null)} />
			)}
		</>
	);
};

/** 항목 하나의 칸: 제목, 설명, 자세히, 그림, 화면 여러 장, 영상, 아이콘 */
const PointFields = ({
	label,
	point,
	update,
}: {
	/** 항목 이름 ('주요 기능 1'): 칸마다 접근성 이름 앞에 붙인다 */
	label: string;
	point: ProjectPoint;
	update: (next: ProjectPoint) => void;
}) => (
	<>
		<TextField
			label="제목"
			ariaLabel={`${label} 제목`}
			value={point.title}
			onChange={(title) => update(patchOf(point, { title }))}
		/>
		<TextField
			label="설명"
			multiline
			ariaLabel={`${label} 설명`}
			value={point.body}
			onChange={(body) => update(patchOf(point, { body }))}
		/>
		<TextField
			label="자세히"
			multiline
			rows={4}
			ariaLabel={`${label} 자세히`}
			value={point.detail}
			hint="펼쳐 읽거나 다음 장으로 넘길 때 더 보이는 설명입니다."
			onChange={(detail) => update(patchOf(point, { detail: optional(detail) }))}
		/>
		<ImageField
			label="그림"
			name={`${label} 그림`}
			shape="wide"
			value={point.image}
			hint={point.video ? '영상이 있으면 그림 대신 영상이 보입니다. 그림을 보이려면 영상 칸을 비웁니다.' : undefined}
			// 다크 테마 그림은 원래 그림과 짝이라, 그림을 바꾸면 함께 지운다 (옛 화면이 밀대 반쪽에 남지 않게)
			onChange={(image) => update(patchOf(point, { image, imageDark: undefined }))}
		/>
		<ShotsEditor
			label={`${label} 화면`}
			shots={point.shots ?? []}
			onChange={(shots) => update(patchOf(point, { shots: shots.length ? shots : undefined }))}
		/>
		<TextField
			label="영상"
			ariaLabel={`${label} 영상`}
			value={point.video}
			placeholder="/imgs/….mp4 또는 https://"
			hint="그림 대신 화면에 보일 때만 도는 짧은 영상입니다."
			onChange={(video) => update(patchOf(point, { video: optional(video) }))}
		/>
		<TextField
			label="아이콘"
			ariaLabel={`${label} 아이콘`}
			value={point.icon}
			placeholder="예: fa-bolt"
			hint="카드와 번호 자리에 보이는 Font Awesome 아이콘 이름입니다 (fa-로 시작)."
			onChange={(icon) => update(patchOf(point, { icon: optional(icon) }))}
		/>
	</>
);

/** 제목·설명(·그림) 묶음 목록: 주요 기능, 구현 방법, 쓰는 법, 장 안 항목. 줄에는 제목·설명 첫 줄·그림, 고르면 아래에서 고친다 */
export const PointsEditor = ({
	label,
	title,
	nested = false,
	hint,
	points,
	onChange,
}: {
	label: string;
	title?: string;
	nested?: boolean;
	hint?: string;
	points: ProjectPoint[];
	onChange: (points: ProjectPoint[]) => void;
}) => (
	<ListTable<ProjectPoint>
		label={label}
		title={title}
		nested={nested}
		hint={hint}
		items={points}
		onChange={onChange}
		blank={() => ({ title: '', body: '' })}
		cells={(point) => [
			<span className="projects-point" key="text">
				<strong className={point.title.trim() ? '' : 'placeholder'}>{point.title.trim() || '제목 없음'}</strong>
				<span>{point.body.trim() || '설명이 없습니다.'}</span>
			</span>,
			<RowThumb key="thumb" src={point.image ?? point.shots?.find((shot) => !shot.src.endsWith('.mp4'))?.src} />,
		]}
		detail={(point, index, update) => <PointFields label={`${label} ${index + 1}`} point={point} update={update} />}
	/>
);

/** 두 칸짜리 줄 목록: 진행 과정(때·한 일), 기술 사양(분류·기술), 숫자(값·이름표). 표의 칸을 바로 고친다 */
export const PairsEditor = <K extends string>({
	label,
	title,
	nested = false,
	hint,
	keys,
	names,
	placeholders,
	rows,
	onChange,
}: {
	label: string;
	title?: string;
	nested?: boolean;
	hint?: string;
	keys: [K, K];
	names: [string, string];
	placeholders?: [string, string];
	rows: Record<K, string>[];
	onChange: (rows: Record<K, string>[]) => void;
}) => (
	<ListTable
		label={label}
		title={title}
		nested={nested}
		hint={hint}
		items={rows}
		onChange={onChange}
		blank={() => ({ [keys[0]]: '', [keys[1]]: '' }) as Record<K, string>}
		columns={names}
		cells={(row, index, update) =>
			keys.map((key, k) => (
				<input
					key={key}
					className="projects-cell-input"
					aria-label={`${label} ${index + 1} ${names[k]}`}
					placeholder={placeholders?.[k] ?? names[k]}
					value={row[key]}
					onChange={(event) => update({ ...row, [key]: event.target.value })}
				/>
			))
		}
	/>
);

/** 한 줄씩: 내가 한 일 */
export const LinesEditor = ({
	label,
	hint,
	lines,
	onChange,
}: {
	label: string;
	hint?: string;
	lines: string[];
	onChange: (lines: string[]) => void;
}) => (
	<ListTable
		label={label}
		hint={hint}
		items={lines}
		onChange={onChange}
		blank={() => ''}
		cells={(line, index, update) => [
			<input
				key="line"
				className="projects-cell-input"
				aria-label={`${label} ${index + 1}`}
				placeholder="한 일을 한 줄로 적습니다."
				value={line}
				onChange={(event) => update(event.target.value)}
			/>,
		]}
	/>
);

/**
 * 장: 주요 기능과 구현 방법 말고 더 들려줄 이야기 (모든 모양이 '더 들려줄 이야기' 구역이나 대화로 그린다).
 * 줄에는 장 제목과 머리말, 고르면 아래에서 제목·머리말·숫자·항목·장 그림을 고친다.
 * 장 모양(look)·테마(palette)·데이터 구조(schema)·전후 비교(compare)는 코드로 짜는 연출이라 JSON에서만 고친다
 */
export const ChaptersEditor = ({
	chapters,
	onChange,
}: {
	chapters: ProjectChapter[];
	onChange: (chapters: ProjectChapter[]) => void;
}) => (
	<ListTable<ProjectChapter>
		label="장"
		hint="주요 기능·구현 방법 뒤에 이어지는 이야기입니다. 모양마다 그 페이지에 맞는 꼴로 그립니다."
		items={chapters}
		onChange={onChange}
		blank={() => ({ title: '', points: [] })}
		cells={(chapter) => [
			<span className="projects-point" key="text">
				<strong className={chapter.title.trim() ? '' : 'placeholder'}>{chapter.title.trim() || '제목 없음'}</strong>
				<span>{chapter.lead?.trim() || `항목 ${chapter.points.length}개`}</span>
			</span>,
			<RowThumb key="thumb" src={chapter.image?.src} />,
		]}
		detail={(chapter, index, update) => {
			const name = `장 ${index + 1}`;
			return (
				<>
					<TextField
						label="장 제목"
						ariaLabel={`${name} 제목`}
						value={chapter.title}
						onChange={(title) => update(patchOf(chapter, { title }))}
					/>
					<TextField
						label="머리말"
						multiline
						ariaLabel={`${name} 머리말`}
						value={chapter.lead}
						hint="장 첫머리에 크게 보이는 한두 문장입니다."
						onChange={(lead) => update(patchOf(chapter, { lead: optional(lead) }))}
					/>
					<PairsEditor
						label={`${name} 숫자`}
						title="장 숫자"
						nested
						keys={['value', 'label']}
						names={['값', '이름표']}
						placeholders={['예: 3배', '예: 빨라진 저장']}
						rows={chapter.facts ?? []}
						onChange={(facts) => update(patchOf(chapter, { facts: facts.length ? facts : undefined }))}
					/>
					<PointsEditor
						label={`${name} 항목`}
						title="장 안 항목"
						nested
						points={chapter.points}
						onChange={(points) => update(patchOf(chapter, { points }))}
					/>
					<ImageField
						label="장 그림"
						name={`${name} 그림`}
						shape="wide"
						value={chapter.image?.src}
						hint="장 끝이나 옆에 크게 보입니다."
						onChange={(src) =>
							update(
								patchOf(chapter, {
									image: src ? { ...chapter.image, src, alt: chapter.image?.alt ?? '' } : undefined,
								})
							)
						}
					/>
					{chapter.image && (
						<TextField
							label="그림 설명"
							ariaLabel={`${name} 그림 설명`}
							value={chapter.image.alt}
							hint="비워 두면 장 제목을 씁니다."
							onChange={(alt) => chapter.image && update({ ...chapter, image: { ...chapter.image, alt } })}
						/>
					)}
				</>
			);
		}}
	/>
);

type Control = NonNullable<Project['controls']>[number];

/** 조작법 (게임의 키나 앱의 단축키): 키 여러 개(쉼표로)와 설명. 표의 칸을 바로 고친다 */
export const ControlsEditor = ({
	controls,
	onChange,
}: {
	controls: Control[];
	onChange: (controls: Control[]) => void;
}) => (
	<ListTable<Control>
		label="조작법"
		hint="게임의 키나 앱의 단축키를 적습니다. 키는 쉼표로 나눠 적습니다 (예: ←, →)."
		items={controls}
		onChange={onChange}
		blank={() => ({ keys: [], label: '' })}
		columns={['키', '설명']}
		cells={(control, index, update) => [
			<input
				key="keys"
				className="projects-cell-input"
				aria-label={`조작법 ${index + 1} 키`}
				placeholder="예: Shift, Space"
				value={control.keys.join(', ')}
				onChange={(event) => update({ ...control, keys: event.target.value.split(/, ?/) })}
			/>,
			<input
				key="label"
				className="projects-cell-input"
				aria-label={`조작법 ${index + 1} 설명`}
				placeholder="예: 달리기"
				value={control.label}
				onChange={(event) => update({ ...control, label: event.target.value })}
			/>,
		]}
	/>
);

type Trouble = NonNullable<Project['troubleshooting']>[number];

/** 트러블슈팅: 줄에는 제목과 문제 첫 줄·그림, 고르면 아래에서 제목·문제·원인·해결·결과·그림·아이콘을 고친다 */
export const TroubleshootingEditor = ({
	items,
	onChange,
}: {
	items: Trouble[];
	onChange: (items: Trouble[]) => void;
}) => (
	<ListTable<Trouble>
		label="트러블슈팅"
		hint="부딪힌 문제와 푼 과정을 적습니다. 문제, 원인, 해결, 결과 차례로 보이고, 그림이 없으면 아이콘과 단계 띠로 그립니다."
		items={items}
		onChange={onChange}
		blank={() => ({ title: '', problem: '', solution: '' })}
		cells={(item) => [
			<span className="projects-point" key="text">
				<strong className={item.title.trim() ? '' : 'placeholder'}>{item.title.trim() || '제목 없음'}</strong>
				<span>{item.problem.trim() || '문제가 적혀 있지 않습니다.'}</span>
			</span>,
			<RowThumb key="thumb" src={item.image} />,
		]}
		detail={(item, index, update) => {
			const name = `트러블슈팅 ${index + 1}`;
			return (
				<>
					<TextField
						label="제목"
						ariaLabel={`${name} 제목`}
						value={item.title}
						placeholder="예: 긴 목록에서 스크롤이 끊기던 문제"
						onChange={(title) => update({ ...item, title })}
					/>
					<TextField
						label="문제"
						multiline
						ariaLabel={`${name} 문제`}
						value={item.problem}
						hint="무엇이 잘못되었는지 적습니다."
						onChange={(problem) => update({ ...item, problem })}
					/>
					<TextField
						label="원인"
						multiline
						ariaLabel={`${name} 원인`}
						value={item.cause}
						hint="비워 두면 원인 단계를 그리지 않습니다."
						onChange={(cause) => update(patchOf(item, { cause: optional(cause) }))}
					/>
					<TextField
						label="해결"
						multiline
						ariaLabel={`${name} 해결`}
						value={item.solution}
						hint="어떻게 풀었는지 적습니다."
						onChange={(solution) => update({ ...item, solution })}
					/>
					<TextField
						label="결과"
						multiline
						ariaLabel={`${name} 결과`}
						value={item.result}
						hint="풀고 나서 달라진 점입니다. 숫자가 있으면 더 잘 전해집니다."
						onChange={(result) => update(patchOf(item, { result: optional(result) }))}
					/>
					<ImageField
						label="그림"
						name={`${name} 그림`}
						shape="wide"
						value={item.image}
						hint="고치기 전후의 화면이나 그래프를 곁들입니다."
						onChange={(image) => update(patchOf(item, { image }))}
					/>
					<TextField
						label="아이콘"
						ariaLabel={`${name} 아이콘`}
						value={item.icon}
						placeholder="예: fa-bug"
						hint="제목 옆에 보이는 Font Awesome 아이콘 이름입니다. 비워 두면 벌레 아이콘을 씁니다."
						onChange={(icon) => update(patchOf(item, { icon: optional(icon) }))}
					/>
				</>
			);
		}}
	/>
);

type Member = NonNullable<Project['team']>[number];

/** 팀원: 줄에는 이름과 역할, 고르면 아래에서 이름·역할·GitHub 주소·사진·나를 고친다 */
export const TeamEditor = ({ members, onChange }: { members: Member[]; onChange: (members: Member[]) => void }) => (
	<ListTable<Member>
		label="팀원"
		hint="함께 만든 사람을 적습니다. 사진이 없으면 이름 첫 글자로 그리고, 나로 표시한 사람은 강조해서 보입니다."
		items={members}
		onChange={onChange}
		blank={() => ({ name: '', role: '' })}
		cells={(member) => [
			<span className="projects-point" key="text">
				<strong className={member.name.trim() ? '' : 'placeholder'}>
					{member.name.trim() || '이름 없음'}
					{member.me ? ' (나)' : ''}
				</strong>
				<span>{member.role.trim() || '역할이 적혀 있지 않습니다.'}</span>
			</span>,
			<RowThumb key="thumb" src={member.avatar} />,
		]}
		detail={(member, index, update) => {
			const name = `팀원 ${index + 1}`;
			return (
				<>
					<TextField
						label="이름"
						ariaLabel={`${name} 이름`}
						value={member.name}
						onChange={(value) => update({ ...member, name: value })}
					/>
					<TextField
						label="역할"
						ariaLabel={`${name} 역할`}
						value={member.role}
						placeholder="예: 백엔드, 인증과 결제"
						onChange={(role) => update({ ...member, role })}
					/>
					<TextField
						label="GitHub 주소"
						type="url"
						ariaLabel={`${name} GitHub 주소`}
						value={member.url}
						placeholder="https://github.com/…"
						onChange={(url) => update(patchOf(member, { url: optional(url) }))}
					/>
					<ImageField
						label="사진"
						name={`${name} 사진`}
						value={member.avatar}
						hint="비워 두면 이름 첫 글자로 그립니다."
						onChange={(avatar) => update(patchOf(member, { avatar }))}
					/>
					<SwitchRow
						label="나"
						checked={Boolean(member.me)}
						hint="이 프로젝트에서 내가 맡은 자리입니다. 강조해서 보입니다."
						onChange={(me) => update(patchOf(member, { me: me || undefined }))}
					/>
				</>
			);
		}}
	/>
);

type Deployment = NonNullable<Project['deployments']>[number];

/** 배포 결과물: 줄에는 이름과 올린 곳, 고르면 아래에서 이름·주소·올린 곳·설명·그림을 고친다 */
export const DeploymentsEditor = ({
	items,
	onChange,
}: {
	items: Deployment[];
	onChange: (items: Deployment[]) => void;
}) => (
	<ListTable<Deployment>
		label="배포 결과물"
		hint="실제로 열어 볼 수 있는 곳을 적습니다. 웹 서비스, 스토어, 패키지, API 문서처럼 올린 곳마다 한 줄씩 적습니다."
		items={items}
		onChange={onChange}
		blank={() => ({ label: '' })}
		cells={(item) => [
			<span className="projects-point" key="text">
				<strong className={item.label.trim() ? '' : 'placeholder'}>{item.label.trim() || '이름 없음'}</strong>
				<span>{[item.platform, item.url].filter((part) => part?.trim()).join(' · ') || '주소가 없습니다.'}</span>
			</span>,
			<RowThumb key="thumb" src={item.image} />,
		]}
		detail={(item, index, update) => {
			const name = `배포 결과물 ${index + 1}`;
			return (
				<>
					<TextField
						label="이름"
						ariaLabel={`${name} 이름`}
						value={item.label}
						placeholder="예: 웹 서비스"
						onChange={(label) => update({ ...item, label })}
					/>
					<TextField
						label="주소"
						type="url"
						ariaLabel={`${name} 주소`}
						value={item.url}
						placeholder="https://"
						onChange={(url) => update(patchOf(item, { url: optional(url) }))}
					/>
					<TextField
						label="플랫폼"
						ariaLabel={`${name} 플랫폼`}
						value={item.platform}
						placeholder="예: Vercel, App Store, npm"
						hint="올린 곳에 맞는 아이콘을 고르는 데에도 씁니다."
						onChange={(platform) => update(patchOf(item, { platform: optional(platform) }))}
					/>
					<TextField
						label="설명"
						ariaLabel={`${name} 설명`}
						value={item.note}
						onChange={(note) => update(patchOf(item, { note: optional(note) }))}
					/>
					<ImageField
						label="그림"
						name={`${name} 그림`}
						shape="wide"
						value={item.image}
						hint="카드 위에 보이는 화면입니다."
						onChange={(image) => update(patchOf(item, { image }))}
					/>
				</>
			);
		}}
	/>
);

type Credit = NonNullable<Project['credits']>[number];

/** 출처: 빌려 쓴 에셋·글꼴. 줄에는 이름과 만든 사람, 고르면 아래에서 맡은 부분·이름·만든 사람·주소·한 줄 설명을 고친다 */
export const CreditsEditor = ({ credits, onChange }: { credits: Credit[]; onChange: (credits: Credit[]) => void }) => (
	<ListTable<Credit>
		label="출처"
		hint="빌려 쓴 그림·글꼴·소리를 적습니다. 페이지 끝의 출처 구역에 보입니다."
		items={credits}
		onChange={onChange}
		blank={() => ({ role: '', name: '', by: '' })}
		cells={(credit) => [
			<span className="projects-point" key="text">
				<strong className={credit.name.trim() ? '' : 'placeholder'}>{credit.name.trim() || '이름 없음'}</strong>
				<span>
					{[credit.role, credit.by].filter((part) => part.trim()).join(' · ') || '맡은 부분과 만든 사람이 없습니다.'}
				</span>
			</span>,
		]}
		detail={(credit, index, update) => {
			const name = `출처 ${index + 1}`;
			return (
				<>
					<TextField
						label="맡은 부분"
						ariaLabel={`${name} 맡은 부분`}
						value={credit.role}
						placeholder="예: 글꼴"
						onChange={(role) => update({ ...credit, role })}
					/>
					<TextField
						label="이름"
						ariaLabel={`${name} 이름`}
						value={credit.name}
						onChange={(value) => update({ ...credit, name: value })}
					/>
					<TextField
						label="만든 사람"
						ariaLabel={`${name} 만든 사람`}
						value={credit.by}
						onChange={(by) => update({ ...credit, by })}
					/>
					<TextField
						label="주소"
						type="url"
						ariaLabel={`${name} 주소`}
						value={credit.href}
						placeholder="https://"
						onChange={(href) => update(patchOf(credit, { href: optional(href) }))}
					/>
					<TextField
						label="한 줄 설명"
						ariaLabel={`${name} 한 줄 설명`}
						value={credit.note}
						placeholder="예: CC BY 4.0"
						onChange={(note) => update(patchOf(credit, { note: optional(note) }))}
					/>
				</>
			);
		}}
	/>
);
