import { type Project } from '@macfolio/desktop-core/site';
import { ListTable } from '../ListTable';
import { TextField } from '../fields';
import { optional } from '../model';
import { patchOf } from './patch';

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
