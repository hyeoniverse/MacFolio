// 브라우저에서는 zod가 eval(new Function)로 검사 함수를 만들지 않게 한다. zod는 처음 검사할 때 Function('')을 실행해 eval을 쓸 수 있는지 보는데,
// 사이트 CSP가 eval을 막아 그 시도가 브라우저의 Issues 패널에 CSP 위반으로 남았다 (Lighthouse 권장사항).
// 서버(Node)에는 CSP가 없으니 그대로 빠른 검사 함수를 쓴다
import { z } from 'zod';

if ('document' in globalThis) z.config({ jitless: true });
