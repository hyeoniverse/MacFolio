export type MenuVariant = 'mac' | 'ios';

/** variant가 붙이는 클래스 (Menu.css의 .ui-menu.touch). 'mac'은 덧붙이지 않는다 */
export const menuVariantClass = (variant: MenuVariant): string | undefined => (variant === 'ios' ? 'touch' : undefined);
