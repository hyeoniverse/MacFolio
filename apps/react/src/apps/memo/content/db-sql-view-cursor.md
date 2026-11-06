---
title: SQL 뷰의 갱신 가능 조건과 삽입 SQL의 커서
date: 2023-05-02
category: 학습/CS/데이터베이스
series: 데이터베이스 기초
seriesOrder: 6
summary: 기본 테이블에서 유도되는 가상 테이블인 뷰의 생성·제거와 WITH CHECK OPTION, 열 부분 집합·행 부분 집합·조인·통계 요약 뷰의 갱신 가능 여부, 뷰의 장단점, 응용 프로그램에 삽입하는 SQL의 호스트 변수·SQLSTATE, 커서의 DECLARE·OPEN·FETCH·CLOSE, 동적 SQL의 PREPARE·EXECUTE를 정리했다.
---

데이터베이스 기초 연재의 여섯 번째 글로, 6장(SQL) 뒷부분을 다룬다. [앞 글](/memo/db-sql-ddl-dml)의 STUDENT, COURSE, ENROL 테이블을 그대로 쓴다.

## 뷰

뷰(view)는 하나 이상의 기본 테이블(base table)에서 유도되는 가상 테이블(virtual table)이다.

- 기본 테이블을 들여다보는 창(window)이라, 기본 테이블이 바뀌면 뷰의 내용도 바로 바뀐다(동적).
- ==물리적으로 구현되지 않는다. 뷰의 정의만 카탈로그(SYSVIEWS)에 SELECT-FROM-WHERE 형태로 저장된다.==
- 뷰에 대한 변경은 기본 테이블에 대한 변경으로 바뀌어 실행된다.
- [3단계 스키마](/memo/db-three-level-schema)의 외부 스키마는 뷰와 기본 테이블의 정의로 구성된다.

### 뷰의 생성

```sql
CREATE VIEW 뷰_이름 [(열_이름_리스트)]
  AS SELECT 문
  [WITH CHECK OPTION];
```

`WITH CHECK OPTION{:sql}`을 붙이면 뷰를 통한 삽입·갱신이 뷰 정의 조건을 만족하는지 검사한다. ==조건을 만족하지 않는 행, 곧 변경 후 뷰에서 조회되지 않을 행은 거부된다.== 다음 CSTUDENT 뷰는 Dept 열을 포함하지 않으므로, 이 뷰로 행을 삽입하면 기본 테이블의 Dept가 널이 되어 `Dept = '컴퓨터'` 조건을 만족하지 못하고 거부된다.

```sql
-- 컴퓨터학과 학생 뷰
CREATE VIEW CSTUDENT (Sno, Sname, Year)
  AS SELECT Sno, Sname, Year
     FROM   STUDENT
     WHERE  Dept = '컴퓨터'
  WITH CHECK OPTION;

-- 학과별 학생 수: COUNT(*)처럼 이름을 상속할 수 없는 열이 있으면 열 이름을 명세해야 한다
CREATE VIEW DEPTSIZE (Dept, Size)
  AS SELECT Dept, COUNT(*)
     FROM   STUDENT
     GROUP BY Dept;

-- 두 테이블을 조인한 뷰
CREATE VIEW HONOR (Sname, Dept, Grade)
  AS SELECT STUDENT.Sname, STUDENT.Dept, ENROL.Final
     FROM   STUDENT, ENROL
     WHERE  STUDENT.Sno = ENROL.Sno AND ENROL.Final > 90;

-- 뷰로 다시 뷰를 정의
CREATE VIEW COMHONOR
  AS SELECT Sname FROM HONOR WHERE Dept = '컴퓨터';
```

열 이름을 생략하면 SELECT의 열 이름을 상속한다. 집계 함수나 산술식으로 만든 열, 조인으로 이름이 중복되는 열이 있으면 열 이름을 반드시 명세한다.

![STUDENT 테이블에서 CSTUDENT 뷰에 해당하는 컴퓨터 학과 행과 Sno·Sname·Year 열만 밝게 남기고 나머지는 음영 처리한 그림](./images/db-sql-view-cursor-note-01.jpg 'STUDENT 테이블에서 CSTUDENT 뷰에 해당하는 컴퓨터 학과 행과 Sno·Sname·Year 열만 밝게 남기고 나머지는 음영 처리한 그림 (강의 자료)')

### 뷰의 제거

```sql
DROP VIEW 뷰_이름 { RESTRICT | CASCADE };
DROP VIEW DEPTSIZE RESTRICT;
```

RESTRICT는 다른 곳에서 참조하지 않을 때만 제거하고, CASCADE는 이 뷰를 쓰는 다른 뷰와 제약조건도 함께 제거한다.

### 뷰의 조작과 갱신 가능 조건

기본 테이블에 쓸 수 있는 SELECT 문은 모두 뷰에도 쓸 수 있다.

> [!IMPORTANT] 뷰의 변경 가능 판단 기준
> 삽입·삭제·갱신은 제약이 있고, ==판단 기준은 **기본 키 포함 여부**다.== ==뷰의 행 하나가 기본 테이블의 어느 행에 해당하는지 기본 키로 식별할 수 있어야 변경을 전달할 수 있기 때문이다.==

| 뷰 유형                         | 예                                                      | 이론적 변경 가능 여부            |
| ------------------------------- | ------------------------------------------------------- | -------------------------------- |
| 열 부분 집합 뷰, 기본 키 포함   | `SELECT Sno, Dept FROM STUDENT{:sql}`                   | 가능                             |
| 열 부분 집합 뷰, 기본 키 불포함 | `SELECT Sname, Dept FROM STUDENT{:sql}`                 | 불가                             |
| 행 부분 집합 뷰                 | `SELECT * FROM STUDENT WHERE Year = 4{:sql}`            | 가능 (기본 키가 자연히 포함된다) |
| 조인 뷰                         | HONOR                                                   | 불가                             |
| 통계적 요약 뷰                  | COSTAT: `SELECT Cno, AVG(Midterm) … GROUP BY Cno{:sql}` | 불가                             |

`SELECT Sname, Dept{:sql}`로 만든 뷰에 행을 삽입하면 기본 테이블의 학번이 널이 되어 개체 무결성을 위반한다. 통계 요약 뷰의 평균값 하나는 여러 행에서 계산된 값이라, 그 값을 바꾸려면 어느 행을 바꿔야 할지 정할 수 없다.

> [!WARNING]
> ==이론적으로 변경할 수 있다고 해서 DBMS가 실제로 변경을 허용하는 것은 아니다.== 다음 경우에는 변경 연산이 허용되지 않는다.
>
> 1. 뷰의 열이 상수, 산술 연산자, 함수가 쓰인 산술식으로 만들어진 경우
> 2. 집계 함수(COUNT, SUM, AVG, MAX, MIN)가 관련된 경우
> 3. DISTINCT, GROUP BY, HAVING이 쓰인 경우
> 4. 두 개 이상의 테이블이 관련된 경우
> 5. 변경할 수 없는 뷰를 기초로 정의된 경우

![뷰 ⊃ 이론적으로 변경이 가능한 뷰 ⊃ 실제로 변경이 가능한 뷰 포함 관계를 겹친 사각형으로 그린 그림](./images/db-sql-view-cursor-note-02.jpg '뷰 ⊃ 이론적으로 변경이 가능한 뷰 ⊃ 실제로 변경이 가능한 뷰 포함 관계를 겹친 사각형으로 그린 그림 (강의 자료)')

### 뷰의 장단점

| 장점                                                                                  | 단점                                      |
| ------------------------------------------------------------------------------------- | ----------------------------------------- |
| 논리적 데이터 독립성 제공 (기본 테이블을 확장·재구성해도 뷰를 쓰는 프로그램은 그대로) | 정의를 변경할 수 없다 (삭제 후 다시 생성) |
| 데이터 접근 제어 (보안: 뷰에 없는 열은 볼 수 없다)                                    | 삽입·삭제·갱신 연산에 제약이 많다         |
| 사용자의 데이터 관리 단순화                                                           |                                           |
| 여러 사용자의 다양한 데이터 요구 지원                                                 |                                           |

## 삽입 SQL

SQL은 **이중 모드(dual mode)** 원리를 따른다. 터미널에서 대화식으로 쓸 수 있는 모든 SQL 문은 응용 프로그램 안에서도 쓸 수 있다(interactive and embedded form). 응용 프로그램에 넣은 SQL을 삽입 SQL(embedded SQL)이라 한다.

삽입 SQL을 포함한 응용 프로그램의 규칙은 다음과 같다.

- 명령문 앞에 `EXEC SQL{:sql}`을 붙이고, 끝에 세미콜론 같은 종료 기호를 붙인다.
- 삽입 SQL 실행문은 호스트 언어의 실행문이 올 수 있는 곳 어디에나 쓸 수 있다. 대화식 SQL과 달리 `DECLARE CURSOR{:sql}`, `BEGIN/END DECLARE SECTION{:sql}` 같은 비실행문도 있다.
- SQL 문 안에서 쓰는 호스트 변수에는 콜론(`:`)을 붙인다. 그래서 호스트 변수와 열의 이름이 같아도 된다.
- 호스트 변수는 사용 전에 `BEGIN DECLARE SECTION{:sql}`과 `END DECLARE SECTION{:sql}` 사이에서 선언한다.
- 호스트 변수와 대응하는 열의 데이터 타입은 일치해야 한다.
- 실행 결과를 프로그램에 알려 주는 호스트 변수 `SQLSTATE`를 포함한다.

| SQLSTATE   | 의미                            |
| ---------- | ------------------------------- |
| `"00000"`  | 성공                            |
| `"02000"`  | 실행했지만 검색된 데이터가 없음 |
| 그 밖의 값 | 경고 또는 오류                  |

`SQLSTATE`를 매번 검사하는 대신 `WHENEVER` 문으로 조건별 동작을 지정할 수 있다.

```sql
EXEC SQL WHENEVER <조건> <행동>;
-- 조건: SQLERROR 또는 NOT FOUND
-- 행동: CONTINUE 또는 GOTO 문
```

```c
EXEC SQL BEGIN DECLARE SECTION;
  int  sno;
  char sname[21];
  char dept[7];
  char SQLSTATE[6];
EXEC SQL END DECLARE SECTION;

sno = 100;
EXEC SQL SELECT Sname, Dept
         INTO   :sname, :dept
         FROM   STUDENT
         WHERE  Sno = :sno;
if (strcmp(SQLSTATE, "00000") == 0) { /* 성공 */ } else { /* 오류 처리 */ }
```

### 커서가 필요 없는 연산

결과가 한 행 이하인 SELECT(singleton SELECT)와 UPDATE, DELETE, INSERT는 커서 없이 실행한다.

```sql
-- 한 행 검색: INTO 절로 호스트 변수에 받는다
EXEC SQL SELECT Sname, Dept INTO :sname, :dept
         FROM STUDENT WHERE Sno = :sno;

-- C413 등록 학생의 기말성적을 :new만큼 올린다
EXEC SQL UPDATE ENROL SET Final = Final + :new WHERE Cno = 'C413';

-- :sno 학생의 등록 행을 모두 삭제
EXEC SQL DELETE FROM ENROL WHERE Sno = :sno;

-- 학생 행 하나 삽입
EXEC SQL INSERT INTO STUDENT (Sno, Sname, Dept) VALUES (:sno, :sname, :dept);
```

## 커서

SQL은 레코드 집합 단위로 처리하지만, C 같은 호스트 언어는 한 번에 레코드 하나만 처리한다. ==**커서(cursor)** 는 SELECT로 검색한 레코드 집합의 각 레코드를 한 번에 하나씩 가리켜, 호스트 프로그램이 집합 전체를 처리할 수 있게 하는 포인터다.==

- SELECT 문과 호스트 프로그램 사이를 연결한다.
- 여러 레코드를 반환하는 SELECT 문을 대상으로 정의한다.
- SELECT로 검색된 레코드 집합을 활동 세트(active set)라 하고, 실행 중에 커서는 활동 세트의 레코드 하나를 가리킨다.

```sql
EXEC SQL DECLARE C1 CURSOR FOR          /* 커서 C1 정의 */
         SELECT Sno, Sname, Year
         FROM   STUDENT
         WHERE  Dept = :dept;
EXEC SQL OPEN C1;                       /* 질의 실행, 활동 세트 생성 */
DO                                      /* C1이 가리키는 모든 레코드에 대해 */
  EXEC SQL FETCH C1 INTO :sno, :sname, :year;   /* 다음 레코드 채취 */
  …
END;
EXEC SQL CLOSE C1;                      /* 커서 활동 종료 */
```

![커서의 DECLARE, OPEN, FETCH, CLOSE](./images/db-sql-view-cursor-lifecycle.svg '활동 세트의 두 번째 행을 FETCH한 시각의 상태')

| 단계                   | 동작                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DECLARE CURSOR{:sql}` | 커서와 SELECT 문을 연결한다. 실행문이 아니라 선언문이다. 커서는 여러 개 선언할 수 있고 이름이 모두 달라야 한다. 이 SELECT에는 INTO 절이 없다 |
| `OPEN`                 | 그 시각의 호스트 변수 값으로 SELECT를 실행하고, 결과를 커서의 활동 세트로 저장한다. 커서는 첫 레코드 앞을 가리킨다                           |
| `FETCH … INTO{:sql}`   | 커서를 다음 레코드로 옮기고, 그 레코드의 필드 값을 INTO 뒤의 호스트 변수에 저장한다. 결과가 여러 행이라 루프로 반복한다                      |
| `DO … END`             | FETCH할 때마다 커서가 한 레코드씩 전진한다. 더 이상 레코드가 없으면 SQLSTATE가 `"02000"`이 되어 루프를 끝낸다                                |
| `CLOSE`                | 커서를 닫아 활동 세트를 해제한다. 다시 OPEN하면 그 시각의 변수 값으로 새 활동 세트를 갖는다                                                  |

### 커서가 가리키는 레코드 변경

`WHERE CURRENT OF 커서{:sql}`는 커서가 현재 가리키는 레코드를 뜻한다. 이렇게 갱신하려면 커서를 선언할 때 `FOR UPDATE OF 필드_이름{:sql}`을 붙인다.

```sql
EXEC SQL DECLARE C1 CURSOR FOR … FOR UPDATE OF Year;

EXEC SQL UPDATE STUDENT SET Year = :year WHERE CURRENT OF C1;
EXEC SQL DELETE FROM STUDENT WHERE CURRENT OF C1;
```

## 동적 SQL

삽입 SQL은 SQL 문이 프로그램을 작성하는 시각에 정해져 있어 예비 컴파일 단계에서 처리된다. 터미널로 데이터베이스 접근을 지원하는 온라인 응용 프로그램은 실행할 SQL 문을 실행 시각에야 알 수 있다. ==동적 SQL(dynamic SQL)은 SQL 문을 문자열로 구성해 실행 시각에 컴파일하고 실행하는 방식이다.==

온라인 응용의 수행 과정은 다음과 같다.

1. 터미널에서 명령문을 접수한다.
2. 입력된 명령문을 분석한다.
3. 데이터베이스에 적절한 SQL 문으로 지시한다.
4. 터미널에 메시지나 결과를 반환한다.

| 명령어          | 동작                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `PREPARE{:sql}` | 문자열로 된 SQL 문을 예비 컴파일해 목적 코드(object code)로 생성하고 저장한다 |
| `EXECUTE{:sql}` | 저장된 목적 코드의 SQL 문을 실행한다                                          |

```c
varchar dynamicSQL[256];   /* 호스트 변수 */
dynamicSQL = "DELETE FROM ENROL WHERE Cno = 'C413' AND Final < 60";
EXEC SQL PREPARE objSQL FROM :dynamicSQL;
EXEC SQL EXECUTE objSQL;
```

> [!WARNING]
> PREPARE 문에는 모든 종류의 SQL 문을 넣을 수 있다. 단, ==문자열로 표현한 SQL 문에는 호스트 변수를 쓸 수 없어서 물음표(`?`) 매개변수를 쓰고, EXECUTE의 USING 절로 값을 전달한다.==

```c
dynamicSQL = "DELETE FROM ENROL WHERE Cno = ? AND Final < ?";
EXEC SQL PREPARE objSQL FROM :dynamicSQL;
cno = "C413";   /* ?에 대응하는 값은 터미널에서 입력받을 수 있다 */
grade = 60;
EXEC SQL EXECUTE objSQL USING :cno, :grade;
```

`:cno`와 `:grade`의 값이 순서대로 DELETE 문의 Cno와 Final 자리의 `?`에 전달된다.

> [!TIP]
> 한 번 PREPARE한 목적 코드는 USING의 값만 바꿔 여러 번 EXECUTE할 수 있다.

## 연습문제 풀이

교재 6장 연습문제 가운데 뷰·삽입 SQL·커서를 다루는 2·3·4번을 풀었다. 번호는 교재 번호 그대로이고, 같은 장의 1·5·6번은 [SQL 정의·조작문 글](/memo/db-sql-ddl-dml)에서 푼다.

<details>
<summary>2. 커서의 정의와 삽입 SQL에서의 사용</summary>

> 커서란 무엇이고 삽입 SQL에서 어떻게 사용되는가를 설명하라.

SQL은 한 번의 SELECT로 레코드 집합을 반환하지만, C 같은 호스트 언어의 변수는 한 번에 레코드 하나의 값만 저장한다. ==이 처리 단위의 불일치(impedance mismatch)를 해결하려고, 커서는 SELECT로 검색한 활동 세트의 레코드를 한 번에 하나씩 가리켜 호스트 변수로 넘긴다.== 결과가 한 행 이하인 singleton SELECT와 UPDATE, DELETE, INSERT는 커서 없이 실행하고, 여러 행을 반환하는 SELECT에만 커서를 쓴다.

커서는 다음 생명주기를 거친다. 각 단계의 동작은 [커서](#커서) 절의 표와 같다.

| 순서 | 문장                                           | 결과                                                     |
| ---- | ---------------------------------------------- | -------------------------------------------------------- |
| 1    | `DECLARE C1 CURSOR FOR SELECT …{:sql}`         | 커서와 SELECT를 연결하는 선언. 아직 실행하지 않는다      |
| 2    | `OPEN C1`                                      | 그 시각의 호스트 변수 값으로 SELECT 실행, 활동 세트 생성 |
| 3    | `FETCH C1 INTO :sno, :sname, :year{:sql}` 반복 | 커서를 한 레코드 전진시키고 값을 호스트 변수에 저장      |
| 4    | SQLSTATE `"02000"`                             | 더 이상 레코드가 없으므로 루프 종료                      |
| 5    | `CLOSE C1`                                     | 활동 세트 해제                                           |

`:dept = '컴퓨터'`로 [커서](#커서) 절의 C1을 OPEN하면 활동 세트는 다음 3행이고, FETCH를 세 번 실행한 뒤 네 번째 FETCH에서 SQLSTATE가 `"02000"`이 된다.

| Sno | Sname  | Year |
| --- | ------ | ---- |
| 100 | 나수영 | 4    |
| 300 | 정기태 | 1    |
| 400 | 송병길 | 4    |

> [!WARNING]
> ==커서의 SELECT 문은 `DECLARE CURSOR{:sql}`를 만난 시각이 아니라 `OPEN`을 실행한 시각에 실행된다.== 그래서 같은 커서라도 `:dept` 값을 바꾼 뒤 `CLOSE`하고 다시 `OPEN`하면 다른 활동 세트를 얻는다.

커서가 가리키는 레코드는 `WHERE CURRENT OF C1{:sql}`로 갱신·삭제할 수 있다.

</details>

<details>
<summary>3. 뷰의 정의와 갱신 문제</summary>

> SQL에서 뷰는 어떻게 정의되는가? 뷰를 갱신할 때 일어나는 문제점은 무엇인지 설명하라.

뷰는 하나 이상의 기본 테이블에서 유도되는 가상 테이블이고, `CREATE VIEW 뷰_이름 [(열_이름_리스트)] AS SELECT 문 [WITH CHECK OPTION]{:sql}`으로 정의한다. 데이터는 저장되지 않고 정의만 카탈로그에 저장되므로, ==뷰에 대한 삽입·삭제·갱신은 기본 테이블의 변경으로 바꿔 실행해야 하고, 뷰의 한 행이 기본 테이블의 어느 행에 대응하는지 하나로 정할 수 없으면 변경을 전달할 수 없다.== 예제 데이터로 문제가 생기는 경우를 확인하면 다음과 같다.

기본 키가 없는 열 부분 집합 뷰 STUDENT_VIEW2(Sname, Dept)에 `('홍길동', '전기')`를 삽입하면 STUDENT의 Sno가 널이 되어 개체 무결성을 위반한다.

조인 뷰 HONOR(Final > 90)의 내용은 다음과 같다.

| Sname  | Dept   | Grade |
| ------ | ------ | ----- |
| 나수영 | 컴퓨터 | 95    |
| 나수영 | 컴퓨터 | 95    |
| 정기태 | 컴퓨터 | 95    |
| 송병길 | 컴퓨터 | 95    |

나수영의 두 행은 각각 ENROL의 (100, C413)과 (100, E412)에서 왔지만 뷰에서는 구별되지 않는다. 이 행 하나를 삭제하면 어느 ENROL 행을 삭제할지, 아니면 STUDENT 행을 삭제할지 정할 수 없다.

통계적 요약 뷰 COSTAT(Cno, Avpoint)의 내용은 다음과 같다.

| Cno  | Avpoint |
| ---- | ------- |
| C123 | 85      |
| C312 | 88.33   |
| C324 | 85      |
| C413 | 88.33   |
| E412 | 80      |

C413의 Avpoint를 90으로 갱신하면 평균이 90이 되도록 C413 등록 3행의 Midterm을 바꾸는 방법이 무수히 많아 하나로 정할 수 없다.

이런 문제 때문에 DBMS는 [뷰의 조작과 갱신 가능 조건](#뷰의-조작과-갱신-가능-조건) 절의 다섯 경우(산술식 열, 집계 함수, DISTINCT·GROUP BY·HAVING, 두 개 이상의 테이블, 변경할 수 없는 뷰 기반)에 변경을 허용하지 않는다. `WITH CHECK OPTION{:sql}`이 없으면 뷰 조건을 벗어나는 행도 삽입·갱신되어 변경 후 뷰에서 조회되지 않는 문제도 있다.

</details>

<details>
<summary>4. AS와 튜플 변수</summary>

> SQL 문에서 테이블 이름과 열 이름을 별도로 지정하는 AS에 대해 설명해 보라. 튜플 변수와는 어떻게 구별할 수 있는가?

`AS`는 SELECT 결과의 열 이름이나 FROM 절의 테이블에 새 이름을 붙인다. ==FROM 절에서 테이블에 붙인 이름(`FROM STUDENT AS S{:sql}`의 S)이 튜플 변수(범위 변수)다.==

> [!NOTE]
> 표준 SQL에서 테이블 별칭의 `AS`는 생략할 수 있고, Oracle은 테이블 별칭에 `AS`를 허용하지 않는다.

튜플 변수는 그 테이블의 행 하나하나를 차례로 가리키는 변수라, 같은 테이블을 두 번 쓰는 자기 조인에서 두 행을 구분하는 데 필요하다.

```sql
SELECT S1.Sno AS 학번1, S2.Sno AS 학번2     -- 학번1, 학번2: 열 별칭
FROM   STUDENT S1, STUDENT S2              -- S1, S2: 튜플 변수
WHERE  S1.Dept = S2.Dept AND S1.Sno < S2.Sno;
```

같은 학과 학생의 쌍을 한 번씩 검색한다. 전기와 산공은 학생이 한 명뿐이라 쌍이 없고, 컴퓨터학과의 100, 300, 400에서 세 쌍이 나온다.

| 학번1 | 학번2 |
| ----- | ----- |
| 100   | 300   |
| 100   | 400   |
| 300   | 400   |

열 별칭은 결과 테이블의 열 이름만 바꾸고 WHERE 절에서 참조할 수 없지만, 튜플 변수는 질의 전체에서 `S1.Dept`처럼 열을 한정하는 데 쓴다.

</details>

## 정리

- 뷰는 정의만 카탈로그에 저장되는 가상 테이블이고, 기본 테이블이 바뀌면 함께 바뀐다.
- 뷰를 통한 변경은 기본 키가 포함되어 기본 테이블의 행을 식별할 수 있을 때만 이론적으로 가능하며, 조인·집계·DISTINCT·GROUP BY가 들어간 뷰는 변경할 수 없다.
- 삽입 SQL은 `EXEC SQL{:sql}`과 콜론을 붙인 호스트 변수로 응용 프로그램과 데이터를 주고받고, `SQLSTATE`로 결과를 확인한다.
- 커서는 집합 단위인 SQL과 레코드 단위인 호스트 언어 사이에서 활동 세트의 레코드를 하나씩 가리킨다.
- 동적 SQL은 문자열로 만든 SQL 문을 PREPARE로 컴파일하고 EXECUTE로 실행하며, 값은 `?` 매개변수와 USING 절로 전달한다.

## 관련 글

- [SQL 데이터 정의문과 SELECT·INSERT·UPDATE 조작문](/memo/db-sql-ddl-dml): 앞 글
- [3단계 스키마와 DBMS 구성 요소](/memo/db-three-level-schema): 뷰가 표현하는 외부 스키마와 예비 컴파일러
- [함수 종속과 1NF·2NF·3NF·BCNF 정규화](/memo/db-normalization): 7장을 다룬 다음 글

#데이터베이스 #SQL #CS
