import { type Project } from '@macfolio/desktop-core/site';
import { ListTable } from '../ListTable';
import { TextField } from '../fields';
import { ImageField } from '../images';
import { optional } from '../model';
import { patchOf } from './patch';
import { RowThumb } from './RowThumb';

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
