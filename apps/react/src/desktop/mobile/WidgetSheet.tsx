import Sheet from '@/shared/ui/sheet/Sheet';
import {
	pageToAdd,
	WIDGET_INFO,
	WIDGET_KINDS,
	type PageWidget,
	type WidgetKind,
	type WidgetSize,
} from '@/desktop/widgets/catalog';
import Widget from '@/desktop/widgets/Widget';
import { usePhotoSources } from '@/desktop/widgets/usePhotoSources';

const SIZE_LABEL: Record<WidgetSize, string> = { small: '작게', medium: '중간' };

interface Props {
	pages: readonly (readonly PageWidget[])[];
	current: number;
	onAdd: (kind: WidgetKind, size: WidgetSize) => void;
	onClose: () => void;
}

/**
 * 휴대폰 위젯 갤러리 (iOS 홈 화면 편집의 +): 아래에서 올라오는 시트에 종류·크기마다 실제 위젯을 미리 보여 준다.
 * 누르면 지금 페이지(자리가 없으면 자리가 있는 첫 페이지)에 더한다. 어느 페이지에도 자리가 없으면 누를 수 없다
 */
const WidgetSheet = ({ pages, current, onAdd, onClose }: Props) => (
	<Sheet label="위젯 갤러리" className="mobile-widget-sheet" onClose={onClose}>
		<h2>위젯</h2>
		<ul>
			{WIDGET_KINDS.flatMap((kind) =>
				WIDGET_INFO[kind].sizes.map((size) => {
					const full = pageToAdd(pages, current, size) < 0;
					return (
						<li key={`${kind}-${size}`} data-size={size}>
							<button
								type="button"
								aria-label={`${WIDGET_INFO[kind].label} 위젯 (${SIZE_LABEL[size]}) 더하기`}
								disabled={full}
								onClick={() => onAdd(kind, size)}
							>
								<span className="mobile-widget-sheet-preview" inert>
									<Widget kind={kind} size={size} open={() => {}} />
								</span>
								<strong>{WIDGET_INFO[kind].label}</strong>
								<span>{full ? '위젯을 둘 자리가 없습니다' : WIDGET_INFO[kind].description}</span>
							</button>
						</li>
					);
				})
			)}
		</ul>
	</Sheet>
);

/** 사진 위젯의 앨범 고르기 (편집 중에 위젯의 '앨범' 단추로 연다) */
export const AlbumSheet = ({
	album,
	onChoose,
	onClose,
}: {
	album: string | undefined;
	onChoose: (album: string | undefined) => void;
	onClose: () => void;
}) => {
	const sources = usePhotoSources();
	const all = !sources.some((item) => item.id === album);
	const groups: [string, { id: string | undefined; name: string }[]][] = [
		['앨범', [{ id: undefined, name: '모든 앨범' }, ...sources.filter((source) => source.group === 'album')]],
		['그림 폴더', sources.filter((source) => source.group === 'folder')],
	];
	return (
		<Sheet label="사진 위젯의 앨범" variant="card" className="mobile-album-sheet" onClose={onClose}>
			{groups
				.filter(([, options]) => options.length > 0)
				.map(([heading, options]) => (
					<section key={heading}>
						<h2>{heading}</h2>
						<ul role="radiogroup" aria-label={heading}>
							{options.map((option) => {
								const checked = option.id === undefined ? all : option.id === album;
								return (
									<li key={option.id ?? 'all'}>
										<button type="button" role="radio" aria-checked={checked} onClick={() => onChoose(option.id)}>
											{option.name}
											{checked && <i className="fa-solid fa-check" aria-hidden="true"></i>}
										</button>
									</li>
								);
							})}
						</ul>
					</section>
				))}
		</Sheet>
	);
};

export default WidgetSheet;
