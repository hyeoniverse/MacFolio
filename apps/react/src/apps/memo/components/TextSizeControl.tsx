import { stepTextScale, TEXT_SCALES } from '../memoStorage';

/** 읽기 화면 글자 크기: 본문 오른쪽 아래에 떠 있는 가− / 가+ 알약 */
export default function TextSizeControl({ scale, onChange }: { scale: number; onChange: (next: number) => void }) {
	return (
		<div className="memo-text-size" role="group" aria-label="글자 크기">
			<button
				type="button"
				aria-label="글자 작게"
				title="글자 작게"
				disabled={scale === TEXT_SCALES[0]}
				onClick={() => onChange(stepTextScale(scale, -1))}
			>
				<span className="small" aria-hidden="true">
					가
				</span>
			</button>
			<button
				type="button"
				aria-label="글자 크게"
				title="글자 크게"
				disabled={scale === TEXT_SCALES.at(-1)}
				onClick={() => onChange(stepTextScale(scale, 1))}
			>
				<span className="large" aria-hidden="true">
					가
				</span>
			</button>
		</div>
	);
}
