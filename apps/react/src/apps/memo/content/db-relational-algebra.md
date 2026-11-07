---
title: 관계 대수의 연산자와 폐쇄 성질
date: 2023-04-11
category: 학습/CS/데이터베이스
series: 데이터베이스 기초
seriesOrder: 4
summary: 관계 대수의 집합 연산자와 순수 관계 연산자, 기본 연산과 복합 연산, 확장 연산, 튜플·도메인 관계 해석의 정형식과 정량자, QBE를 대학 데이터베이스 예제와 연습문제 풀이로 정리했다.
---

## 들어가기 전에

SQL로 `SELECT 이름 FROM 학생 WHERE 학과 = '컴퓨터'{:sql}`를 실행하면 DBMS는 이 문장을 "학생 릴레이션에서 학과가 컴퓨터인 행만 고르고, 이름 열만 남긴다"는 연산의 조합으로 바꿔 실행한다. 이 연산들의 체계가 관계 대수다. 관계 대수는 표(릴레이션)를 입력받아 표를 돌려주는 연산자 몇 개로 구성되어, 덧셈과 곱셈을 조합해 수식을 만들듯 연산자를 조합해 질의를 만든다. 관계 해석은 같은 질의를 "어떤 조건을 만족하는 튜플"이라는 논리식으로 적는 방법이다.

이 글이 답하려는 질문은 세 가지다. 관계 대수의 연산자는 각각 릴레이션의 어느 부분을 고르거나 잇는가. 어떤 연산이 기본이고 어떤 연산이 다른 연산의 조합인가. 같은 질의를 관계 해석과 QBE로는 어떻게 쓰는가.

| 순서 | 내용                                                          |
| ---- | ------------------------------------------------------------- |
| 1    | 관계 데이터 언어, 폐쇄 성질                                   |
| 2    | 일반 집합 연산자, 순수 관계 연산자(σ, π, ⋈, ÷, ρ)             |
| 3    | 기본·복합 연산, 확장 연산, 질의를 관계 대수식으로 바꾸는 방법 |
| 4    | 튜플·도메인 관계 해석, QBE                                    |
| 5    | 연습문제·실습 풀이                                            |

예제는 [앞 글](/memo/db-relational-model-keys)의 대학 데이터베이스(학생, 과목, 등록)를 쓴다.

## 관계 데이터 언어

연산(operation)은 시스템 관점의 표현이고, 데이터 언어(data language)는 사용자 관점의 표현이다. 관계 데이터 모델의 정형 언어(formal language)는 두 가지다.

|      | 관계 대수(relational algebra)         | 관계 해석(relational calculus)   |
| ---- | ------------------------------------- | -------------------------------- |
| 성격 | 절차 언어: 무엇을(what)과 어떻게(how) | 비절차 언어: 무엇을(what)만      |
| 종류 |                                       | 튜플 관계 해석, 도메인 관계 해석 |

==관계 대수와 관계 해석은 표현력과 기능이 동등하다.== 관계 대수식으로 쓸 수 있는 질의는 관계 해석으로도 쓸 수 있고, 그 반대도 성립한다.

## 관계 대수

관계 대수는 릴레이션(튜플의 집합)을 처리하는 연산의 집합이다.

| 분류             | 연산자                             | 기호 |
| ---------------- | ---------------------------------- | ---- |
| 일반 집합 연산자 | 합집합(UNION)                      | ∪    |
|                  | 교집합(INTERSECT)                  | ∩    |
|                  | 차집합(DIFFERENCE)                 | −    |
|                  | 카티션 프로덕트(CARTESIAN PRODUCT) | ×    |
| 순수 관계 연산자 | 실렉트(SELECT)                     | σ    |
|                  | 프로젝트(PROJECT)                  | π    |
|                  | 조인(JOIN)                         | ⋈    |
|                  | 디비전(DIVISION)                   | ÷    |

> [!IMPORTANT] 폐쇄 성질
> ==관계 대수는 피연산자와 연산 결과가 모두 릴레이션인 폐쇄 성질(closure property)을 가진다.== 그래서 한 연산의 결과를 다른 연산의 피연산자로 넣는 중첩(nested) 수식을 쓸 수 있다.

## 일반 집합 연산자

| 연산            | 정의                                                                                       | 결과 카디널리티                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 합집합          | `R \cup S = \{ t \vert t \in R \lor t \in S \}{:math}`                                     | `\lvert R \cup S \rvert \le \lvert R \rvert + \lvert S \rvert{:math}` (중복 튜플은 하나만 남는다)      |
| 교집합          | `R \cap S = \{ t \vert t \in R \land t \in S \}{:math}`                                    | `\lvert R \cap S \rvert \le \min\{\lvert R \rvert, \lvert S \rvert\}{:math}`                           |
| 차집합          | `R - S = \{ t \vert t \in R \land t \notin S \}{:math}`                                    | `\lvert R - S \rvert \le \lvert R \rvert{:math}`                                                       |
| 카티션 프로덕트 | `R \times S = \{ r \cdot s \vert r \in R \land s \in S \}{:math}` (·는 접속 concatenation) | `\lvert R \times S \rvert = \lvert R \rvert \times \lvert S \rvert{:math}`, 차수는 R의 차수 + S의 차수 |

합집합·교집합·차집합의 피연산자는 **합병 가능(union-compatible)** 해야 한다.

1. 두 릴레이션의 차수가 같다.
2. 대응하는 애트리뷰트 쌍마다 도메인이 같다.

![R = {100, 200, 300}, S = {300, 400}의 합집합·교집합·차집합 벤 다이어그램과 카티션 프로덕트 3×2 격자](./images/db-relational-algebra-set-ops.svg '학번 릴레이션 두 개에 집합 연산을 적용한 결과')

∪, ∩, ×는 결합적(associative)이고 교환적(commutative)이다. 차집합은 둘 다 아니다.

```math
\begin{aligned}
R \cup S \cup T &= (R \cup S) \cup T = R \cup (S \cup T) &\qquad R \cup S &= S \cup R \\
R \cap S \cap T &= (R \cap S) \cap T = R \cap (S \cap T) &\qquad R \cap S &= S \cap R \\
R \times S \times T &= (R \times S) \times T = R \times (S \times T) &\qquad R \times S &= S \times R
\end{aligned}
```

## 순수 관계 연산자

![실렉트, 프로젝트, 자연 조인이 고르는 부분](./images/db-relational-algebra-operators.svg '실렉트는 행을, 프로젝트는 열을 고르고, 조인은 공통 열로 두 릴레이션을 잇는다')

릴레이션 `R(X) = R(A_1, \dots, A_n){:math}`의 튜플 r에서 애트리뷰트 Ai의 값을 `r.A_i{:math}` 또는 `r[A_i]{:math}`로 쓴다. 애트리뷰트 집합 X에 대한 값은 `r[X]{:math}`다.

### 실렉트(σ)

조건을 만족하는 튜플만 고른다. 결과는 릴레이션의 **수평적 부분집합(horizontal subset)** 이다.

```math
\begin{aligned}
&\sigma_{\text{조건}}(R) = \{ r \mid r \in R \land \text{조건}(r) \} \\
&\text{조건: } A \,\theta\, v \text{ 또는 } A \,\theta\, B,\quad \theta \in \{ =, \ne, <, \le, >, \ge \},\quad \land, \lor, \lnot \text{ 로 결합 가능}
\end{aligned}
```

조건식(predicate)은 데이터 언어 형식으로 `R WHERE 조건식`처럼 쓰기도 한다. 실렉트는 교환적이고, 연속된 실렉트는 조건을 ∧로 묶은 실렉트 하나와 같다.

```math
\sigma_{\text{조건}_2}(\sigma_{\text{조건}_1}(R)) = \sigma_{\text{조건}_1}(\sigma_{\text{조건}_2}(R)) = \sigma_{\text{조건}_1 \land \text{조건}_2}(R)
```

==선택도(selectivity)는 선택 조건으로 검색되는 튜플의 비율이다.==

`\sigma_{\text{학과}=\text{'컴퓨터'}}(\text{학생}){:math}`의 결과는 다음과 같다.

| 학번 | 이름   | 학년 | 학과   |
| ---- | ------ | ---- | ------ |
| 100  | 나수영 | 4    | 컴퓨터 |
| 300  | 정기태 | 1    | 컴퓨터 |
| 400  | 송병길 | 4    | 컴퓨터 |

`\sigma_{\text{학번}=300 \land \text{과목번호}=\text{'C312'}}(\text{등록}){:math}`은 `<300, C312, A, 90, 95>` 한 튜플을 반환한다. 조건에 애트리뷰트끼리의 비교도 쓸 수 있어, `\sigma_{\text{중간성적}<\text{기말성적}}(\text{등록}){:math}`은 기말성적이 중간성적보다 높은 다음 다섯 튜플을 반환한다.

| 학번 | 과목번호 | 성적 | 중간성적 | 기말성적 |
| ---- | -------- | ---- | -------- | -------- |
| 100  | C413     | A    | 90       | 95       |
| 300  | C312     | A    | 90       | 95       |
| 400  | C312     | A    | 90       | 95       |
| 400  | C413     | B    | 80       | 85       |
| 400  | E412     | C    | 65       | 75       |

![σAθv(R), σAθB(R) 정의식과 θ 비교 연산자·상수 v 설명](./images/db-relational-algebra-note-01.jpg 'σAθv(R), σAθB(R) 정의식과 θ 비교 연산자·상수 v 설명')

### 프로젝트(π)

지정한 애트리뷰트만 남긴다. 결과는 릴레이션의 **수직적 부분집합(vertical subset)** 이다.

```math
\begin{aligned}
&Y \subseteq X,\ Y = \{B_1, \dots, B_m\} \text{ 일 때} \\
&\pi_Y(R) = \{ \langle r.B_1, \dots, r.B_m \rangle \mid r \in R \}
\end{aligned}
```

> [!WARNING]
> ==결과도 릴레이션이므로 중복 튜플은 제거된다.== `\pi_{\text{학과}}(\text{학생}){:math}`은 다섯 튜플이 아니라 {컴퓨터, 전기, 산공} 세 튜플이다.

같은 릴레이션에 프로젝트를 겹쳐 쓰면 바깥쪽만 남는다(`\pi_Y(\pi_X(R)) = \pi_Y(R){:math}`, `Y \subseteq X{:math}`).

![π이름,학과(학생) 결과 표(이름·학과 5행)](./images/db-relational-algebra-note-02.jpg 'π이름,학과(학생) 결과 표(이름·학과 5행)')

### 조인(⋈)

두 릴레이션의 튜플을 조건에 따라 연결한다. 조건에 쓰는 애트리뷰트를 조인 애트리뷰트(join attribute)라 한다.

| 종류                                        | 정의                                                                                                     | 결과 애트리뷰트                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 세타 조인(theta join)                       | `R \bowtie_{A \theta B} S = \{ r \cdot s \vert r \in R \land s \in S \land r.A \,\theta\, s.B \}{:math}` | R의 차수 + S의 차수                                  |
| 동일 조인(equijoin)                         | 세타 조인에서 θ가 `=`인 경우                                                                             | R의 차수 + S의 차수 (조인 애트리뷰트가 두 번 나온다) |
| 자연 조인(natural join, `\bowtie_N{:math}`) | 동일 조인 결과에서 중복 조인 애트리뷰트를 제거                                                           | R과 S의 애트리뷰트 합집합                            |

결과 릴레이션에서 이름이 같은 애트리뷰트는 원래 릴레이션 이름을 한정어로 붙여 `학생.학번`, `등록.학번`처럼 구분한다. 이름이 겹치지 않는 애트리뷰트는 이름만 쓴다.

자연 조인은 `R(X){:math}`, `S(Y){:math}`의 공통 애트리뷰트 `Z = X \cap Y{:math}`로 연결한다.

```math
\begin{aligned}
R \bowtie_N S &= \{ \langle r \cdot s \rangle [X \cup Y] \mid r \in R \land s \in S \land r[Z] = s[Z] \} \\
&= \pi_{X \cup Y}(\sigma_{Z=Z}(R \times S)) \\
&= \pi_{X \cup Y}(R \bowtie_{Z=Z} S)
\end{aligned}
```

==보통 "조인"이라고 하면 자연 조인을 뜻한다.== `\text{학생} \bowtie_N \text{등록}{:math}`의 앞부분은 다음과 같다.

| 학번 | 이름   | 학년 | 학과   | 과목번호 | 성적 | 중간성적 | 기말성적 |
| ---- | ------ | ---- | ------ | -------- | ---- | -------- | -------- |
| 100  | 나수영 | 4    | 컴퓨터 | C413     | A    | 90       | 95       |
| 100  | 나수영 | 4    | 컴퓨터 | E412     | A    | 95       | 95       |
| 200  | 이찬수 | 3    | 전기   | C123     | B    | 85       | 80       |
| 300  | 정기태 | 1    | 컴퓨터 | C312     | A    | 90       | 95       |
| …    |        |      |        |          |      |          |          |

#### 조인을 쓰는 이유

==두 릴레이션을 조인할 수 있다는 것은 연결점이 있다는 뜻이고, 그 연결점은 대부분 기본 키와 외래 키의 조합이다.== 조인으로 여러 릴레이션을 하나로 합치면 한 릴레이션만으로는 알 수 없던 정보에 조건을 걸 수 있다. 위 결과에서는 "컴퓨터학과 학생의 C413 성적"처럼 학생과 등록에 흩어진 정보를 함께 조회할 수 있다.

![학생⋈학번=학번 등록 동일 조인 결과표(학생.학번과 등록.학번이 모두 남은 9열 11행)](./images/db-relational-algebra-note-04.jpg '학생⋈학번=학번 등록 동일 조인 결과표(학생.학번과 등록.학번이 모두 남은 9열 11행)')

![학생⋈N등록 자연 조인 결과표(학번이 한 번만 남은 8열 11행)](./images/db-relational-algebra-note-05.jpg '학생⋈N등록 자연 조인 결과표(학번이 한 번만 남은 8열 11행)')

### 디비전(÷)

`R(X){:math}`, `S(Y){:math}`에서 `Y \subseteq X{:math}`이고 `D = X - Y{:math}`일 때(`R(X) = R(D, Y){:math}`), S의 모든 튜플과 짝을 이루는 R의 D 부분을 구한다.

```math
\begin{aligned}
R \div S &= \{ t \mid t \in \pi_D(R) \land t \cdot s \in R \text{ for all } s \in S \} \\
(R \div S) \times S &\subseteq R
\end{aligned}
```

=="모든 과목을 수강한 학생"처럼 "모든"이 들어간 질의에 쓴다.==

![등록의 학번·과목번호를 {C312, C413}으로 나눠 두 과목을 모두 등록한 학번 300, 400을 구하는 디비전 예](./images/db-relational-algebra-division.svg '제수의 과목을 모두 가진 학번만 몫에 남는다')

```math
\pi_{\text{학번},\text{이름}}((\pi_{\text{학번},\text{과목번호}}(\text{등록}) \div \pi_{\text{과목번호}}(\text{과목})) \bowtie_N \text{학생})
```

예제 데이터에서는 과목 다섯 개를 모두 등록한 학생이 없어 결과가 공집합이다. 가장 많이 등록한 송병길(400)도 C123을 등록하지 않았다.

![학과목(SC)을 과목1·2·3(C1·C2·C3)으로 나눈 SC÷C1·SC÷C2·SC÷C3 결과 예시](./images/db-relational-algebra-note-06.jpg '학과목(SC)을 과목1·2·3(C1·C2·C3)으로 나눈 SC÷C1·SC÷C2·SC÷C3 결과 예시')

### 개명 연산(ρ)

중간 결과 릴레이션에 이름을 붙이거나 애트리뷰트 이름을 바꾼다.

| 형식                                  | 의미                                                           |
| ------------------------------------- | -------------------------------------------------------------- |
| `\rho_S(E){:math}`                    | 관계 대수식 E의 결과 릴레이션 이름을 S로 지정                  |
| `\rho_{S(B_1, \dots, B_m)}(E){:math}` | 결과 릴레이션 이름을 S로, 애트리뷰트 이름을 B1, …, Bm으로 지정 |
| `\rho_{(B_1, \dots, B_m)}(R){:math}`  | 릴레이션 R의 애트리뷰트 이름만 B1, …, Bm으로 변경              |

## 기본 연산과 복합 연산

|        | 기본 연산(primitive)                                            | 복합 연산(composite)                  |
| ------ | --------------------------------------------------------------- | ------------------------------------- |
| 정의   | 다른 연산으로 대체할 수 없는 하나의 논리적 기능을 수행하는 연산 | 기본 연산 몇 개로 대체할 수 있는 연산 |
| 연산자 | ∪, −, ×, σ, π                                                   | ∩, ⋈, ÷                               |

```math
\begin{aligned}
R \cap S &= R - (R - S) = S - (S - R) = (R \cup S) - ((R - S) \cup (S - R)) \\
R \bowtie_{A \theta B} S &= \sigma_{A \theta B}(R \times S) \\
R(Z, Y) \div S(Y) &= R[Z] - ((R[Z] \times S) - R)[Z]
\end{aligned}
```

==복합 연산은 연산력을 늘리지 않고 표현력을 늘린다.== 조인은 카티션 프로덕트 뒤에 실렉트를 적용한 것과 같지만, 질의를 훨씬 짧게 쓸 수 있다.

## 관계 대수의 확장

| 연산                     | 기호                 | 정의                                                                                                            | 용도                                                    |
| ------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 세미 조인(semijoin)      | `\ltimes{:math}`     | S와 자연 조인할 수 있는 R의 튜플만 남긴다. `R \ltimes S = R \bowtie_N (\pi_Z(S)) = \pi_X(R \bowtie_N S){:math}` | 분산 질의에서 전송할 데이터 양을 줄인다                 |
| 외부 조인(outer join)    | `\bowtie^{+}{:math}` | 상대 릴레이션에 대응하는 튜플이 없으면 상대 쪽을 널로 채워 결과에 포함한다                                      | 누락 정보 처리. 두 릴레이션의 튜플이 모두 결과에 남는다 |
| 외부 합집합(outer union) | `\cup^{+}{:math}`    | 합병 가능하지 않은 두 릴레이션을 모든 애트리뷰트를 가진 릴레이션으로 합치고, 없는 값은 널로 채운다              | 구조가 다른 릴레이션 합치기                             |
| 집계(aggregation)        | `\mathcal{G}{:math}` | 그룹별로 집계 함수를 적용한다                                                                                   | 평균, 개수 같은 통계                                    |

> [!WARNING]
> 세미 조인은 교환 법칙이 성립하지 않는다(`R \ltimes S \ne S \ltimes R{:math}`).

대신 `R \bowtie_N S = (R \ltimes S) \bowtie_N S = (S \ltimes R) \bowtie_N R{:math}`이 성립해, 먼저 한쪽 릴레이션을 줄인 뒤 조인해도 같은 결과를 얻는다. 두 식은 결과가 같지만 처리 과정에서 다루는 데이터 양이 다르다.

![R(A,B,C)·S(B,C,D)의 자연 조인 R⋈NS와 세미 조인 R⋉S(ΠX∩Y(S) 경유)를 비교한 도식](./images/db-relational-algebra-note-07.jpg 'R(A,B,C)·S(B,C,D)의 자연 조인 R⋈NS와 세미 조인 R⋉S(ΠX∩Y(S) 경유)를 비교한 도식')

![R⋈+S 외부 조인(짝 없는 a3·b3 행을 널로 채움)과 R⋈NS 자연 조인 결과 비교 도식](./images/db-relational-algebra-note-08.jpg 'R⋈+S 외부 조인(짝 없는 a3·b3 행을 널로 채움)과 R⋈NS 자연 조인 결과 비교 도식')

![R(A,B,C)와 S(B,C,D)를 ∪+로 합쳐 A~D 4열에 없는 값은 비워 둔 외부 합집합 결과 도식](./images/db-relational-algebra-note-09.jpg 'R(A,B,C)와 S(B,C,D)를 ∪+로 합쳐 A~D 4열에 없는 값은 비워 둔 외부 합집합 결과 도식')

### 집계 연산

```math
G_A \, F_B(E)
```

- `E{:math}`: 관계 대수식(릴레이션)
- `G{:math}`: 그룹 함수 GROUP, `A{:math}`: 그룹을 나눌 애트리뷰트
- `F{:math}`: 집계 함수(SUM, AVG, MAX, MIN, COUNT), `B{:math}`: 집계 함수를 적용할 애트리뷰트

| 식                                                                             | 의미                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `\text{AVG}_{\text{성적}}(\text{등록}){:math}`                                 | 등록 릴레이션 전체 성적의 평균                        |
| `\text{GROUP}_{\text{학년}}(\text{학생}){:math}`                               | 학생 튜플을 학년별 그룹으로 나눈다                    |
| `\text{GROUP}_{\text{과목번호}}\,\text{AVG}_{\text{성적}}(\text{등록}){:math}` | 과목별 평균 성적. GROUP을 먼저, AVG를 다음에 실행한다 |
| `\text{GROUP}_{\text{학번}}\,\text{AVG}_{\text{성적}}(\text{등록}){:math}`     | 학생별 평균 성적                                      |

![집계 연산 일반 형식 G_A F_B(E) 한 줄 수식](./images/db-relational-algebra-note-10.jpg '집계 연산 일반 형식 G_A F_B(E) 한 줄 수식')

## 질의문을 관계 대수식으로 표현하기

> [!TIP]
> 질의를 관계 대수식으로 바꿀 때는 다음 순서로 판단한다.
>
> 1. 사용자가 최종적으로 알고 싶은 애트리뷰트(→ 프로젝트)와 조건(→ 실렉트)은 무엇인가
> 2. 필요한 애트리뷰트가 한 릴레이션에 다 있는가. 없으면 어떤 릴레이션끼리 조인해야 하는가
> 3. 두 릴레이션을 조인할 수 있는가. 조인 애트리뷰트는 무엇인가

| 질의                                      | 관계 대수식                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 모든 학생의 이름과 학과                   | `\pi_{\text{이름},\text{학과}}(\text{학생}){:math}`                                                               |
| 과목번호 C413에 등록한 학생의 이름과 성적 | `\pi_{\text{이름},\text{성적}}(\sigma_{\text{과목번호}=\text{'C413'}}(\text{학생} \bowtie_N \text{등록})){:math}` |
| 파일구조 과목의 담당교수                  | `\pi_{\text{담당교수}}(\sigma_{\text{과목이름}=\text{'파일구조'}}(\text{과목})){:math}`                           |
| 학생 <600, 김영호, 4, 컴퓨터> 삽입        | `\text{학생} \cup \{\langle 600, \text{'김영호'}, 4, \text{'컴퓨터'} \rangle\}{:math}`                            |
| 데이터베이스 과목 삭제                    | `\text{과목} - \sigma_{\text{과목이름}=\text{'데이터베이스'}}(\text{과목}){:math}`                                |

"담당교수가 황수관인 과목을 수강한 학생의 학번과 중간성적"은 세 단계로 나눠 쓸 수 있다. 중간 결과에 이름을 붙이면 아래 질의 트리처럼 잎에서 뿌리 방향으로 계산 순서가 드러난다.

![과목에 실렉트, 등록과 조인, 프로젝트 순서로 계산하는 질의 트리](./images/db-relational-algebra-query-tree.svg '폐쇄 성질 덕분에 각 단계의 결과 릴레이션이 다음 연산의 입력이 된다')

```text
A = σ담당교수='황수관'(과목)              -- C312 자료구조 한 튜플
B = 등록 ⋈과목번호=과목번호 A             -- C312를 수강한 등록 튜플 3개
C = π학번,중간성적(B)
```

| 학번 | 중간성적 |
| ---- | -------- |
| 300  | 90       |
| 400  | 90       |
| 500  | 85       |

같은 질의를 SQL로 쓰면 다음과 같다. SQL 문법은 [다음 글](/memo/db-sql-ddl-dml)에서 다룬다.

```sql
SELECT E.Sno, E.Midterm
FROM ENROL E JOIN COURSE C ON E.Cno = C.Cno
WHERE C.Prname = '황수관';
```

## 관계 해석

관계 해석은 프레디킷 해석(predicate calculus)에 기반한다. 프레디킷은 실행 결과가 반드시 참(true)이나 거짓(false)인 함수다. ==관계 해석은 원하는 정보가 무엇인지만 선언하는 비절차적(non-procedural) 표현 방법이다.== 변수가 무엇을 가리키느냐에 따라 두 가지로 나뉜다.

| 종류             | 변수                                       | 기반 언어 예 |
| ---------------- | ------------------------------------------ | ------------ |
| 튜플 관계 해석   | 튜플 변수: 릴레이션의 튜플 하나            | QUEL         |
| 도메인 관계 해석 | 도메인 변수: 애트리뷰트 도메인의 원소 하나 | QBE          |

> [!NOTE]
> 아래 식은 영문 스키마 `STUDENT(Sno, Sname, Year, Dept)`, `COURSE(Cno, Cname, Credit, Dept, PRname)`, `ENROL(Sno, Cno, Grade, Midterm, Final)`로 쓴다.

### 튜플 관계 해석

원하는 릴레이션을 튜플 해석식(tuple calculus expression)으로 정의하는 표기법이다.

#### 구성 요소

| 구성 요소                                            | 형식                                                                                                  | 예                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------- |
| 튜플 변수(tuple variable), 범위 변수(range variable) | `t{:math}`                                                                                            | `s{:math}`                    |
| 범위식(range formula)                                | `R(t){:math}`, R은 t의 범위 릴레이션(range relation)                                                  | `\text{STUDENT}(s){:math}`    |
| 한정 애트리뷰트(qualified attribute)                 | `t.A{:math}` 또는 `t[A]{:math}`: t가 나타내는 튜플의 애트리뷰트 A 값                                  | `s.\mathit{Sno}{:math}`       |
| 원자식(atomic formula)                               | 범위식 `R(t){:math}`, 조건식 `t.A \,\theta\, u.B{:math}`, 조건식 `t.A \,\theta\, c{:math}` (c는 상수) | `s.\mathit{Sno} = 100{:math}` |

원자식의 실행 결과는 반드시 참 또는 거짓이다.

#### 정형식

정형식(WFF, well-formed formula)은 원자식, 불리언 연산자(∧, ∨, ¬), 정량자(∀, ∃)를 다음 규칙으로 결합한 식이다.

1. 모든 원자식은 WFF다.
2. F가 WFF이면 (F)와 ¬F도 WFF다.
3. F와 G가 WFF이면 F ∧ G와 F ∨ G도 WFF다.
4. 튜플 변수 t가 자유 변수로 쓰인 F(t)가 WFF이면 `(\forall t)(F(t)){:math}`와 `(\exists t)(F(t)){:math}`도 WFF다.
5. 위 규칙만 적용해 만든 식이 WFF다.

```math
\begin{aligned}
&s.\mathit{Sno} = 100 \\
&c.\mathit{Cno} \ne e.\mathit{Cno} \\
&s.\mathit{Sno} = e.\mathit{Sno} \land e.\mathit{Cno} \ne c.\mathit{Cno} \\
&(\exists e)(e.\mathit{Sno} = s.\mathit{Sno} \land e.\mathit{Cno} = \text{'C413'})
\end{aligned}
```

#### 자유 변수와 속박 변수

| 용어                                  | 의미                                                      |
| ------------------------------------- | --------------------------------------------------------- |
| 전칭 정량자(universal quantifier) ∀   | "for all", 모든 튜플에 대해 참                            |
| 존재 정량자(existential quantifier) ∃ | "there exists", "for some", 참인 튜플이 하나 이상 존재    |
| 자유 변수(free variable)              | 정량자로 한정되지 않은 튜플 변수                          |
| 속박 변수(bound variable)             | `\forall t{:math}`, `\exists t{:math}`로 한정된 튜플 변수 |

위 마지막 정형식에서 e는 ∃로 한정된 속박 변수이고, s는 자유 변수다. 정량자를 모두 앞에 먼저 기술한 WFF를 프리넥스 정규형(prenex normal form)이라 하며, 다음 변환을 쓴다.

```math
\begin{aligned}
(\forall t)(F(t)) \land (\forall t)(H(t)) &= (\forall t)(F(t) \land H(t)) \\
(\exists t)(F(t)) \lor (\exists t)(H(t)) &= (\exists t)(F(t) \lor H(t))
\end{aligned}
```

#### 튜플 해석식

```math
\{ t_1.A_1, t_2.A_2, \dots, t_n.A_n \mid F(t_1, \dots, t_n, t_{n+1}, \dots, t_{n+m}) \}
```

막대(`|`) 왼편의 한정 애트리뷰트는 목표 리스트(target list)이고, 오른편의 정형식 F가 조건이다. F를 만족하는 튜플에서 목표 리스트의 값을 추출한다. ==목표 리스트에는 자유 변수만 나올 수 있다.==

| 튜플 해석식                                                                                                                                                                           | 의미                                     | 예제 데이터 결과                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| `\{ s.\mathit{Sname} \vert \text{STUDENT}(s) \}{:math}`                                                                                                                               | 모든 학생의 이름                         | 다섯 명 전부                                |
| `\{ s.\mathit{Sname} \vert \text{STUDENT}(s) \land s.\mathit{Dept} = \text{'컴퓨터'} \}{:math}`                                                                                       | 컴퓨터학과 학생의 이름                   | 나수영, 정기태, 송병길                      |
| `\{ s.\mathit{Sname}, s.\mathit{Dept} \vert \text{STUDENT}(s) \land (\exists e)(\text{ENROL}(e) \land s.\mathit{Sno} = e.\mathit{Sno} \land e.\mathit{Grade} = \text{'A'}) \}{:math}` | 성적 A를 받은 적 있는 학생의 이름과 학과 | 나수영 컴퓨터, 정기태 컴퓨터, 송병길 컴퓨터 |

#### 질의 예

| 질의                             | 튜플 해석식                                                                                                                                                                                              | 예제 데이터 결과                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| C413에서 성적이 A인 학생의 학번  | `\{ e.\mathit{Sno} \vert \text{ENROL}(e) \land e.\mathit{Cno} = \text{'C413'} \land e.\mathit{Grade} = \text{'A'} \}{:math}`                                                                             | 100, 300                          |
| C413에 등록한 학생의 이름과 학과 | `\{ s.\mathit{Sname}, s.\mathit{Dept} \vert \text{STUDENT}(s) \land (\exists e)(\text{ENROL}(e) \land s.\mathit{Sno} = e.\mathit{Sno} \land e.\mathit{Cno} = \text{'C413'}) \}{:math}`                   | 나수영·정기태·송병길, 모두 컴퓨터 |
| 모든 과목에 등록한 학생의 이름   | `\{ s.\mathit{Sname} \vert \text{STUDENT}(s) \land (\forall c)(\text{COURSE}(c) \to (\exists e)(\text{ENROL}(e) \land e.\mathit{Sno} = s.\mathit{Sno} \land e.\mathit{Cno} = c.\mathit{Cno})) \}{:math}` | 공집합                            |
| C413에 등록하지 않은 학생의 이름 | `\{ s.\mathit{Sname} \vert \text{STUDENT}(s) \land \lnot(\exists e)(\text{ENROL}(e) \land s.\mathit{Sno} = e.\mathit{Sno} \land e.\mathit{Cno} = \text{'C413'}) \}{:math}`                               | 이찬수, 박종화                    |

"모든"은 ∀로, "하지 않은"은 ¬∃로 쓴다.

> [!WARNING]
> 셋째 식에서 `\text{COURSE}(c){:math}`를 `\land`로 붙여 `(\forall c)(\exists e)(\text{COURSE}(c) \land \text{ENROL}(e) \land \dots){:math}`로 쓰면, 정형식 규칙상 모든 튜플이 COURSE에 속해야 참이 된다. ∀로 한정한 변수의 범위는 `\text{COURSE}(c) \to \dots{:math}`(= `\lnot \text{COURSE}(c) \lor \dots{:math}`)로 제한한다.

### 도메인 관계 해석

원하는 릴레이션을 도메인 해석식(domain calculus expression)으로 정의하는 표기법이다. ==도메인 변수(domain variable)는 지정된 애트리뷰트 도메인의 한 원소만을 취하는 변수다.== `x_{\mathit{Sno}}{:math}`, `x_{\mathit{Sname}}{:math}`, `x_{\mathit{Year}}{:math}`, `x_{\mathit{Dept}}{:math}`처럼 애트리뷰트마다 변수를 하나씩 둔다.

| 원자식                                  | 의미                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 범위식 `R(x_1, x_2, \dots, x_n){:math}` | 값의 리스트 `\langle x_1, \dots, x_n \rangle{:math}`이 릴레이션 R의 튜플이다. `\text{STUDENT}(x_{\mathit{Sno}}, x_{\mathit{Sname}}, x_{\mathit{Year}}, x_{\mathit{Dept}}){:math}`처럼 도메인 변수를 선언한다 |
| 조건식 `x \,\theta\, y{:math}`          | 도메인 변수끼리 비교                                                                                                                                                                                         |
| 조건식 `x \,\theta\, c{:math}`          | c는 x가 정의된 도메인의 상수                                                                                                                                                                                 |

정형식 규칙은 튜플 관계 해석과 같고, 규칙 4의 튜플 변수 자리에 도메인 변수가 들어간다.

```math
\{ x_1, x_2, \dots, x_n \mid F(x_1, \dots, x_n, x_{n+1}, \dots, x_{n+m}) \}
```

막대 왼편의 도메인 변수 n개가 목표 리스트이고, 오른편 정형식을 만족하는 도메인 값으로 결과 튜플을 만든다.

| 질의                                    | 도메인 해석식                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 예제 데이터 결과                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 모든 학생의 이름                        | `\{ x_{\mathit{Sname}} \vert (\exists x_{\mathit{Sno}})(\exists x_{\mathit{Year}})(\exists x_{\mathit{Dept}})\, \text{STUDENT}(x_{\mathit{Sno}}, x_{\mathit{Sname}}, x_{\mathit{Year}}, x_{\mathit{Dept}}) \}{:math}`                                                                                                                                                                                                                                                                                   | 다섯 명 전부                       |
| 컴퓨터학과 학생의 이름                  | `\{ x_{\mathit{Sname}} \vert (\exists x_{\mathit{Sno}})(\exists x_{\mathit{Year}})(\exists x_{\mathit{Dept}})(\text{STUDENT}(x_{\mathit{Sno}}, x_{\mathit{Sname}}, x_{\mathit{Year}}, x_{\mathit{Dept}}) \land x_{\mathit{Dept}} = \text{'컴퓨터'}) \}{:math}`                                                                                                                                                                                                                                          | 나수영, 정기태, 송병길             |
| 컴퓨터학과 3·4학년의 이름               | `\{ x_{\mathit{Sname}} \vert (\exists x_{\mathit{Sno}})(\exists x_{\mathit{Year}})(\exists x_{\mathit{Dept}})(\text{STUDENT}(x_{\mathit{Sno}}, x_{\mathit{Sname}}, x_{\mathit{Year}}, x_{\mathit{Dept}}) \land x_{\mathit{Year}} \ge 3 \land x_{\mathit{Dept}} = \text{'컴퓨터'}) \}{:math}`                                                                                                                                                                                                            | 나수영, 송병길                     |
| C413에서 성적이 A인 학생의 학번         | `\{ x_{\mathit{Sno}} \vert (\exists x_{\mathit{Cno}})(\exists x_{\mathit{Grade}})(\exists x_{\mathit{Midterm}})(\exists x_{\mathit{Final}})(\text{ENROL}(x_{\mathit{Sno}}, x_{\mathit{Cno}}, x_{\mathit{Grade}}, x_{\mathit{Midterm}}, x_{\mathit{Final}}) \land x_{\mathit{Cno}} = \text{'C413'} \land x_{\mathit{Grade}} = \text{'A'}) \}{:math}`                                                                                                                                                     | 100, 300                           |
| 기말성적 90점 이상인 학생의 학번과 이름 | `\{ x_{\mathit{Sno}}, x_{\mathit{Sname}} \vert (\exists x_{\mathit{Year}})(\exists x_{\mathit{Dept}})(\text{STUDENT}(x_{\mathit{Sno}}, x_{\mathit{Sname}}, x_{\mathit{Year}}, x_{\mathit{Dept}}) \land (\exists x_{\mathit{Cno}})(\exists x_{\mathit{Grade}})(\exists x_{\mathit{Midterm}})(\exists x_{\mathit{Final}})(\text{ENROL}(x_{\mathit{Sno}}, x_{\mathit{Cno}}, x_{\mathit{Grade}}, x_{\mathit{Midterm}}, x_{\mathit{Final}}) \land x_{\mathit{Final}} \ge 90)) \}{:math}`                     | 100 나수영, 300 정기태, 400 송병길 |
| C324에 등록하지 않은 학생의 이름        | `\{ x_{\mathit{Sname}} \vert (\exists x_{\mathit{Sno}})(\exists x_{\mathit{Year}})(\exists x_{\mathit{Dept}})(\text{STUDENT}(x_{\mathit{Sno}}, x_{\mathit{Sname}}, x_{\mathit{Year}}, x_{\mathit{Dept}}) \land \lnot(\exists x_{\mathit{Cno}})(\exists x_{\mathit{Grade}})(\exists x_{\mathit{Midterm}})(\exists x_{\mathit{Final}})(\text{ENROL}(x_{\mathit{Sno}}, x_{\mathit{Cno}}, x_{\mathit{Grade}}, x_{\mathit{Midterm}}, x_{\mathit{Final}}) \land x_{\mathit{Cno}} = \text{'C324'})) \}{:math}` | 나수영, 이찬수, 박종화             |

목표 리스트 밖의 도메인 변수는 모두 ∃로 한정해 속박 변수로 만든다. 두 범위식에 같은 도메인 변수(예: `x_{\mathit{Sno}}{:math}`)를 함께 쓰면 두 값이 같다는 조인 조건이 된다.

### QBE

QBE(Query By Example)는 IBM의 Zloof가 1975년에 개발한 질의어로, 도메인 관계 해석을 사용한다. 그래픽 디스플레이 단말기에서 테이블 형태의 골격(skeleton)에 값을 채워 넣는 이차원 구문(two-dimensional syntax) 언어다. ==질의를 명세할 때 쓰는 예제 원소(example element)가 도메인 변수 역할을 한다.== 아래 표에서 `_X`처럼 밑줄로 시작하는 값이 예제 원소이고, 그 밖의 값은 상수다.

| 명령     | 의미                                                      |
| -------- | --------------------------------------------------------- |
| `P.`     | 출력(print). 테이블 이름 밑에 쓰면 테이블 전체를 검색한다 |
| `P.ALL.` | 중복을 허용해 출력. `P.`만 쓰면 중복은 자동으로 제거된다  |
| `I.`     | 삽입(insert)                                              |
| `D.`     | 삭제(delete)                                              |
| `U.`     | 갱신(update). 갱신할 튜플은 기본 키로 명세한다            |

#### 검색

컴퓨터학과 4학년 학생의 학번과 이름은 한 행에 조건과 `P.`를 함께 적는다. 결과는 100 나수영, 400 송병길이다.

| STUDENT | Sno | Sname | Year | Dept   |
| ------- | --- | ----- | ---- | ------ |
|         | P.  | P.    | 4    | 컴퓨터 |

==같은 행이나 같은 예제 원소는 AND, 서로 다른 행과 서로 다른 예제 원소는 OR 조건이다.== "기말성적이 85점 이상이거나 C413에 등록한 학생의 학번"은 두 행으로 쓴다.

| ENROL | Sno   | Cno  | Grade | Midterm | Final |
| ----- | ----- | ---- | ----- | ------- | ----- |
|       | P.\_X |      |       |         | ≥85   |
|       | P.\_Y | C413 |       |         |       |

"C413에 등록했고 기말성적이 85점 이상인 학생의 학번"은 한 행에 쓴다. 조건이 복잡하면 조건 상자(condition box)에 따로 적을 수도 있다.

| ENROL | Sno | Cno  | Grade | Midterm | Final |
| ----- | --- | ---- | ----- | ------- | ----- |
|       | P.  | C413 |       |         | ≥85   |

```text
ENROL | Sno | Cno | … | Final        CONDITIONS
      | P.  | _C  |   | _F           _C = 'C413' AND _F >= 85
```

두 질의 모두 예제 데이터에서 100, 300, 400을 반환한다. 여러 테이블에서 검색할 때는 같은 예제 원소로 테이블을 연결한다. "기말성적이 85점 이상이거나 C413을 등록한 학생의 이름"은 다음과 같고, 결과는 나수영, 정기태, 송병길이다.

| STUDENT | Sno | Sname | Year | Dept |
| ------- | --- | ----- | ---- | ---- |
|         | \_X | P.    |      |      |
|         | \_Y | P.    |      |      |

| ENROL | Sno | Cno  | Grade | Midterm | Final |
| ----- | --- | ---- | ----- | ------- | ----- |
|       | \_X |      |       |         | ≥85   |
|       | \_Y | C413 |       |         |       |

#### 삽입, 삭제, 갱신

| 작업                                           | QBE 명세                                                                                  | 비고                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 학번 100, 과목번호 C413인 튜플 삽입            | `ENROL` 골격에 `I.` 행: Sno 100, Cno C413                                                 | 기본 키에 널이 들어가면 안 된다. 예제 데이터에는 이미 있는 튜플이라 키 중복으로 거부된다 |
| 4학년 학생의 학번을 SENIOR에 삽입              | `SENIOR`에 `I.` 행: Sno `_X`, `STUDENT`에 행: Sno `_X`, Year 4                            | 검색 결과를 이용한 삽입. 100, 400이 들어간다                                             |
| 학번 100인 학생 삭제                           | `STUDENT`에 `D.` 행: Sno 100                                                              |                                                                                          |
| 기말성적 60점 미만인 학생을 등록·학생에서 삭제 | `ENROL`에 `D.` 행: Sno `_X`, Final <60, `STUDENT`에 `D.` 행: Sno `_X`                     | 복수 테이블 삭제. 예제 데이터에는 해당 튜플이 없다                                       |
| 학번 300인 학생의 학년을 2로 변경              | `STUDENT`에 행: Sno 300, Year `U.2`                                                       | 필드 값의 단순 갱신                                                                      |
| C413 등록 학생의 기말성적에 5점 가산           | `ENROL`에 행: Sno `_X`, Cno C413, Final `_F`, `U.` 행: Sno `_X`, Cno C413, Final `_F + 5` | 산술식을 이용한 갱신                                                                     |

## 연습문제 풀이

<details>
<summary>7. 연산 결과 릴레이션의 기본 키</summary>

> 두 릴레이션 R과 S가 있다고 하자. 다음 연산의 결과 릴레이션에 대한 기본 키를 식별해 보라.

R의 기본 키를 A, S의 기본 키를 B로 둔다. 결과 릴레이션의 기본 키는 결과 튜플을 유일하게 식별하는 최소 애트리뷰트 집합이다.

| 연산                             | 결과의 기본 키                                         | 이유                                                                                                 |
| -------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `\sigma_{\text{조건}}(R){:math}` | A                                                      | R의 튜플 일부만 남으므로 그대로 유일하다                                                             |
| `\pi_Y(R){:math}`                | Y 전체 (`A \subseteq Y{:math}`이면 A)                  | 프로젝트는 중복을 제거하므로 Y 전체는 항상 유일하다. Y가 A를 포함하면 A만으로 원래 튜플이 정해진다   |
| `R \times S{:math}`              | AB                                                     | R의 튜플과 S의 튜플 짝마다 하나씩 생긴다                                                             |
| `R \cup S{:math}`                | 모든 애트리뷰트                                        | 두 릴레이션의 튜플이 섞이므로 A만으로는 유일하다는 보장이 없다                                       |
| `R \cap S{:math}`                | A (또는 B)                                             | 결과는 R의 부분집합이자 S의 부분집합이므로 A와 B 모두 후보 키다                                      |
| `R - S{:math}`                   | A                                                      | 결과는 R의 부분집합이다                                                                              |
| `R \bowtie_{A=B} S{:math}`       | A (또는 B)                                             | A 값이 R의 튜플을 정하고, 같은 값인 B가 S의 튜플을 정한다. AB는 슈퍼 키지만 최소성을 만족하지 않는다 |
| `R \div S{:math}`                | `D = X - Y{:math}` 전체 (`A \subseteq D{:math}`이면 A) | 결과는 `\pi_D(R){:math}`의 부분집합이라 프로젝트와 같은 규칙이 적용된다                              |

==동일 조인의 조인 애트리뷰트가 양쪽의 기본 키이면, R의 튜플 하나는 S의 튜플 최대 하나와만 짝을 이룬다.== 그래서 결과의 기본 키는 A 하나로 충분하다.

</details>

<details>
<summary>8. 납품 데이터베이스 질의를 관계 대수와 관계 해석으로</summary>

> S(Sno, Sname, Status, City), P(Pno, Pname, Colour, Weight), SP(Sno, Pno, Qty)에 대해 다음 질의를 관계 대수, 관계 해석으로 표현하라. (가) 모든 납품업자의 Sname과 City (나) Pno가 123인 제품을 발송한 납품업자의 Sname (다) Colour가 red인 제품의 Pname (라) Pname이 Nut인 제품을 발송한 납품업자의 Sname

스키마는 [관계 데이터 모델 글](/memo/db-relational-model-keys)의 납품 데이터베이스와 같다. 인스턴스가 주어지지 않아 결과 표 대신 식만 적는다.

| 질의 | 관계 대수식                                                                                                 | 튜플 해석식                                                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (가) | `\pi_{\mathit{Sname},\mathit{City}}(S){:math}`                                                              | `\{ s.\mathit{Sname}, s.\mathit{City} \vert S(s) \}{:math}`                                                                                                                                                          |
| (나) | `\pi_{\mathit{Sname}}(S \bowtie_{\mathit{Sno}=\mathit{Sno}} \sigma_{\mathit{Pno}=123}(\mathit{SP})){:math}` | `\{ s.\mathit{Sname} \vert S(s) \land (\exists y)(\mathit{SP}(y) \land y.\mathit{Sno} = s.\mathit{Sno} \land y.\mathit{Pno} = 123) \}{:math}`                                                                        |
| (다) | `\pi_{\mathit{Pname}}(\sigma_{\mathit{Colour}=\text{'red'}}(P)){:math}`                                     | `\{ p.\mathit{Pname} \vert P(p) \land p.\mathit{Colour} = \text{'red'} \}{:math}`                                                                                                                                    |
| (라) | `\pi_{\mathit{Sname}}(S \bowtie_N (\mathit{SP} \bowtie_N \sigma_{\mathit{Pname}=\text{'Nut'}}(P))){:math}`  | `\{ s.\mathit{Sname} \vert S(s) \land (\exists y)(\exists p)(\mathit{SP}(y) \land P(p) \land y.\mathit{Sno} = s.\mathit{Sno} \land y.\mathit{Pno} = p.\mathit{Pno} \land p.\mathit{Pname} = \text{'Nut'}) \}{:math}` |

(라)에서 S와 P에는 공통 애트리뷰트가 없어 둘을 바로 조인할 수 없다. ==납품업자와 제품은 발송(SP)을 통해서만 연결되므로, SP와 P를 먼저 조인해 Nut의 발송 튜플을 구한 뒤 S와 조인해야 한다.== 튜플 해석식에서도 SP의 튜플 변수 y가 s와 p를 잇는다.

```text
A = σPname='Nut'(P)
B = SP ⋈N A        -- Nut를 발송한 (Sno, Pno, Qty, …)
C = S ⋈N B
πSname(C)
```

도메인 해석식으로 쓰면 다음과 같다.

<details>
<summary>도메인 해석식</summary>

```math
\begin{aligned}
&\text{(가)}\ \{ x_{\mathit{Sname}}, x_{\mathit{City}} \mid (\exists x_{\mathit{Sno}})(\exists x_{\mathit{Status}})\, S(x_{\mathit{Sno}}, x_{\mathit{Sname}}, x_{\mathit{Status}}, x_{\mathit{City}}) \} \\[4pt]
&\text{(나)}\ \{ x_{\mathit{Sname}} \mid (\exists x_{\mathit{Sno}})(\exists x_{\mathit{Status}})(\exists x_{\mathit{City}})(S(x_{\mathit{Sno}}, x_{\mathit{Sname}}, x_{\mathit{Status}}, x_{\mathit{City}}) \\
&\qquad \land (\exists x_{\mathit{Pno}})(\exists x_{\mathit{Qty}})(\mathit{SP}(x_{\mathit{Sno}}, x_{\mathit{Pno}}, x_{\mathit{Qty}}) \land x_{\mathit{Pno}} = 123)) \} \\[4pt]
&\text{(다)}\ \{ x_{\mathit{Pname}} \mid (\exists x_{\mathit{Pno}})(\exists x_{\mathit{Colour}})(\exists x_{\mathit{Weight}})(P(x_{\mathit{Pno}}, x_{\mathit{Pname}}, x_{\mathit{Colour}}, x_{\mathit{Weight}}) \\
&\qquad \land x_{\mathit{Colour}} = \text{'red'}) \} \\[4pt]
&\text{(라)}\ \{ x_{\mathit{Sname}} \mid (\exists x_{\mathit{Sno}})(\exists x_{\mathit{Status}})(\exists x_{\mathit{City}})(S(x_{\mathit{Sno}}, x_{\mathit{Sname}}, x_{\mathit{Status}}, x_{\mathit{City}}) \\
&\qquad \land (\exists x_{\mathit{Pno}})(\exists x_{\mathit{Qty}})(\mathit{SP}(x_{\mathit{Sno}}, x_{\mathit{Pno}}, x_{\mathit{Qty}}) \\
&\qquad \land (\exists x_{\mathit{Pname}})(\exists x_{\mathit{Colour}})(\exists x_{\mathit{Weight}})(P(x_{\mathit{Pno}}, x_{\mathit{Pname}}, x_{\mathit{Colour}}, x_{\mathit{Weight}}) \\
&\qquad \land x_{\mathit{Pname}} = \text{'Nut'}))) \}
\end{aligned}
```

같은 도메인 변수(`x_{\mathit{Sno}}{:math}`, `x_{\mathit{Pno}}{:math}`)를 두 범위식에 함께 쓰면 조인 조건이 된다.

</details>

</details>

## 실습 풀이

<details>
<summary>1. 자연 조인을 기본 연산으로 계산</summary>

> `\text{학생} \bowtie_N \text{등록}{:math}`을 카티션 프로덕트(×), 실렉트(σ), 프로젝트(π) 순서로 계산하라.

![자연 조인을 카티션 프로덕트, 실렉트, 프로젝트로 나눈 식](./images/db-relational-algebra-natural-join.jpg '계산 순서를 색으로 표시한 식. 파랑, 빨강, 초록 순서로 계산한다')

[조인](#조인) 절의 `\pi_{X \cup Y}(\sigma_{Z=Z}(R \times S)){:math}`를 파랑, 빨강, 초록 순서로 계산한다.

| 단계 | 식                                                                                                                                | 결과 차수          | 결과 카디널리티           | 내용                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------- | ------------------------------------------------------------------------------ |
| 파랑 | `\text{학생} \times \text{등록}{:math}`                                                                                           | `4 + 5 = 9{:math}` | `5 \times 11 = 55{:math}` | 학생 튜플마다 등록 11튜플을 모두 접속한다. 학번이 다른 조합도 포함된다         |
| 빨강 | `\sigma_{\text{학생.학번}=\text{등록.학번}}(\dots){:math}`                                                                        | 9                  | 11                        | 두 학번이 같은 튜플만 남는다. 위 동일 조인 결과표와 같다                       |
| 초록 | `\pi_{\text{학번},\text{이름},\text{학년},\text{학과},\text{과목번호},\text{성적},\text{중간성적},\text{기말성적}}(\dots){:math}` | 8                  | 11                        | 학번을 한 번만 남긴다. 위 `\text{학생} \bowtie_N \text{등록}{:math}` 표와 같다 |

<details>
<summary>학생 × 등록 가운데 학번 100인 학생의 11튜플</summary>

| 학생.학번 | 이름   | 학년 | 학과   | 등록.학번 | 과목번호 | 성적 | 중간성적 | 기말성적 |
| --------- | ------ | ---- | ------ | --------- | -------- | ---- | -------- | -------- |
| 100       | 나수영 | 4    | 컴퓨터 | 100       | C413     | A    | 90       | 95       |
| 100       | 나수영 | 4    | 컴퓨터 | 100       | E412     | A    | 95       | 95       |
| 100       | 나수영 | 4    | 컴퓨터 | 200       | C123     | B    | 85       | 80       |
| 100       | 나수영 | 4    | 컴퓨터 | 300       | C312     | A    | 90       | 95       |
| 100       | 나수영 | 4    | 컴퓨터 | 300       | C324     | C    | 75       | 75       |
| 100       | 나수영 | 4    | 컴퓨터 | 300       | C413     | A    | 95       | 90       |
| 100       | 나수영 | 4    | 컴퓨터 | 400       | C312     | A    | 90       | 95       |
| 100       | 나수영 | 4    | 컴퓨터 | 400       | C324     | A    | 95       | 90       |
| 100       | 나수영 | 4    | 컴퓨터 | 400       | C413     | B    | 80       | 85       |
| 100       | 나수영 | 4    | 컴퓨터 | 400       | E412     | C    | 65       | 75       |
| 100       | 나수영 | 4    | 컴퓨터 | 500       | C312     | B    | 85       | 80       |

빨강 단계에서 이 가운데 등록.학번이 100인 앞 두 튜플만 남는다. 학생 다섯 명에 대해 같은 방식으로 55튜플이 생긴다.

</details>

==조인은 카티션 프로덕트, 실렉트, 프로젝트로 대체할 수 있는 복합 연산이다.==

카티션 프로덕트는 학번을 비교하지 않고 학생 5튜플과 등록 11튜플을 모두 짝지으므로 55튜플이고, 원래 릴레이션에 없는 NULL 값은 생기지 않는다.

</details>

<details>
<summary>2. 모든 과목의 이름과 담당교수</summary>

> 모든 교과목의 이름과 담당 교수를 검색하라.

```math
\pi_{\text{과목이름},\text{담당교수}}(\text{과목})
```

| 과목이름     | 담당교수 |
| ------------ | -------- |
| 프로그래밍   | 김성국   |
| 자료구조     | 황수관   |
| 파일구조     | 이규찬   |
| 데이터베이스 | 이일로   |
| 반도체       | 홍봉진   |

</details>

<details>
<summary>3. 데이터베이스 수강생의 중간성적과 기말성적</summary>

> 데이터베이스 교과목을 수강하는 학생들의 중간성적과 기말성적을 검색하라.

등록에는 과목이름이 없으므로 과목과 조인한다. 두 릴레이션의 공통 애트리뷰트는 과목번호뿐이라 자연 조인을 쓸 수 있다.

```text
A = σ과목이름='데이터베이스'(과목)       -- C413 한 튜플
B = 등록 ⋈N A                           -- C413 등록 튜플 3개
π중간성적,기말성적(B)
```

| 중간성적 | 기말성적 |
| -------- | -------- |
| 90       | 95       |
| 95       | 90       |
| 80       | 85       |

프로젝트는 중복 튜플을 제거하므로, 두 학생의 중간성적과 기말성적이 같으면 한 튜플로 합쳐진다. 학생별 성적이 필요하면 `\pi_{\text{학번},\text{중간성적},\text{기말성적}}(B){:math}`처럼 학번을 함께 남긴다.

</details>

## 정리

- 관계 대수는 절차 언어이고, 연산 결과가 다시 릴레이션인 폐쇄 성질 덕분에 연산을 중첩할 수 있다.
- 실렉트는 수평적 부분집합, 프로젝트는 수직적 부분집합을 만들고, 조인은 기본 키와 외래 키로 릴레이션을 연결한다.
- ∪, −, ×, σ, π가 기본 연산이고, ∩, ⋈, ÷는 기본 연산으로 표현할 수 있는 복합 연산이다.
- 관계 해석은 비절차 언어로, 튜플 변수나 도메인 변수와 정량자 ∀, ∃로 결과의 조건만 선언한다. QBE는 도메인 관계 해석을 골격 테이블로 표현한다.

## 관련 글

- [관계 데이터 모델의 릴레이션, 키, 무결성 제약](/memo/db-relational-model-keys): 앞 글
- [SQL 데이터 정의문과 SELECT·INSERT·UPDATE 조작문](/memo/db-sql-ddl-dml): 관계 대수를 기초로 한 SQL을 다룬 다음 글

<details>
<summary>참고 문헌</summary>

- E. F. Codd, [A Relational Model of Data for Large Shared Data Banks](https://doi.org/10.1145/362384.362685), Communications of the ACM 13(6), 1970
- [Relational algebra](https://en.wikipedia.org/wiki/Relational_algebra), Wikipedia
- [Relational calculus](https://en.wikipedia.org/wiki/Relational_calculus), Wikipedia
- [Query by Example](https://en.wikipedia.org/wiki/Query_by_Example), Wikipedia

</details>

#데이터베이스 #관계대수 #CS
