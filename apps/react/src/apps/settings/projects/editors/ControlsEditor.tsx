import { type Project } from '@macfolio/desktop-core/site';
import { ListTable } from '../ListTable';

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
