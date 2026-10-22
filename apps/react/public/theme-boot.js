// 첫 화면이 그려지기 전에 테마를 적용해 깜빡임을 막는다 (shared/settings/settingsStore.ts와 같은 키)
try {
	var theme = (JSON.parse(localStorage.getItem('macfolio:settings')) || {}).theme || 'system';
	if (theme === 'system') theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
} catch (e) {}

// 스크립트(앱)를 받는 동안 첫 그림(index.html의 #boot-splash)의 "탭하여 로딩을 시작하세요"를 누르면 적어 둔다.
// 로딩 화면(LoadingScreen)이 뜨자마자 이 값을 보고 바로 시작해서, 두 번 누르지 않아도 된다
addEventListener(
	'click',
	function () {
		window.__macfolioTapped = true;
	},
	{ once: true }
);
