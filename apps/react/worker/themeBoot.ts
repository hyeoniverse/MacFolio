// 첫 화면이 그려지기 전에 도는 작은 스크립트. index.html의 <head>에 인라인으로 넣는다 (vite.config.ts의 themeBootPlugin).
// 예전에는 public/theme-boot.js 파일이었다: CSP가 인라인 스크립트를 막아서였는데, 렌더링을 막는 요청이 하나 더 생겨
// 휴대폰 Lighthouse에서 첫 화면(FCP)이 약 0.5초 늦었다. 이제 CSP는 이 내용의 SHA-256 해시만 허용한다 (securityHeaders.ts).
// 1) 테마: 깜빡임 없이 다크 모드를 먼저 적용한다 (shared/lib/storage.ts의 settings 키를 글자 그대로 읽는다)
// 2) 스크립트(앱)를 받는 동안 첫 그림(#boot-splash)을 누르면 적어 두고, 로딩 화면(LoadingScreen)이 뜨자마자 시작한다

export const THEME_BOOT =
	"try{var theme=(JSON.parse(localStorage.getItem('macfolio:settings'))||{}).theme||'system';" +
	"if(theme==='system')theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';" +
	"if(theme==='dark')document.documentElement.dataset.theme='dark'}catch(e){}" +
	"addEventListener('click',function(){window.__macfolioTapped=true},{once:true});";

/** THEME_BOOT의 SHA-256 (CSP script-src의 해시 출처). 내용을 바꾸면 themeBoot.test.ts가 새 값을 알려 준다 */
export const THEME_BOOT_HASH = 'sha256-6DYH5Q7QnQYngnO7wHLtGwfENeYqAKasPJTfMwygjfo=';
