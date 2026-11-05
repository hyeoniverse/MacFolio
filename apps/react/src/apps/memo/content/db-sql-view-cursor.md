---
title: SQL 뷰의 갱신 가능 조건과 삽입 SQL의 커서
date: 2023-05-02
category: CS/데이터베이스
series: 데이터베이스 기초
seriesOrder: 6
summary: 기본 테이블에서 유도되는 가상 테이블인 뷰의 생성·제거와 WITH CHECK OPTION, 열 부분 집합·행 부분 집합·조인·통계 요약 뷰의 갱신 가능 여부, 뷰의 장단점, 응용 프로그램에 삽입하는 SQL의 호스트 변수·SQLSTATE와 커서의 DECLARE·OPEN·FETCH·CLOSE를 정리했다.
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

`WITH CHECK OPTION`을 붙이면 뷰를 통한 삽입·갱신이 뷰 정의 조건을 만족하는지 검사한다. 다음 CSTUDENT 뷰로 학과가 '전기'인 행을 넣으려 하면 거부된다.

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

기본 테이블에 쓸 수 있는 SELECT 문은 모두 뷰에도 쓸 수 있다. 삽입·삭제·갱신은 제약이 있고, ==판단 기준은 **기본 키 포함 여부**다.== ==뷰의 행 하나가 기본 테이블의 어느 행에 해당하는지 기본 키로 식별할 수 있어야 변경을 전달할 수 있기 때문이다.==

| 뷰 유형                         | 예                                        | 이론적 변경 가능 여부            |
| ------------------------------- | ----------------------------------------- | -------------------------------- |
| 열 부분 집합 뷰, 기본 키 포함   | `SELECT Sno, Dept FROM STUDENT`           | 가능                             |
| 열 부분 집합 뷰, 기본 키 불포함 | `SELECT Sname, Dept FROM STUDENT`         | 불가                             |
| 행 부분 집합 뷰                 | `SELECT * FROM STUDENT WHERE Year = 4`    | 가능 (기본 키가 자연히 포함된다) |
| 조인 뷰                         | HONOR                                     | 불가                             |
| 통계적 요약 뷰                  | `SELECT Cno, AVG(Midterm) … GROUP BY Cno` | 불가                             |

`SELECT Sname, Dept`로 만든 뷰에 행을 삽입하면 기본 테이블의 학번이 널이 되어 개체 무결성을 위반한다. 통계 요약 뷰의 평균값 하나는 여러 행에서 계산된 값이라, 그 값을 바꾸려면 어느 행을 바꿔야 할지 정할 수 없다.

==이론적으로 변경할 수 있다고 해서 DBMS가 실제로 변경을 허용하는 것은 아니다.== 다음 경우에는 변경 연산이 허용되지 않는다.

1. 뷰의 열이 상수, 산술 연산자, 함수가 쓰인 산술식으로 만들어진 경우
2. 집계 함수(COUNT, SUM, AVG, MAX, MIN)가 관련된 경우
3. DISTINCT, GROUP BY, HAVING이 쓰인 경우
4. 두 개 이상의 테이블이 관련된 경우
5. 변경할 수 없는 뷰를 기초로 정의된 경우

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

- 명령문 앞에 `EXEC SQL`을 붙이고, 끝에 세미콜론 같은 종료 기호를 붙인다.
- 삽입 SQL 실행문은 호스트 언어의 실행문이 올 수 있는 곳 어디에나 쓸 수 있다. 대화식 SQL과 달리 `DECLARE CURSOR`, `BEGIN/END DECLARE SECTION` 같은 비실행문도 있다.
- SQL 문 안에서 쓰는 호스트 변수에는 콜론(`:`)을 붙인다. 그래서 호스트 변수와 열의 이름이 같아도 된다.
- 호스트 변수는 사용 전에 `BEGIN DECLARE SECTION`과 `END DECLARE SECTION` 사이에서 선언한다.
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

| 단계             | 동작                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DECLARE CURSOR` | 커서와 SELECT 문을 연결한다. 실행문이 아니라 선언문이다. 커서는 여러 개 둘 수 있고 이름이 모두 달라야 한다. 이 SELECT에는 INTO 절이 없다 |
| `OPEN`           | 그 시각의 호스트 변수 값으로 SELECT를 실행하고, 결과를 커서의 활동 세트로 저장한다. 커서는 첫 레코드 앞을 가리킨다                       |
| `FETCH … INTO`   | 커서를 다음 레코드로 옮기고, 그 레코드의 필드 값을 INTO 뒤의 호스트 변수에 저장한다. 결과가 여러 행이라 루프로 반복한다                  |
| `DO … END`       | FETCH할 때마다 커서가 한 레코드씩 전진한다. 더 이상 레코드가 없으면 SQLSTATE가 `"02000"`이 되어 루프를 끝낸다                            |
| `CLOSE`          | 커서를 닫아 활동 세트를 없앤다. 다시 OPEN하면 그 시각의 변수 값으로 새 활동 세트를 갖는다                                                |

### 커서가 가리키는 레코드 변경

`WHERE CURRENT OF 커서`는 커서가 현재 가리키는 레코드를 뜻한다. 이렇게 갱신하려면 커서를 선언할 때 `FOR UPDATE OF 필드_이름`을 붙인다.

```sql
EXEC SQL DECLARE C1 CURSOR FOR … FOR UPDATE OF Year;

EXEC SQL UPDATE STUDENT SET Year = :year WHERE CURRENT OF C1;
EXEC SQL DELETE FROM STUDENT WHERE CURRENT OF C1;
```

## 과제로 풀어 본 문제

**AS와 튜플 변수는 어떻게 다른가.** `AS`는 SELECT 결과의 열 이름이나 FROM 절의 테이블에 새 이름을 붙인다. FROM 절에서 테이블에 붙인 이름(`FROM STUDENT S`의 S)이 튜플 변수(범위 변수)다. 튜플 변수는 그 테이블의 행 하나하나를 차례로 가리키는 변수라, 같은 테이블을 두 번 쓰는 자기 조인에서 두 행을 구분하는 데 필요하다.

```sql
SELECT S1.Sno AS 학번1, S2.Sno AS 학번2     -- 학번1, 학번2: 열 별칭
FROM   STUDENT S1, STUDENT S2              -- S1, S2: 튜플 변수
WHERE  S1.Dept = S2.Dept AND S1.Sno < S2.Sno;
```

과제를 제출한 시각에는 튜플 변수를 "값을 저장하는 변수"로 설명했는데, 이는 삽입 SQL의 호스트 변수에 해당하는 설명이다. ==튜플 변수는 값이 아니라 행을 가리킨다.==

**커서의 OPEN 시각.** 커서의 SELECT 문은 `DECLARE CURSOR`를 만난 시각이 아니라 `OPEN`을 실행한 시각에 실행된다. 그래서 같은 커서라도 `:dept` 값을 바꾼 뒤 `CLOSE`하고 다시 `OPEN`하면 다른 활동 세트를 얻는다.

## 정리

- 뷰는 정의만 카탈로그에 저장되는 가상 테이블이고, 기본 테이블이 바뀌면 함께 바뀐다.
- 뷰를 통한 변경은 기본 키가 포함되어 기본 테이블의 행을 식별할 수 있을 때만 이론적으로 가능하며, 조인·집계·DISTINCT·GROUP BY가 들어간 뷰는 변경할 수 없다.
- 삽입 SQL은 `EXEC SQL`과 콜론을 붙인 호스트 변수로 응용 프로그램과 데이터를 주고받고, `SQLSTATE`로 결과를 확인한다.
- 커서는 집합 단위인 SQL과 레코드 단위인 호스트 언어 사이에서 활동 세트의 레코드를 하나씩 가리킨다.

## 관련 글

- [SQL 데이터 정의문과 SELECT·INSERT·UPDATE 조작문](/memo/db-sql-ddl-dml): 앞 글
- [3단계 스키마와 DBMS 구성 요소](/memo/db-three-level-schema): 뷰가 표현하는 외부 스키마와 예비 컴파일러
- [함수 종속과 1NF·2NF·3NF·BCNF 정규화](/memo/db-normalization): 7장을 다룬 다음 글

#데이터베이스 #SQL #CS
