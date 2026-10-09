import { cycleTag, toggleAllTags, type TagSelection } from '@macfolio/desktop-core/memo';

interface Props {
	/** 본문에 쓴 #태그와 글 수 (tags.ts) */
	tags: { name: string; count: number }[];
	selection: TagSelection;
	onChange: (next: TagSelection) => void;
	/** 칩 줄의 이름 (스크린 리더). 없으면 둘레의 묶음 이름을 쓴다 */
	label?: string;
	className?: string;
}

/**
 * 태그 칩 줄: '모든 태그'와 #태그. 누를 때마다 미선택 → 포함(채운 칩) → 제외(테두리·취소선) (macOS 메모).
 * 사이드바(폴더 아래)와 휴대폰의 태그 화면(목록 위, 옆으로 넘긴다)이 함께 쓴다
 */
const TagChips = ({ tags, selection, onChange, label, className }: Props) => (
	<ul className={className} aria-label={label}>
		<li>
			<button
				type="button"
				className={`memo-tag-chip ${selection.all ? 'include' : ''}`}
				aria-pressed={selection.all}
				onClick={() => onChange(toggleAllTags(selection))}
			>
				모든 태그
			</button>
		</li>
		{tags.map((tag) => {
			const state = selection.tags[tag.name];
			return (
				<li key={tag.name}>
					<button
						type="button"
						className={`memo-tag-chip ${state ?? ''}`}
						aria-pressed={state === 'include'}
						data-state={state ?? 'none'}
						title={
							state === 'include'
								? '이 태그가 있는 메모 (한 번 더 누르면 제외)'
								: state === 'exclude'
									? '이 태그가 있는 메모는 뺍니다 (한 번 더 누르면 풀림)'
									: `${tag.count}개의 메모`
						}
						onClick={() => onChange(cycleTag(selection, tag.name))}
					>
						#{tag.name}
					</button>
				</li>
			);
		})}
	</ul>
);

export default TagChips;
