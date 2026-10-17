// 공통 부품의 접근성 이름 규칙: 스크린 리더가 읽을 이름(aria-label·글자), 역할(role), 장식 아이콘 숨김(aria-hidden).
// 부품을 그린 HTML을 보고 확인한다 (규칙은 docs/ui.md '접근성 이름 규칙')
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Button from '@/shared/ui/button/Button';
import IconButton from '@/shared/ui/button/IconButton';
import SidebarToggle from '@/shared/ui/button/SidebarToggle';
import DatePicker from '@/shared/ui/date/DatePicker';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Modal from '@/shared/ui/dialog/Modal';
import SearchField from '@/shared/ui/search-field/SearchField';
import Sheet from '@/shared/ui/sheet/Sheet';
import ShareIcon from '@/shared/ui/ShareIcon';

const html = (element: ReactElement) => renderToStaticMarkup(element);
const noop = () => {};

describe('버튼', () => {
	it('아이콘 버튼: label이 이름(aria-label)과 마우스 설명(title)이 되고, 아이콘은 읽지 않는다', () => {
		const out = html(createElement(IconButton, { label: '지우기', icon: 'fa-solid fa-trash-can' }));
		expect(out).toContain('aria-label="지우기"');
		expect(out).toContain('title="지우기"');
		expect(out).toContain('<i class="fa-solid fa-trash-can" aria-hidden="true">');
		// 폼 안에서도 제출 버튼이 되지 않게 기본은 button
		expect(out).toContain('type="button"');
	});

	it('아이콘 버튼: label 없이 쓰려면 보이는 글자가 있어야 한다 (타입이 막는다)', () => {
		expect(html(createElement(IconButton, { children: '‹ 블로그' }))).toContain('‹ 블로그');
		// @ts-expect-error 아이콘만 있고 이름이 없다
		html(createElement(IconButton, { icon: 'fa-solid fa-xmark' }));
	});

	it('글자 버튼: 글자가 이름이고, 앞 아이콘은 읽지 않는다', () => {
		const out = html(createElement(Button, { icon: 'fa-solid fa-paper-plane', tone: 'primary' }, '보내기'));
		expect(out).toMatch(
			/<button type="button" class="ui-button primary"><i class="fa-solid fa-paper-plane" aria-hidden="true"><\/i>보내기<\/button>/
		);
	});

	it('사이드바 여닫기: 이름이 지금 할 일을 말하고, 열림 상태를 aria-expanded로 알린다', () => {
		const open = html(createElement(SidebarToggle, { open: true, onToggle: noop }));
		expect(open).toContain('aria-label="사이드바 가리기"');
		expect(open).toContain('aria-expanded="true"');
		const closed = html(createElement(SidebarToggle, { open: false, onToggle: noop }));
		expect(closed).toContain('aria-label="사이드바 보기"');
		expect(closed).toContain('aria-expanded="false"');
	});

	it('그린 아이콘은 읽지 않고 초점도 받지 않는다', () => {
		expect(html(createElement(ShareIcon, {}))).toMatch(/aria-hidden="true" focusable="false"/);
	});
});

describe('입력', () => {
	it('검색 칸: label이 칸 이름이 되고, placeholder를 따로 주지 않으면 placeholder도 된다', () => {
		const out = html(createElement(SearchField, { label: '메모 검색' }));
		expect(out).toContain('type="search"');
		expect(out).toContain('aria-label="메모 검색"');
		expect(out).toContain('placeholder="메모 검색"');
		expect(out).toContain('<i class="fa-solid fa-magnifying-glass" aria-hidden="true">');
		expect(html(createElement(SearchField, { label: '메모 검색', placeholder: '검색' }))).toContain(
			'placeholder="검색"'
		);
	});

	it('날짜 고르기: 버튼 이름이 고른 날짜와 할 일을 말하고, 달력 창을 연다고 알린다', () => {
		const empty = html(createElement(DatePicker, { value: '', onChange: noop, label: '게시일' }));
		expect(empty).toContain('aria-label="게시일 고르기"');
		expect(empty).toContain('aria-haspopup="dialog"');
		expect(empty).toContain('aria-expanded="false"');
		expect(html(createElement(DatePicker, { value: '2026-10-17', onChange: noop, label: '게시일' }))).toContain(
			'aria-label="게시일 2026. 10. 17., 바꾸기"'
		);
	});
});

describe('창', () => {
	it('가운데 창: 역할 dialog, 바깥을 가리고(aria-modal), label이 이름', () => {
		const out = html(createElement(Modal, { label: '사진 정보', onClose: noop, children: '내용' }));
		expect(out).toMatch(/role="dialog" aria-modal="true" aria-label="사진 정보"/);
	});

	it('경고창: 역할 alertdialog, 제목이 이름, 확인 버튼만 둘 수도 있다', () => {
		const both = html(
			createElement(AlertDialog, { title: '삭제할까요?', confirmLabel: '삭제', onConfirm: noop, onCancel: noop })
		);
		expect(both).toMatch(/role="alertdialog" aria-modal="true" aria-label="삭제할까요\?"/);
		expect(both).toContain('>취소</button>');
		expect(both).toContain('>삭제</button>');
		const single = html(
			createElement(AlertDialog, {
				title: '경고',
				confirmLabel: '확인',
				cancelLabel: null,
				onConfirm: noop,
				onCancel: noop,
			})
		);
		expect(single).not.toContain('>취소</button>');
	});

	it('시트: 역할 dialog와 label. 손잡이는 읽지 않고, 덮개 없는 cover는 바깥을 가리지 않는다', () => {
		const page = html(createElement(Sheet, { label: '새 메일', onClose: noop, children: '내용' }));
		expect(page).toMatch(/role="dialog" aria-modal="true" aria-label="새 메일"/);
		expect(page).toContain('<span class="ui-sheet-grabber" aria-hidden="true">');
		const cover = html(
			createElement(Sheet, { label: '지금 재생 중', onClose: noop, variant: 'cover', children: '내용' })
		);
		expect(cover).toContain('aria-label="지금 재생 중"');
		expect(cover).not.toContain('aria-modal');
	});
});
