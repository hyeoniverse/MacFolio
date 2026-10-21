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

export default WidgetSheet;
