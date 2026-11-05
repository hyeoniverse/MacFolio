---
title: SQL 데이터 정의문과 SELECT·INSERT·UPDATE 조작문
date: 2023-04-18
category: CS/데이터베이스
series: 데이터베이스 기초
seriesOrder: 5
summary: SQL의 특징, 스키마·도메인·테이블을 정의하는 CREATE·ALTER·DROP, 외래 키의 ON DELETE·ON UPDATE 옵션, SELECT의 DISTINCT·조인·집계·GROUP BY·HAVING·부속 질의·LIKE·NULL·EXISTS·UNION, INSERT·UPDATE·DELETE를 예제 결과와 함께 정리했다.
---

데이터베이스 기초 연재의 다섯 번째 글로, 6장(SQL) 앞부분을 다룬다. 예제의 테이블은 다음과 같다.

```text
STUDENT (Sno 학번, Sname 이름, Year 학년, Dept 학과)
COURSE  (Cno 과목번호, Cname 과목이름, Credit 학점, Dept 학과, Prname 담당교수)
ENROL   (Sno 학번, Cno 과목번호, Grade 성적, Midterm 중간성적, Final 기말성적)
```

## SQL의 역사와 특징

SQL(Structured Query Language)은 1974년 IBM 연구소가 발표한 SEQUEL(Structured English QUEry Language)에서 시작했다. IBM은 SEQUEL을 실험적 관계 DBMS인 System R의 인터페이스로 구현했다.

| 표준          | 연도 | 비고                |
| ------------- | ---- | ------------------- |
| SQL-86 (SQL1) | 1986 | 최초의 표준         |
| SQL-92 (SQL2) | 1992 | 개정                |
| SQL-99 (SQL3) | 1999 |                     |
| SQL:2003      | 2003 | 객체 개념 지원 추가 |

현재 ANSI와 ISO가 관계 데이터베이스의 표준 언어로 채택했고, DB2, Oracle, Informix, Sybase 같은 주요 상용 DBMS가 모두 지원한다.

==SQL은 단순한 질의어가 아니라 DDL, DML, DCL 기능을 모두 제공하는 종합 데이터베이스 언어다.== 특징은 다음과 같다.

- 관계 대수와 확장된 튜플 관계 해석에 기초한다.
- 고급·비절차적 언어다. 데이터 처리의 접근 경로(access path)를 명세하지 않는 선언적 언어다.
- 표준화되어 있어 상용 RDBMS 사이의 전환이 쉽다.
- 터미널에서 대화식으로 쓸 수도 있고, Java, C, COBOL 같은 응용 프로그램에 삽입해 쓸 수도 있다.
- 레코드 하나가 아니라 레코드 집합 단위로 처리한다.

SQL에서는 관계 모델의 공식 용어 대신 릴레이션은 테이블, 튜플은 행, 애트리뷰트는 열이라고 부른다.

## 데이터 정의문(DDL)

### 스키마와 카탈로그

스키마(schema)는 하나의 응용(사용자)에 속하는 테이블과 기타 구성 요소의 그룹이다. 스키마 이름, 소유자(authorization identifier), 테이블·뷰·도메인 등의 기술자(descriptor)를 포함한다. DBA에게 허가를 받은 사용자만 스키마를 소유할 수 있다.

```sql
CREATE SCHEMA UNIVERSITY AUTHORIZATION SHLEE;
```

`CREATE SCHEMA` 대신 `CREATE DATABASE`를 쓰는 DBMS도 있다. 카탈로그(catalog)는 SQL 시스템 안의 스키마 집합이며, 카탈로그 안의 모든 스키마 정보를 제공하는 특별한 스키마 `INFORMATION_SCHEMA`를 반드시 포함한다.

### 도메인 정의

```sql
CREATE DOMAIN 도메인_이름 데이터_타입
  [기정값_정의]
  [도메인_제약조건_정의_리스트];
```

```sql
CREATE DOMAIN DEPT CHAR(4)
  DEFAULT '???'
  CONSTRAINT VALID-DEPT
  CHECK (VALUE IN ('COMP', 'ME', 'EE', 'ARCH', '???'));
```

- 학과 도메인 DEPT를 네 자리 문자열로 정의한다.
- 값을 주지 않으면 기본값은 `NULL`이지만, 여기서는 `'???'`로 지정했다.
- `CHECK (VALUE IN (…))`은 목록에 있는 값만 허용해, 사용자가 임의의 학과명을 넣지 못하게 한다.

도메인은 `ALTER DOMAIN DEPT …`로 변경하고, `DROP DOMAIN 도메인_이름 RESTRICT | CASCADE`로 삭제한다.

### RESTRICT와 CASCADE

`DROP` 문에는 대부분 두 옵션 중 하나를 붙인다.

| 옵션     | 동작                                                      |
| -------- | --------------------------------------------------------- |
| RESTRICT | 다른 곳(뷰, 제약조건)에서 참조하고 있으면 삭제를 거부한다 |
| CASCADE  | 참조하는 뷰와 제약조건까지 연쇄적으로 함께 삭제한다       |

### 데이터 타입

| 분류      | 타입                                                               |
| --------- | ------------------------------------------------------------------ |
| 정수      | INT(INTEGER), SMALLINT                                             |
| 실수      | FLOAT(n), REAL, DOUBLE PRECISION                                   |
| 정형 숫자 | DECIMAL(i, j), NUMERIC(i, j)                                       |
| 문자열    | CHAR(n) 고정 길이, VARCHAR(n) 가변 길이                            |
| 비트열    | BIT(n), BIT VARYING(n)                                             |
| 날짜·시간 | DATE(YYYY-MM-DD), TIME(hh:mm:ss), TIMESTAMP(DATE + TIME), INTERVAL |

### 테이블의 종류

| 종류                           | 생성 방법                  | 저장                                                |
| ------------------------------ | -------------------------- | --------------------------------------------------- |
| 기본 테이블(base table)        | `CREATE TABLE`             | DBMS의 파일로 생성·저장되어 독자적으로 존재         |
| 가상 테이블(virtual table, 뷰) | `CREATE VIEW`              | 기본 테이블에서 유도되며 독자적으로 존재하지 않는다 |
| 임시 테이블(temporary table)   | 질의 처리 과정의 중간 결과 | DDL로 만들지 않는다                                 |

### 기본 테이블 생성

```sql
CREATE TABLE 테이블_이름
  ({열_이름 데이터_타입 [NOT NULL] [DEFAULT 값],}+
   [PRIMARY KEY (열_이름_리스트),]
   {[UNIQUE (열_이름_리스트),]}*
   {[FOREIGN KEY (열_이름_리스트)
       REFERENCES 기본_테이블[(열_이름_리스트)]
       [ON DELETE 옵션]
       [ON UPDATE 옵션],]}*
   [CONSTRAINT 이름] [CHECK (조건식)]);
```

| 절          | 명세하는 것                                              |
| ----------- | -------------------------------------------------------- |
| PRIMARY KEY | 기본 키와 개체 무결성. 널을 허용하지 않는다              |
| UNIQUE      | 대체 키(후보 키)                                         |
| NOT NULL    | 열 값에 널 금지                                          |
| FOREIGN KEY | 외래 키와 참조 무결성, 참조된 행이 삭제·갱신되면 할 동작 |
| CHECK       | 그 밖의 무결성 제약조건                                  |

==SQL에서는 기본 키뿐 아니라 참조된 테이블의 후보 키(UNIQUE 열)도 외래 키로 참조할 수 있다.== `ON DELETE`·`ON UPDATE` 옵션은 네 가지다.

| 옵션        | 참조된 행이 삭제·갱신되면                                      |
| ----------- | -------------------------------------------------------------- |
| NO ACTION   | 참조 무결성을 위반하는 삭제·갱신을 거부한다 (생략한 것과 같다) |
| SET NULL    | 참조하는 행의 외래 키 값을 NULL로 바꾼다                       |
| SET DEFAULT | 참조하는 행의 외래 키 값을 기본값으로 바꾼다                   |
| CASCADE     | 참조하는 행도 함께 삭제하거나 같은 값으로 갱신한다             |

```sql
CREATE TABLE ENROL
  (Sno   INTEGER NOT NULL,
   Cno   CHAR(6) NOT NULL,
   Grade INTEGER,
   PRIMARY KEY (Sno, Cno),
   FOREIGN KEY (Sno) REFERENCES STUDENT(Sno)
     ON DELETE CASCADE
     ON UPDATE CASCADE,
   FOREIGN KEY (Cno) REFERENCES COURSE
     ON DELETE CASCADE
     ON UPDATE CASCADE,
   CHECK (Grade >= 0 AND Grade <= 100));
```

학생이나 과목이 삭제되면 그 학생·과목의 등록 행도 함께 삭제된다.

### 테이블과 스키마의 변경·제거

```sql
DROP TABLE COURSE CASCADE;
DROP SCHEMA UNIVERSITY CASCADE;

ALTER TABLE ENROL ADD Final CHAR DEFAULT 'F';   -- 열 추가
ALTER TABLE ENROL DROP Grade CASCADE;            -- 열 삭제
```

`ALTER TABLE … ALTER 열_이름`으로는 기본값을 지정(`SET DEFAULT`)하거나 삭제(`DROP DEFAULT`)한다.

## 데이터 검색(SELECT)

```sql
SELECT [ALL | DISTINCT] 열_리스트
FROM   테이블_리스트
[WHERE 조건]
[GROUP BY 열_리스트 [HAVING 조건]]
[ORDER BY 열_리스트 [ASC | DESC]];
```

SELECT의 결과도 테이블이므로, SQL은 결과가 다시 테이블이 되는 **폐쇄 시스템(closed system)** 이다. 이 성질이 중첩 질의(nested query)의 이론적 기초다.

![SQL 예제용 학생(STUDENT) 테이블(학번·이름·학년·학과 5행)](./images/db-sql-ddl-dml-note-01.jpg 'SQL 예제용 학생(STUDENT) 테이블(학번·이름·학년·학과 5행) (강의 자료)')

![SQL 예제용 과목(COURSE) 테이블(과목번호·과목이름·학점·학과·담당교수 5행)](./images/db-sql-ddl-dml-note-02.jpg 'SQL 예제용 과목(COURSE) 테이블(과목번호·과목이름·학점·학과·담당교수 5행) (강의 자료)')

![SQL 예제용 등록(ENROL) 테이블(학번·과목번호·성적·중간성적·기말성적 11행)](./images/db-sql-ddl-dml-note-03.jpg 'SQL 예제용 등록(ENROL) 테이블(학번·과목번호·성적·중간성적·기말성적 11행) (강의 자료)')

### SQL 테이블과 릴레이션의 차이

이론상 릴레이션은 튜플의 집합이지만, SQL 테이블은 다르다.

- 한 테이블 안에 똑같은 행이 중복될 수 있다.
- 기본 키가 반드시 있어야 하는 것은 아니다.
- ==그래서 SQL 테이블은 같은 원소의 중복을 허용하는 다중 집합(multiset, bag)이다.==

`SELECT Dept FROM STUDENT`는 {컴퓨터, 전기, 컴퓨터, 컴퓨터, 산공} 다섯 행을 반환한다. ==집합과 같은 결과가 필요하면 `DISTINCT`를 쓴다.==

```sql
SELECT DISTINCT Dept FROM STUDENT;   -- 컴퓨터, 전기, 산공
```

### 기본 검색

```sql
-- 모든 열
SELECT * FROM STUDENT;

-- 조건 검색: 컴퓨터학과 4학년 → (100, 나수영), (400, 송병길)
SELECT Sno, Sname
FROM   STUDENT
WHERE  Dept = '컴퓨터' AND Year = 4;

-- 정렬: 중간성적 90 이상, 학번 내림차순·과목번호 오름차순
SELECT   Sno, Cno
FROM     ENROL
WHERE    Midterm >= 90
ORDER BY Sno DESC, Cno ASC;

-- 산술식, 문자열 상수, 열 이름 변경(AS)
SELECT Sno AS 학번, '중간시험 =' AS 시험, Midterm + 3 AS 점수
FROM   ENROL
WHERE  Cno = 'C312';
```

마지막 질의의 결과는 다음과 같다.

| 학번 | 시험       | 점수 |
| ---- | ---------- | ---- |
| 300  | 중간시험 = | 93   |
| 400  | 중간시험 = | 93   |
| 500  | 중간시험 = | 88   |

![컴퓨터 학과 학생 검색 결과(Sname·Sno: 나수영 100, 정기태 300, 송병길 400)](./images/db-sql-ddl-dml-note-04.jpg '컴퓨터 학과 학생 검색 결과(Sname·Sno: 나수영 100, 정기태 300, 송병길 400) (강의 자료)')

### 조인

FROM 절에 테이블이 둘 이상이면 조인이다. 다음 네 질의는 모두 "C413에 등록한 학생의 이름, 학과, 성적"을 구한다.

```sql
-- WHERE 절에 조인 조건 (동일 조인)
SELECT S.Sname, S.Dept, E.Grade
FROM   STUDENT S, ENROL E
WHERE  S.Sno = E.Sno AND E.Cno = 'C413';

-- JOIN … ON
SELECT Sname, Dept, Grade
FROM   STUDENT JOIN ENROL ON (STUDENT.Sno = ENROL.Sno)
WHERE  ENROL.Cno = 'C413';

-- JOIN … USING: 조인 열의 이름이 같을 때
SELECT Sname, Dept, Grade
FROM   STUDENT JOIN ENROL USING (Sno)
WHERE  ENROL.Cno = 'C413';

-- NATURAL JOIN: 이름이 같은 모든 열로 조인
SELECT Sname, Dept, Grade
FROM   STUDENT NATURAL JOIN ENROL
WHERE  ENROL.Cno = 'C413';
```

| Sname  | Dept   | Grade |
| ------ | ------ | ----- |
| 나수영 | 컴퓨터 | A     |
| 정기태 | 컴퓨터 | A     |
| 송병길 | 컴퓨터 | B     |

같은 테이블에 별칭을 둘 붙이면 자기 자신과 조인할 수 있다. 다음은 같은 학과 학생 쌍을 구한다. `S1.Sno < S2.Sno` 조건은 (100, 100) 같은 자기 자신과의 쌍과 (300, 100) 같은 역순 쌍을 제거한다.

```sql
SELECT S1.Sno, S2.Sno
FROM   STUDENT S1, STUDENT S2
WHERE  S1.Dept = S2.Dept AND S1.Sno < S2.Sno;
-- (100, 300), (100, 400), (300, 400)
```

### 집계 함수, GROUP BY, HAVING

집계 함수는 COUNT, SUM, AVG, MAX, MIN이다.

```sql
SELECT COUNT(*) AS 학생수 FROM STUDENT;                    -- 5
SELECT COUNT(DISTINCT Cno) FROM ENROL WHERE Sno = 300;     -- 학번 300이 등록한 과목 수
SELECT AVG(Midterm) AS 중간평균 FROM ENROL WHERE Cno = 'C413';
```

`GROUP BY`는 지정한 열의 값이 같은 행끼리 그룹으로 묶고, 그룹마다 집계 함수를 적용한다. `HAVING`은 그룹에 대한 조건이다. ==행에 대한 조건인 `WHERE`는 그룹을 만들기 전에, `HAVING`은 그룹을 만든 뒤에 적용된다.==

```sql
-- 과목별 기말성적 평균
SELECT   Cno, AVG(Final) AS 기말평균
FROM     ENROL
GROUP BY Cno;

-- 수강생이 3명 이상인 과목의 기말성적 평균 → C413 90, C312 90
SELECT   Cno, AVG(Final) AS 평균
FROM     ENROL
GROUP BY Cno
HAVING   COUNT(*) >= 3;
```

### 부속 질의(subquery)

다른 질의문 안에 중첩된 SELECT 문을 부속 질의라 하고, 부속 질의를 포함한 바깥 질의를 중첩 질의라 한다. `IN` 뒤의 부속 질의는 집합 멤버십 연산자(∈)로 해석된다. `ORDER BY`는 항상 마지막에 적용하므로 부속 질의 안에는 쓸 수 없고 바깥 질의에만 쓴다.

```sql
-- C413에 등록한 학생의 이름 → 나수영, 정기태, 송병길
SELECT Sname FROM STUDENT
WHERE  Sno IN (SELECT Sno FROM ENROL WHERE Cno = 'C413');

-- C413에 등록하지 않은 학생의 이름 → 이찬수, 박종화
SELECT Sname FROM STUDENT
WHERE  Sno NOT IN (SELECT Sno FROM ENROL WHERE Cno = 'C413');

-- 정기태와 같은 학과 학생
SELECT Sname, Dept FROM STUDENT
WHERE  Dept = (SELECT Dept FROM STUDENT WHERE Sname = '정기태');

-- 학번 500의 모든 기말성적보다 높은 기말성적의 학번·과목번호
SELECT Sno, Cno FROM ENROL
WHERE  Final > ALL (SELECT Final FROM ENROL WHERE Sno = 500);
```

첫 질의는 조인으로도 같은 결과를 얻는다. 부속 질의는 처리 순서를 명시하는 형태라, ==조인으로 표현할 수 있는 질의는 대개 조인이 더 낫다.==

### LIKE

`LIKE`는 부분 문자열 패턴을 비교한다.

| 패턴     | 의미                                 |
| -------- | ------------------------------------ |
| `%`      | 길이와 내용에 관계없는 임의의 문자열 |
| `_`      | 임의의 문자 하나                     |
| `'S__'`  | S로 시작하는 세 글자                 |
| `'%S__'` | 끝에서 세 번째 글자가 S              |
| `'%S%'`  | S를 포함                             |

```sql
SELECT Cno, Cname FROM COURSE WHERE Cno LIKE 'C%';
-- C123 프로그래밍, C312 자료구조, C324 화일구조, C413 데이터베이스
```

### NULL과 3값 논리

NULL은 누락된 정보(missing information)를 나타내며, 값은 있지만 모르는 값(unknown), 해당하지 않는 값(inapplicable), 의도적으로 유보한 값(withheld)을 포함한다. NULL이 들어간 비교의 결과는 참도 거짓도 아닌 미정(unknown)이므로, SQL은 참·거짓·미정의 3값 논리(3VL)를 쓴다.

| AND  | 참   | 미정 | 거짓 |
| ---- | ---- | ---- | ---- |
| 참   | 참   | 미정 | 거짓 |
| 미정 | 미정 | 미정 | 거짓 |
| 거짓 | 거짓 | 거짓 | 거짓 |

| OR   | 참  | 미정 | 거짓 |
| ---- | --- | ---- | ---- |
| 참   | 참  | 참   | 참   |
| 미정 | 참  | 미정 | 미정 |
| 거짓 | 참  | 미정 | 거짓 |

NOT 미정은 미정이다.

```sql
SELECT Sno, Sname FROM STUDENT WHERE Dept IS NULL;
```

- ==NULL 검사는 `열_이름 IS [NOT] NULL` 형식만 허용한다.== `Dept = NULL`은 잘못된 문법이다.
- 조건식에서 NULL을 비교 연산자와 쓰면 결과가 미정이 되고, WHERE 절은 참인 행만 반환하므로 그 행은 결과에서 제외된다.

![NULL이 추가된 3값 논리(T·F·U)의 AND·OR·NOT 진리표](./images/db-sql-ddl-dml-note-05.jpg 'NULL이 추가된 3값 논리(T·F·U)의 AND·OR·NOT 진리표 (강의 자료)')

![Year가 널이면 Year>3·Year≤3·Year=3·Year≠3은 모두 거짓이고 Year=NULL·Year≠NULL은 불법이라는 설명 박스](./images/db-sql-ddl-dml-note-06.jpg 'Year가 널이면 Year>3·Year≤3·Year=3·Year≠3은 모두 거짓이고 Year=NULL·Year≠NULL은 불법이라는 설명 박스 (강의 자료)')

### EXISTS

`EXISTS`는 부속 질의의 결과가 공집합이 아니면 참이다. 부속 질의가 바깥 질의의 행(`STUDENT.Sno`)을 참조하므로, 바깥 행마다 부속 질의를 평가한다.

```sql
-- C413에 등록한 학생
SELECT Sname FROM STUDENT
WHERE  EXISTS (SELECT * FROM ENROL
               WHERE Sno = STUDENT.Sno AND Cno = 'C413');

-- C413에 등록하지 않은 학생
SELECT Sname FROM STUDENT
WHERE  NOT EXISTS (SELECT * FROM ENROL
                   WHERE Sno = STUDENT.Sno AND Cno = 'C413');
```

### UNION

두 SELECT 결과의 합집합이다. 두 결과의 열 수와 도메인이 같아야 하고(합병 가능), 중복 행은 제거된다.

```sql
-- 3학년이거나 C324에 등록한 학생의 학번 → 200, 300, 400
SELECT Sno FROM STUDENT WHERE Year = 3
UNION
SELECT Sno FROM ENROL   WHERE Cno = 'C324';
```

## 데이터 삽입·갱신·삭제

### INSERT

```sql
INSERT INTO 테이블 [(열_이름_리스트)] VALUES (열값_리스트);
INSERT INTO 테이블 [(열_이름_리스트)] SELECT 문;
```

```sql
INSERT INTO STUDENT (Sno, Sname, Year, Dept) VALUES (600, '박상철', 1, '컴퓨터');
INSERT INTO STUDENT VALUES (600, '박상철', 1, '컴퓨터');           -- 열 순서대로면 열 이름 생략
INSERT INTO STUDENT (Sno, Sname, Year) VALUES (600, '박상철', 1);  -- 빠진 Dept는 NULL

-- 부속 질의 결과를 삽입: 컴퓨터학과 학생을 COMPUTER 테이블로 복사
INSERT INTO COMPUTER (Sno, Sname, Year)
SELECT Sno, Sname, Year FROM STUDENT WHERE Dept = '컴퓨터';
```

### UPDATE

```sql
UPDATE 테이블 SET {열_이름 = 산술식}+ [WHERE 조건];
```

```sql
-- 한 행: 학번 300의 학년을 2로
UPDATE STUDENT SET Year = 2 WHERE Sno = 300;

-- 여러 행: 컴퓨터학과 과목의 학점을 1씩 증가
UPDATE COURSE SET Credit = Credit + 1 WHERE Dept = '컴퓨터';

-- 부속 질의를 조건에: 컴퓨터학과 학생의 기말성적을 5점씩 올린다
UPDATE ENROL SET Final = Final + 5
WHERE  Sno IN (SELECT Sno FROM STUDENT WHERE Dept = '컴퓨터');

-- 부속 질의를 값에: 4학년의 학과를 데이터베이스 과목을 개설한 학과로
UPDATE STUDENT
SET    Dept = (SELECT Dept FROM COURSE WHERE Cname = '데이터베이스')
WHERE  Year = 4;
```

### DELETE

```sql
DELETE FROM 테이블 [WHERE 조건];

DELETE FROM ENROL WHERE Sno = 300;                     -- 학번 300의 등록 행 삭제
DELETE FROM ENROL
WHERE  Cno = 'C413' AND Final < 60;                    -- C413 기말성적 60점 미만 삭제
```

==WHERE 절을 생략하면 테이블의 모든 행이 삭제되지만 테이블 정의는 남는다.== 테이블 자체를 제거하는 것은 `DROP TABLE`이다.

## 과제로 풀어 본 문제

**학생·과목·등록 테이블 정의.** 6주차 과제에서 예제 테이블 세 개를 DDL로 정의했다. 제출한 시각의 답에는 `FOREGIN` 오타, `Sno INT NOT NULL` 뒤의 쉼표 누락, `≥`·`≤` 기호, 빠진 제약조건 이름이 있었다. 고친 정의는 다음과 같다.

```sql
CREATE TABLE STUDENT
  (Sno   INT      NOT NULL,
   Sname CHAR(10) NOT NULL,
   Year  INT      NOT NULL,
   Dept  CHAR(10) NOT NULL,
   CONSTRAINT STUDENT_PK PRIMARY KEY (Sno));

CREATE TABLE COURSE
  (Cno    CHAR(4)  NOT NULL,
   Cname  CHAR(20) NOT NULL,
   Credit INT      NOT NULL,
   Dept   CHAR(10) NOT NULL,
   PRname CHAR(10) NOT NULL,
   CONSTRAINT COURSE_PK PRIMARY KEY (Cno));

CREATE TABLE ENROL
  (Sno     INT     NOT NULL,
   Cno     CHAR(4) NOT NULL,
   Grade   CHAR(1),
   Midterm INT,
   Final   INT,
   CONSTRAINT ENROL_PK  PRIMARY KEY (Sno, Cno),
   CONSTRAINT ENROL_FK1 FOREIGN KEY (Sno) REFERENCES STUDENT
     ON DELETE CASCADE ON UPDATE CASCADE,
   CONSTRAINT ENROL_FK2 FOREIGN KEY (Cno) REFERENCES COURSE
     ON DELETE CASCADE ON UPDATE CASCADE,
   CONSTRAINT ENROL_SCORE CHECK (Midterm >= 0 AND Midterm <= 100
                                 AND Final >= 0 AND Final <= 100));
```

`CHAR`에 길이를 생략하면 `CHAR(1)`이 되어 '컴퓨터' 같은 값을 넣을 수 없으므로 길이도 명시했다. 제약조건에 이름을 붙여 두면 `ALTER TABLE ENROL DROP CONSTRAINT ENROL_SCORE`처럼 이름으로 제거할 수 있다.

**검색문 결과 확인.** 7주차 과제에서 본문의 검색문 15개를 예제 데이터에 적용해 결과를 손으로 계산했다. 다시 확인하니 과목별 기말성적 평균에서 C324는 (75 + 90) / 2 = 82.5인데 82로 적었다. `AVG`는 정수 열이어도 소수 결과를 반환하는 DBMS가 많고(Oracle은 82.5), 정수 나눗셈으로 버리는 DBMS도 있으므로 결과 타입을 확인해야 한다.

**SQL로 바꾼 질의.** 학생(학번, 이름, 학년), 과목(과목번호, 과목이름, 교수), 등록(과목번호, 학번, 점수) 스키마에서 다음 질의를 썼다.

```sql
-- DBMS 과목을 수강한 4학년 학생의 이름: 부속 질의를 두 번 중첩
SELECT 학생.이름
FROM   학생
WHERE  학생.학년 = 4
  AND  학생.학번 IN (SELECT 등록.학번 FROM 등록
                     WHERE 등록.과목번호 = (SELECT 과목.과목번호 FROM 과목
                                            WHERE 과목.과목이름 = 'DBMS'));

-- 같은 질의를 조인으로
SELECT 학생.이름
FROM   학생 JOIN 등록 ON 학생.학번 = 등록.학번
            JOIN 과목 ON 등록.과목번호 = 과목.과목번호
WHERE  학생.학년 = 4 AND 과목.과목이름 = 'DBMS';

-- AI 과목 삽입 (교수는 NULL)
INSERT INTO 과목 (과목번호, 과목이름) VALUES ('C419', 'AI');

-- DBMS 과목 삭제
DELETE FROM 과목 WHERE 과목이름 = 'DBMS';

-- 학번 12345 학생의 학년을 4로
UPDATE 학생 SET 학년 = 4 WHERE 학번 = 12345;
```

==`=` 뒤의 부속 질의는 결과가 한 행일 때만 쓸 수 있다.== 과목이름이 'DBMS'인 과목이 둘이면 실행 오류가 나므로, 결과가 여러 행일 수 있으면 `IN`을 쓴다.

[관계 대수 글](/memo/db-relational-algebra)의 납품 데이터베이스 질의를 SQL로 바꾸면 다음과 같다. 관계 대수에서 SP를 거쳐야 했던 것처럼 SQL에서도 S와 P는 SP로 조인한다.

```sql
SELECT Sname, City FROM S;

SELECT S.Sname FROM S JOIN SP ON S.Sno = SP.Sno WHERE SP.Pno = 123;

SELECT Pname FROM P WHERE Colour = 'red';

SELECT S.Sname
FROM   S JOIN SP ON S.Sno = SP.Sno
         JOIN P  ON SP.Pno = P.Pno
WHERE  P.Pname = 'Nut';
```

## 정리

- SQL은 DDL·DML·DCL을 모두 제공하는 비절차적 표준 언어이며, 결과가 다시 테이블인 폐쇄 시스템이다.
- 외래 키의 `ON DELETE`·`ON UPDATE` 옵션으로 참조 무결성을 지키는 방법(거부, 널, 기본값, 연쇄)을 정한다.
- SQL 테이블은 중복 행을 허용하는 다중 집합이라, 집합 결과가 필요하면 `DISTINCT`를 쓴다.
- NULL 비교는 미정이 되므로 `IS NULL`로 검사한다.

## 관련 글

- [관계 대수의 연산자와 폐쇄 성질](/memo/db-relational-algebra): SQL의 이론적 기초인 관계 대수
- [SQL 뷰의 갱신 가능 조건과 삽입 SQL의 커서](/memo/db-sql-view-cursor): 6장 뒷부분을 다룬 다음 글

#데이터베이스 #SQL #CS
