import { useRef, type CSSProperties } from 'react';
import { type ProjectLook } from '@macfolio/desktop-core/site';
import { LOOKS } from './model';

/**
 * 페이지 모양의 작은 도식: 모양마다 바탕과 몇 개의 네모(왼쪽·위·너비·높이 %, 바탕, 덧붙일 모양).
 * 실제 페이지를 그리지 않고 그 모양의 생김새만 (카드 14장을 가볍게)
 */
type Part = [number, number, number, number, string, CSSProperties?];
const round = { borderRadius: '999px' };
const card = { borderRadius: '8%/12%', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' };
const SKETCH: Record<ProjectLook, { bg: string; parts: Part[]; text?: string }> = {
	// 제품: 흰 바탕 가운데 큰 제목 두 줄, 버튼 하나, 아래의 큰 화면
	product: {
		bg: '#ffffff',
		parts: [
			[22, 10, 56, 7, '#1d1d1f'],
			[30, 20, 40, 7, '#1d1d1f'],
			[38, 31, 24, 3, '#86868b'],
			[43, 38, 14, 5.5, '#0071e3', round],
			[10, 50, 80, 50, '#f5f5f7', { borderRadius: '6% 6% 0 0/10% 10% 0 0' }],
			[18, 58, 64, 42, 'linear-gradient(160deg, #d6e4f5, #eef1f6)', { borderRadius: '4% 4% 0 0/7% 7% 0 0' }],
		],
	},
	// 카드: 왼쪽 글과 버튼, 오른쪽 창 틀, 아래 아이콘 카드 셋
	friendly: {
		bg: '#f6f9fc',
		parts: [
			[7, 12, 12, 4, '#635bff', round],
			[7, 21, 38, 6, '#0a2540'],
			[7, 30, 30, 6, '#0a2540'],
			[7, 41, 32, 3, '#6b7c93'],
			[7, 50, 14, 5.5, '#635bff', round],
			[52, 10, 41, 46, '#ffffff', card],
			[52, 10, 41, 7, '#eef2f7', { borderRadius: '8% 8% 0 0/40% 40% 0 0' }],
			[7, 66, 27, 26, '#ffffff', card],
			[37, 66, 27, 26, '#ffffff', card],
			[67, 66, 26, 26, '#ffffff', card],
			[11, 71, 6, 8, '#e8e6ff', { borderRadius: '2px' }],
			[41, 71, 6, 8, '#e8e6ff', { borderRadius: '2px' }],
			[71, 71, 6, 8, '#e8e6ff', { borderRadius: '2px' }],
		],
	},
	// 문서: 표지, 걸친 아이콘, 제목과 속성, 알림 상자
	paper: {
		bg: '#fffefc',
		parts: [
			[0, 0, 100, 26, 'linear-gradient(120deg, #e9dfcf, #d9e3e6)'],
			[16, 19, 11, 14, '#ffffff', { borderRadius: '3px', boxShadow: '0 0 0 1px rgba(55,53,47,0.12)' }],
			[16, 40, 44, 6, '#37352f'],
			[16, 51, 12, 2.5, '#9b9a97'],
			[32, 51, 24, 2.5, '#37352f'],
			[16, 57, 12, 2.5, '#9b9a97'],
			[32, 57, 18, 2.5, '#37352f'],
			[16, 67, 68, 16, '#f7f6f3', { borderRadius: '2px' }],
			[20, 72, 4, 5, '#d9730d'],
			[28, 73, 40, 2.5, '#787774'],
			[16, 88, 3, 3, '#37352f'],
			[22, 88, 40, 2.5, '#9b9a97'],
		],
	},
	// 벤토: 어두운 바탕 위 크기가 다른 타일
	bento: {
		bg: '#09090b',
		parts: [
			[30, 8, 40, 6, '#fafafa'],
			[38, 17, 24, 2.5, '#71717a'],
			[6, 26, 56, 40, '#18181b', { border: '1px solid #27272a', borderRadius: '5%/8%' }],
			[10, 32, 48, 28, 'linear-gradient(140deg, #312e81, #18181b)', { borderRadius: '4%/7%' }],
			[65, 26, 29, 19, '#121214', { border: '1px solid #27272a', borderRadius: '8%/14%' }],
			[69, 31, 14, 7, '#fafafa'],
			[65, 47, 29, 19, '#121214', { border: '1px solid #27272a', borderRadius: '8%/14%' }],
			[69, 52, 10, 7, '#a78bfa'],
			[6, 70, 27, 22, '#121214', { border: '1px solid #27272a', borderRadius: '8%/14%' }],
			[36, 70, 27, 22, '#121214', { border: '1px solid #27272a', borderRadius: '8%/14%' }],
			[66, 70, 28, 22, '#121214', { border: '1px solid #27272a', borderRadius: '8%/14%' }],
		],
	},
	// 키노트: 어두운 무대 가운데 큰 제목과 강조색 한 줄, 아래 빛나지 않는 큰 화면
	keynote: {
		bg: '#000000',
		parts: [
			[24, 14, 52, 7, '#f5f5f7'],
			[32, 25, 36, 7, '#f5f5f7'],
			[40, 37, 20, 3, '#5e5ce6'],
			[14, 50, 72, 44, '#1c1c1e', { borderRadius: '4%/7%' }],
			[20, 56, 60, 34, '#2c2c2e', { borderRadius: '3%/5%' }],
		],
	},
	// 매거진: 가운데 제호와 겹줄, 붉은 머리말, 명조 큰 제목 두 줄, 리드, 잉크색 버튼, 아래 판 위의 큰 사진
	magazine: {
		bg: '#faf8f3',
		parts: [
			[38, 6, 24, 2.5, '#1a1a1a'],
			[8, 11.5, 84, 0.6, '#1a1a1a'],
			[8, 13, 84, 0.6, '#1a1a1a'],
			[40, 20, 20, 2, '#b23a2b'],
			[16, 26, 68, 7, '#1a1a1a'],
			[27, 36, 46, 7, '#1a1a1a'],
			[26, 47, 48, 2.5, '#8a857b'],
			[43, 54, 14, 5, '#1a1a1a'],
			[0, 65, 100, 35, '#efebe1'],
			[16, 71, 68, 29, '#d8d2c4'],
		],
	},
	// 개발자 도구: 흰 바탕에 1px 선의 틀, 고정폭 배지, 왼쪽 큰 제목과 검은 버튼·명령 상자, 오른쪽 정보 칸, 아래 탐색기 달린 편집기 창
	devtool: {
		bg: '#ffffff',
		parts: [
			[6, 0, 0.6, 100, '#eaeaea'],
			[93.4, 0, 0.6, 100, '#eaeaea'],
			[12, 9, 22, 4, '#fafafa', { border: '1px solid #eaeaea', borderRadius: '999px' }],
			[12, 17, 46, 6, '#171717'],
			[12, 26, 34, 6, '#171717'],
			[12, 37, 12, 5.5, '#171717', { borderRadius: '2px' }],
			[26, 37, 12, 5.5, '#ffffff', { border: '1px solid #d4d4d4', borderRadius: '2px' }],
			[12, 45, 30, 5, '#fafafa', { border: '1px solid #eaeaea', borderRadius: '2px' }],
			[68, 22, 0.5, 26, '#eaeaea'],
			[71, 24, 14, 2.5, '#8f8f8f'],
			[71, 31, 9, 3.5, '#e5f0ff', round],
			[81, 31, 8, 3.5, '#e5f0ff', round],
			[71, 37, 12, 3.5, '#e5f0ff', round],
			[12, 58, 76, 42, '#ffffff', { border: '1px solid #eaeaea', borderRadius: '4% 4% 0 0/8% 8% 0 0' }],
			[12, 58, 76, 6, '#fafafa', { borderBottom: '1px solid #eaeaea', borderRadius: '4% 4% 0 0/50% 50% 0 0' }],
			[12, 64, 18, 36, '#fafafa', { borderRight: '1px solid #eaeaea' }],
			[15, 69, 10, 2, '#0068d6'],
			[17, 74, 9, 2, '#0068d6'],
			[17, 79, 8, 2, '#8f8f8f'],
			[34, 69, 26, 2, '#0068d6'],
			[36, 75, 40, 2, '#171717'],
			[36, 81, 30, 2, '#171717'],
		],
	},
	// 저장소: GitHub 저장소 화면. 회색 머리 띠의 저장소 이름과 초록 Code 버튼, 주황 밑줄의 탭, 왼쪽 파일 상자와 README, 오른쪽 옆 칸
	repo: {
		bg: '#ffffff',
		parts: [
			[0, 0, 100, 30, '#f6f8fa', { borderBottom: '1px solid #d1d9e0' }],
			[6, 8, 5, 7, '#ffffff', { border: '1px solid #d1d9e0', borderRadius: '2px' }],
			[14, 9.5, 30, 4, '#0969da'],
			[78, 8, 16, 7, '#1f883d', { borderRadius: '2px' }],
			[6, 22, 9, 3, '#1f2328'],
			[19, 22, 11, 3, '#59636e'],
			[34, 22, 13, 3, '#59636e'],
			[6, 28.5, 10, 1.5, '#fd8c73'],
			[6, 38, 60, 26, '#ffffff', { border: '1px solid #d1d9e0', borderRadius: '3%/6%' }],
			[6, 38, 60, 6, '#f6f8fa', { borderBottom: '1px solid #d1d9e0', borderRadius: '3% 3% 0 0/30% 30% 0 0' }],
			[9, 48, 3, 2.5, '#54aeff'],
			[14, 48, 16, 2.5, '#1f2328'],
			[9, 54, 3, 2.5, '#54aeff'],
			[14, 54, 12, 2.5, '#1f2328'],
			[9, 60, 3, 2.5, '#59636e'],
			[14, 60, 18, 2.5, '#1f2328'],
			[6, 69, 60, 31, '#ffffff', { border: '1px solid #d1d9e0', borderRadius: '3% 3% 0 0/6% 6% 0 0' }],
			[10, 77, 36, 5, '#1f2328'],
			[10, 86, 48, 2.5, '#59636e'],
			[10, 92, 40, 2.5, '#59636e'],
			[72, 38, 22, 3, '#1f2328'],
			[72, 45, 20, 2.5, '#59636e'],
			[72, 52, 9, 3.5, '#ddf4ff', round],
			[83, 52, 9, 3.5, '#ddf4ff', round],
			[72, 64, 22, 2, '#3178c6', round],
		],
	},
	// 놀이: 또렷한 색 면과 큰 둥근 도형, 스티커
	playful: {
		bg: '#fff8ee',
		parts: [
			[8, 12, 50, 8, '#1e1e1e'],
			[8, 23, 38, 8, '#1e1e1e'],
			[8, 38, 16, 6, '#ff5c39', round],
			[60, 8, 34, 34, '#ffc93c', { borderRadius: '50%' }],
			[70, 30, 20, 20, '#7b61ff', { borderRadius: '30%' }],
			[8, 56, 26, 34, '#a3e4d7', { borderRadius: '14%' }],
			[37, 56, 26, 34, '#ffb3c7', { borderRadius: '14%' }],
			[66, 56, 26, 34, '#c7d2fe', { borderRadius: '14%' }],
		],
	},
	custom: {
		bg: 'linear-gradient(160deg, #f4f4f6, #e4e4e9)',
		parts: [],
		text: '</>',
	},
};

const LookSketch = ({ look }: { look: ProjectLook }) => {
	const { bg, parts, text } = SKETCH[look];
	return (
		<span className="projects-look-sketch" style={{ background: bg }}>
			{parts.map(([left, top, width, height, background, extra], index) => (
				<span
					key={index}
					style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, background, ...extra }}
				/>
			))}
			{text && <b>{text}</b>}
		</span>
	);
};

/** 페이지 모양 고르기: 바탕화면 고르기처럼 작은 그림 카드 격자. ←·→·↑·↓로 옮겨 고른다 (라디오 묶음) */
export const LookPicker = ({
	value,
	looks,
	onChange,
}: {
	value: ProjectLook;
	/** 고를 수 있는 모양 (직접 짠 페이지는 등록된 프로젝트만) */
	looks: readonly ProjectLook[];
	onChange: (look: ProjectLook) => void;
}) => {
	const groupRef = useRef<HTMLDivElement>(null);
	const choose = (index: number) => {
		const look = looks[(index + looks.length) % looks.length];
		onChange(look);
		groupRef.current?.querySelector<HTMLElement>(`[data-look="${look}"]`)?.focus();
	};
	return (
		<div className="projects-looks" role="radiogroup" aria-label="페이지 모양" ref={groupRef}>
			{looks.map((look, index) => {
				const checked = look === value;
				return (
					<button
						key={look}
						type="button"
						role="radio"
						aria-checked={checked}
						aria-label={LOOKS[look].name}
						title={`${LOOKS[look].name} (${LOOKS[look].note})`}
						tabIndex={checked ? 0 : -1}
						data-look={look}
						className="projects-look"
						onClick={() => onChange(look)}
						onKeyDown={(event) => {
							const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
							if (!delta) return;
							event.preventDefault();
							choose(index + delta);
						}}
					>
						<span className="projects-look-thumb">
							<LookSketch look={look} />
							{checked && (
								<span className="projects-look-check" aria-hidden="true">
									<i className="fa-solid fa-check" />
								</span>
							)}
						</span>
						<span className="projects-look-name">{LOOKS[look].name}</span>
						<span className="projects-look-note">{LOOKS[look].note}</span>
					</button>
				);
			})}
		</div>
	);
};

/* ─── 항목 시트 (macOS 시스템 설정의 시트): 목록 항목의 칸은 편집 화면 위에 내려오는 둥근 판에서 고친다 ─── */
