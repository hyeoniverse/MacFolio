import { ListTable } from '../ListTable';

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
