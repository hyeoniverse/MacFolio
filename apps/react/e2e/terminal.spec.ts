import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

async function openTerminal(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'terminal').click();
	const terminal = appWindow(page, 'terminal');
	const input = terminal.getByRole('textbox', { name: '명령어 입력' });
	await expect(input).toBeFocused();
	const output = terminal.getByRole('log', { name: '터미널 출력' });
	const run = async (command: string) => {
		await input.fill(command);
		await input.press('Enter');
	};
	return { terminal, input, output, run };
}

test.describe('터미널', () => {
	test('명령어로 자기소개와 프로젝트를 볼 수 있다', async ({ page }) => {
		const { output, run } = await openTerminal(page);
		await expect(output).toContainText('help를 입력하면');

		await run('whoami');
		await expect(output).toContainText('김정현 (Kim Jeong Hyeon)');

		// 프로젝트는 GitHub 고정 저장소와 같다 (shared/profile/projects/)
		await run('project 4');
		await expect(output).toContainText('QRU 큐알유');
		await expect(output.getByRole('link', { name: 'https://github.com/hyeoniverse/QRU' })).toHaveAttribute(
			'target',
			'_blank'
		);
		await expect(output.getByRole('link', { name: 'https://qryou-app.web.app' })).toHaveAttribute('target', '_blank');
	});

	test('없는 명령은 zsh처럼 알려준다', async ({ page }) => {
		const { output, run } = await openTerminal(page);
		await run('ls');
		await expect(output).toContainText('zsh: command not found: ls');
	});

	test('open 명령으로 다른 앱을 연다', async ({ page }) => {
		const { run } = await openTerminal(page);
		await run('open 메모');
		await expect(appWindow(page, 'memo')).toBeVisible();
	});

	test('Tab 자동 완성과 ↑↓ 기록', async ({ page }) => {
		const { input, output, run } = await openTerminal(page);
		await input.fill('who');
		await input.press('Tab');
		await expect(input).toHaveValue('whoami ');

		await input.fill('open me');
		await input.press('Tab');
		await expect(output).toContainText('messages   memo');

		await input.fill('');
		await run('date');
		await run('skills');
		await input.press('ArrowUp');
		await expect(input).toHaveValue('skills');
		await input.press('ArrowUp');
		await expect(input).toHaveValue('date');
		await input.press('ArrowDown');
		await expect(input).toHaveValue('skills');
		await input.press('ArrowDown');
		await expect(input).toHaveValue('');
	});

	test('clear는 화면을 지우고, exit은 터미널을 닫는다', async ({ page }) => {
		const { terminal, output, run } = await openTerminal(page);
		await run('whoami');
		await run('clear');
		await expect(output).not.toContainText('김정현');

		await run('exit');
		await expect(terminal).toBeHidden();
	});
});
