// zod가 eval(new Function)로 검사 함수를 만들지 않게 한다. 서버·브라우저 모두 eval 계열을 실행하지 않는다.
// zod는 처음 검사할 때 Function('')을 실행해 eval을 쓸 수 있는지 보는데, 브라우저에서는 사이트 CSP가 eval을 막아
// 그 시도가 Issues 패널에 CSP 위반으로 남았다 (Lighthouse 권장사항). jitless면 이 확인 없이 해석 방식으로 검사하고 결과는 같다
import { z } from 'zod';

z.config({ jitless: true });
