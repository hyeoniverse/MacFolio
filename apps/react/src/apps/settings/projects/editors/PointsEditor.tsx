import { type ProjectPoint } from '@macfolio/desktop-core/site';
import { ListTable } from '../ListTable';
import { TextField } from '../fields';
import { ImageField } from '../images';
import { optional } from '../model';
import { patchOf } from './patch';
import { RowThumb } from './RowThumb';
import { ShotsEditor } from './ShotsEditor';

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
