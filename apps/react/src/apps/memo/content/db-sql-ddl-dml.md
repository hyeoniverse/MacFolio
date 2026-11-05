---
title: SQL 데이터 정의문과 SELECT·INSERT·UPDATE 조작문
date: 2023-04-18
category: CS/데이터베이스
series: 데이터베이스 기초
seriesOrder: 5
summary: SQL의 특징, CREATE·ALTER·DROP과 외래 키의 ON DELETE·ON UPDATE 옵션, Oracle의 VARCHAR2·NUMBER·제약조건 이름, SELECT의 조인·집계·GROUP BY·부속 질의·NULL·EXISTS·UNION, INSERT·UPDATE·DELETE를 예제 결과와 함께 정리하고 6장 연습문제를 풀었다.
---

데이터베이스 기초 연재의 다섯 번째 글로, 6장(SQL) 앞부분을 다룬다. 예제의 테이블은 다음과 같다.

```text
STUDENT (Sno 학번, Sname 이름, Year 학년, Dept 학과)
COURSE  (Cno 과목번호, Cname 과목이름, Credit 학점, Dept 학과, Prname 담당교수)
ENROL   (Sno 학번, Cno 과목번호, Grade 성적, Midterm 중간성적, Final 기말성적)
```

## SQL의 역사와 특징

SQL(Structured Query Language)은 1974년 IBM 연구소가 발표한 SEQUEL(Structured English QUEry Language)에서 시작했다. IBM은 SEQUEL을 실험적 관계 DBMS인 System R의 인터페이스로 설계·구현했다.

| 표준          | 연도 | 비고                               |
| ------------- | ---- | ---------------------------------- |
| SQL-86 (SQL1) | 1986 | 최초의 표준                        |
| SQL-92 (SQL2) | 1992 | 개정                               |
| SQL-99 (SQL3) | 1999 |                                    |
| SQL:2003      | 2003 | 객체 개념 지원 추가, 강의록은 SQL4 |

현재 ANSI와 ISO가 관계 데이터베이스의 표준 언어로 채택했다. IBM의 DB2와 SQL/DS가 데이터 언어로 사용하고, Oracle, Informix, Sybase 같은 주요 상용 DBMS도 모두 채택했다.

==SQL은 단순한 질의어가 아니라 DDL, DML, DCL 기능을 모두 제공하는 종합 데이터베이스 언어다.== 특징은 다음과 같다.

- 관계 대수와 확장된 튜플 관계 해석에 기초한다.
- 고급·비절차적 언어로, 사용자 친화적인 인터페이스를 제공한다. 데이터 처리의 접근 경로(access path)를 명세하지 않는 선언적 언어다.
- 표준화되어 있어 상용 RDBMS 사이의 전환이 쉽고, 여러 관계 데이터베이스에 접근하는 응용 프로그램을 작성할 수 있다.
- 터미널에서 대화식 질의어로 쓸 수도 있고, Java, C, C++, COBOL 같은 범용 프로그래밍 언어의 응용 프로그램에 삽입해 쓸 수도 있다.
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
  CONSTRAINT VALID_DEPT
  CHECK (VALUE IN ('COMP', 'ME', 'EE', 'ARCH', '???'));
```

- 학과 도메인 DEPT를 네 자리 문자열로 정의한다.
- 값을 주지 않으면 기본값은 `NULL`이지만, 여기서는 `'???'`로 지정했다.
- `CHECK (VALUE IN (…))`은 목록에 있는 값만 허용해, 사용자가 임의의 학과명을 넣지 못하게 한다.
- 강의록은 제약조건 이름을 `VALID-DEPT`로 썼지만, 따옴표 없는 식별자에는 `-`를 쓸 수 없으므로 `VALID_DEPT`로 적었다.

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
DROP TABLE  기본_테이블_이름 { RESTRICT | CASCADE };
DROP SCHEMA 스키마_이름      { RESTRICT | CASCADE };

ALTER TABLE 기본_테이블_이름
  ( [ADD 열_이름 데이터_타입] [DEFAULT 기정값]
  | [DROP 열_이름] [RESTRICT | CASCADE]
  | [ALTER 열_이름 (DROP DEFAULT | SET DEFAULT 기정값)] );
```

```sql
DROP TABLE COURSE CASCADE;
DROP SCHEMA UNIVERSITY CASCADE;

ALTER TABLE ENROL ADD Final CHAR DEFAULT 'F';   -- 열 추가
ALTER TABLE ENROL DROP Grade CASCADE;            -- 열 삭제
```

열을 삭제할 때의 `RESTRICT`·`CASCADE`도 테이블 삭제와 같다. 그 열을 참조하는 뷰나 제약조건이 있으면 `RESTRICT`는 실행을 거부하고, `CASCADE`는 그 뷰와 제약조건까지 삭제한다. `ALTER TABLE … ALTER 열_이름`으로는 기본값을 지정(`SET DEFAULT`)하거나 삭제(`DROP DEFAULT`)한다.

### Oracle의 DDL

실습은 Oracle에서 했다. 표준 SQL과 다른 점은 다음과 같다.

| 표준 타입       | Oracle       | 설명                                                                         |
| --------------- | ------------ | ---------------------------------------------------------------------------- |
| CHAR(s)         | CHAR(s)      | 고정 길이, 기본 1바이트, 최대 2,000바이트. 값이 s보다 짧으면 공백으로 채운다 |
| VARCHAR(s)      | VARCHAR2(s)  | 가변 길이, 최대 4,000바이트. 실제 값의 바이트만 저장한다                     |
| NUMERIC         | NUMBER(p, s) | 전체 자릿수 p와 소수 자릿수 s. 정수 6자리·소수 2자리면 `NUMBER(8,2)`         |
| DATE, TIMESTAMP | DATE         | 날짜와 시각을 1초 단위로 보관한다                                            |

==CHAR는 짧은 쪽 끝에 공백을 채워 비교하므로 끝의 공백만 다른 두 문자열이 같고, VARCHAR2는 공백도 문자로 비교하므로 다르다.== `'AA' = 'AA   '`은 CHAR에서 참, VARCHAR2에서 거짓이다. 길이가 다양한 열에는 저장 공간이 실제 데이터 크기만큼만 드는 VARCHAR2가 적합하다.

테이블 이름과 열 이름은 문자로 시작해야 하고, `A-Z`, `a-z`, `0-9`, `_`, `$`, `#`만 쓸 수 있으며, 예약어는 쓸 수 없다. `10_PLAYER`는 숫자로 시작해서, `T-PLAYER`는 `-`를 포함해서 잘못된 이름이다. 한 테이블 안에서 열 이름이 중복될 수 없고, 열마다 데이터 타입을 반드시 지정한다.

```sql
CREATE TABLE PLAYER
  (PLAYER_ID   CHAR(7)      NOT NULL,
   PLAYER_NAME VARCHAR2(20) NOT NULL,
   TEAM_ID     CHAR(3)      NOT NULL,
   POSITION    VARCHAR2(10),
   BACK_NO     NUMBER(2),
   BIRTH_DATE  DATE,
   HEIGHT      NUMBER(3),
   CONSTRAINT PLAYER_PK PRIMARY KEY (PLAYER_ID),
   CONSTRAINT PLAYER_FK FOREIGN KEY (TEAM_ID) REFERENCES TEAM(TEAM_ID));
```

`NOT NULL`처럼 열 정의 뒤에 쓰는 제약조건을 열 수준(column level), `CONSTRAINT PLAYER_PK …`처럼 열 정의를 마친 뒤 모아 쓰는 제약조건을 테이블 수준(table level) 제약조건이라 한다. 두 방식은 기능이 같고 한 문장 안에서 섞어 쓸 수 있다. ==`CONSTRAINT 이름`으로 제약조건에 이름을 붙이면 나중에 그 이름으로 제약조건을 삭제하거나 다시 추가할 수 있다.== 이름을 생략하면 Oracle은 `SYS_C0012345` 같은 이름을 자동으로 붙인다.

| 제약조건    | Oracle 강의록의 설명                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| PRIMARY KEY | 테이블당 하나. DBMS가 UNIQUE 인덱스를 자동으로 만들고 NULL을 금지한다. 기본 키 제약 = UNIQUE + NOT NULL |
| UNIQUE      | 행을 고유하게 식별한다. NULL은 대상이 아니라 NULL인 행이 여러 개여도 위반이 아니다                      |
| NOT NULL    | 기본값은 모든 열이 NULL을 허용하며, 지정하면 입력 필수 열이 된다                                        |
| CHECK       | 참·거짓으로 평가되는 논리식으로 입력 값의 범위를 제한한다                                               |
| FOREIGN KEY | 다른 테이블의 기본 키를 복사해 테이블 사이의 관계를 정의한다. 참조 무결성 옵션을 지정할 수 있다         |

==Oracle의 외래 키는 `ON DELETE CASCADE`와 `ON DELETE SET NULL`만 지원하고 `ON UPDATE` 절은 지원하지 않는다.== 표준 SQL의 `ON UPDATE CASCADE`를 그대로 쓰면 Oracle에서는 문법 오류가 난다.

테이블 구조 변경은 Oracle에서 다음과 같이 쓴다.

```sql
DESCRIBE PLAYER;                                          -- 열 이름, NULL 허용 여부, 데이터 타입 조회
ALTER TABLE PLAYER ADD (ADDRESS VARCHAR2(80));            -- 열 추가 (항상 마지막 열이 된다)
ALTER TABLE PLAYER DROP COLUMN ADDRESS;                   -- 열 삭제 (복구할 수 없다)
ALTER TABLE PLAYER MODIFY (POSITION VARCHAR2(20) DEFAULT 'MF' NOT NULL);  -- 타입·기본값·NOT NULL 변경
ALTER TABLE PLAYER RENAME COLUMN PLAYER_ID TO TEMP_ID;    -- 열 이름 변경
ALTER TABLE PLAYER DROP CONSTRAINT PLAYER_FK;             -- 제약조건 삭제
ALTER TABLE PLAYER ADD CONSTRAINT PLAYER_FK
  FOREIGN KEY (TEAM_ID) REFERENCES TEAM(TEAM_ID);         -- 제약조건 추가
RENAME TEAM TO TEAM_BACKUP;                               -- 테이블 이름 변경
DROP TABLE TEAM CASCADE CONSTRAINTS;                      -- 참조하는 외래 키 제약조건과 함께 삭제
```

<details>
<summary>Oracle 구문의 제한</summary>

- `ADD`로 추가한 열은 테이블의 마지막 열이 되며, 위치를 지정할 수 없다.
- `DROP COLUMN`은 열 하나를 지정하고, 삭제한 뒤에도 테이블에 열이 하나 이상 남아야 한다.
- `RENAME COLUMN`은 관련 제약조건의 열 이름도 함께 바꾸지만, ANSI/ISO 표준이 아니라 Oracle 등 일부 DBMS만 지원한다.
- SQL Server는 `MODIFY` 대신 `ALTER TABLE … ALTER COLUMN`을 쓰고, 테이블 구조는 `sp_help`로 조회한다.
- 강의록은 `DROP TABLE … [CASCADE CONSTRAINT]`로 적었지만 Oracle의 키워드는 `CASCADE CONSTRAINTS`다.

</details>

## 데이터 검색(SELECT)

```sql
SELECT [ALL | DISTINCT] 열_리스트
FROM   테이블_리스트
[WHERE 조건]
[GROUP BY 열_리스트 [HAVING 조건]]
[ORDER BY 열_리스트 [ASC | DESC]];
```

`ALL`은 기본 옵션이라 생략할 수 있고 중복 행을 모두 출력한다. SELECT의 결과도 테이블이므로, SQL은 결과가 다시 테이블이 되는 **폐쇄 시스템(closed system)** 이다. 이 성질이 중첩 질의(nested query)의 이론적 기초다.

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

-- 컴퓨터학과 학생의 이름과 학번. 열 이름을 테이블 이름으로 한정해도 같다
SELECT Sname, Sno FROM STUDENT WHERE Dept = '컴퓨터';
SELECT STUDENT.Sname, STUDENT.Sno FROM STUDENT WHERE STUDENT.Dept = '컴퓨터';

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

![컴퓨터 학과 학생 검색 결과(Sname·Sno: 나수영 100, 정기태 300, 송병길 400)](./images/db-sql-ddl-dml-note-04.jpg '컴퓨터 학과 학생 검색 결과(Sname·Sno: 나수영 100, 정기태 300, 송병길 400) (강의 자료)')

정렬 질의와 마지막 질의의 결과는 다음과 같다.

| Sno | Cno  |
| --- | ---- |
| 400 | C312 |
| 400 | C324 |
| 300 | C312 |
| 300 | C413 |
| 100 | C413 |
| 100 | E412 |

| 학번 | 시험       | 점수 |
| ---- | ---------- | ---- |
| 300  | 중간시험 = | 93   |
| 400  | 중간시험 = | 93   |
| 500  | 중간시험 = | 88   |

Oracle에서는 `AS`를 생략하고 `SELECT PLAYER_NAME 선수명 FROM PLAYER`처럼 열 이름 바로 뒤에 별칭(alias)을 써도 된다. 별칭에 공백이나 특수 문자가 있거나 대소문자를 구분해야 하면 `"선수 이름"`처럼 큰따옴표로 감싼다. 산술 연산자는 NUMBER와 DATE 타입에 적용되고, 우선순위는 괄호, `*`·`/`, `+`·`-` 순이다.

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
SELECT COUNT(DISTINCT Cno) FROM ENROL WHERE Sno = 300;     -- 3 (C312, C324, C413)
SELECT AVG(Midterm) AS 중간평균 FROM ENROL WHERE Cno = 'C413';  -- (90 + 95 + 80) / 3 = 88.33…
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

| Cno  | 기말평균 | 계산               |
| ---- | -------- | ------------------ |
| C123 | 80       | 80                 |
| C312 | 90       | (95 + 95 + 80) / 3 |
| C324 | 82.5     | (75 + 90) / 2      |
| C413 | 90       | (95 + 90 + 85) / 3 |
| E412 | 85       | (95 + 75) / 2      |

Oracle은 정수 열의 `AVG`도 82.5처럼 소수로 반환하지만, SQL Server는 정수 열의 `AVG`를 정수로 반환해 82가 된다. 소수 결과가 필요하면 `AVG(Final * 1.0)`처럼 실수로 바꿔 계산한다.

### 부속 질의(subquery)

다른 질의문 안에 중첩된 SELECT 문을 부속 질의라 하고, 부속 질의를 포함한 바깥 질의를 중첩 질의라 한다. 부속 질의도 SELECT-FROM-WHERE-GROUP BY-HAVING 형태를 갖는다. `IN` 뒤의 부속 질의는 집합 멤버십 연산자(∈)로 해석된다. `ORDER BY`는 항상 마지막에 적용하므로 부속 질의 안에는 쓸 수 없고 바깥 질의에만 쓴다.

```sql
-- C413에 등록한 학생의 이름 → 나수영, 정기태, 송병길
SELECT Sname FROM STUDENT
WHERE  Sno IN (SELECT Sno FROM ENROL WHERE Cno = 'C413');

-- C413에 등록하지 않은 학생의 이름 → 이찬수, 박종화
SELECT Sname FROM STUDENT
WHERE  Sno NOT IN (SELECT Sno FROM ENROL WHERE Cno = 'C413');

-- 정기태와 같은 학과 학생 → 나수영, 정기태, 송병길 (모두 컴퓨터)
SELECT Sname, Dept FROM STUDENT
WHERE  Dept = (SELECT Dept FROM STUDENT WHERE Sname = '정기태');

-- 학번 500의 모든 기말성적보다 높은 기말성적의 학번·과목번호
SELECT Sno, Cno FROM ENROL
WHERE  Final > ALL (SELECT Final FROM ENROL WHERE Sno = 500);
```

학번 500의 기말성적은 C312의 80 하나이므로 마지막 질의는 기말성적이 80보다 높은 등록 행을 반환한다. 80점인 (200, C123)과 (500, C312), 75점인 (300, C324)와 (400, E412)는 제외된다.

| Sno | Cno  | Final |
| --- | ---- | ----- |
| 100 | C413 | 95    |
| 100 | E412 | 95    |
| 300 | C312 | 95    |
| 300 | C413 | 90    |
| 400 | C312 | 95    |
| 400 | C324 | 90    |
| 400 | C413 | 85    |

==`IN` 부속 질의로 쓴 질의는 대부분 조인으로 바꿔 쓸 수 있다.== 첫 질의는 [조인](#조인) 절의 질의와 결과가 같다. 다만 조인은 바깥 테이블의 한 행이 안쪽 테이블의 여러 행과 맞으면 그 행을 여러 번 반환하므로, 학생 한 명이 조건에 맞는 등록 행을 여럿 가질 수 있으면 `DISTINCT`를 붙여야 같은 결과가 된다.

### LIKE

`LIKE`는 부분 문자열 패턴(substring pattern)을 비교하는 연산자다.

| 패턴     | 의미                                 |
| -------- | ------------------------------------ |
| `%`      | 길이와 내용에 관계없는 임의의 문자열 |
| `_`      | 임의의 문자 하나                     |
| `'S__'`  | S로 시작하는 세 글자                 |
| `'%S__'` | 끝에서 세 번째 글자가 S              |
| `'%S%'`  | S를 포함                             |

```sql
SELECT Cno, Cname FROM COURSE WHERE Cno LIKE 'C%';
-- C123 프로그래밍, C312 자료 구조, C324 파일 구조, C413 데이터베이스
```

### NULL과 3값 논리

NULL은 누락된 정보(missing information)를 나타내며, 값은 있지만 모르는 값(unknown), 해당하지 않는 값(inapplicable), 의도적으로 유보한 값(withheld)을 포함한다. NULL은 공백(ASCII 32)이나 숫자 0(ASCII 48)과 다른 값이고, 조건에 맞는 행이 없는 공집합과도 다르다. NULL이 들어간 비교의 결과는 참도 거짓도 아닌 미정(unknown)이므로, SQL은 참·거짓·미정의 3값 논리(3VL)를 쓴다.

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

- ==NULL 검사는 `열_이름 IS [NOT] NULL` 형식만 허용한다.== 표준 SQL에서 `Dept = NULL`은 잘못된 문법이고, 이 식을 실행하는 DBMS에서도 결과가 미정이라 행을 하나도 반환하지 않는다.
- 조건식에서 NULL을 비교 연산자와 쓰면 결과가 미정이 되고, WHERE 절은 참인 행만 반환하므로 그 행은 결과에서 제외된다.
- 예제 STUDENT에는 Dept가 NULL인 행이 없어 위 질의의 결과는 공집합이다.

![NULL이 추가된 3값 논리(T·F·U)의 AND·OR·NOT 진리표](./images/db-sql-ddl-dml-note-05.jpg 'NULL이 추가된 3값 논리(T·F·U)의 AND·OR·NOT 진리표 (강의 자료)')

![Year가 널이면 Year>3·Year≤3·Year=3·Year≠3은 모두 거짓이고 Year=NULL·Year≠NULL은 불법이라는 설명 박스](./images/db-sql-ddl-dml-note-06.jpg 'Year가 널이면 Year>3·Year≤3·Year=3·Year≠3은 모두 거짓이고 Year=NULL·Year≠NULL은 불법이라는 설명 박스 (강의 자료)')

### EXISTS

`EXISTS`는 부속 질의의 결과가 공집합이 아니면 참이다. 부속 질의가 바깥 질의의 행(`STUDENT.Sno`)을 참조하므로, 바깥 행마다 부속 질의를 평가한다.

```sql
-- C413에 등록한 학생 → 나수영, 정기태, 송병길
SELECT Sname FROM STUDENT
WHERE  EXISTS (SELECT * FROM ENROL
               WHERE Sno = STUDENT.Sno AND Cno = 'C413');

-- C413에 등록하지 않은 학생 → 이찬수, 박종화
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

3학년은 200, C324 등록 학생은 300과 400이다. 강의록의 예제는 `Year = 1`로, 1학년 300과 C324의 300, 400을 합쳐 중복된 300을 한 번만 남긴 300, 400이 결과다.

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

열 이름 리스트의 순서는 테이블의 열 순서와 달라도 된다. 리스트에서 빠진 열에는 기본값이, 기본값이 없으면 NULL이 들어가므로, 기본 키나 NOT NULL 열을 빠뜨리면 삽입이 거부된다. 열 이름 리스트를 생략하면 모든 열의 값을 테이블의 열 순서대로 빠짐없이 적어야 한다.

<details>
<summary>Oracle의 INSERT</summary>

- 문자 타입(CHAR, VARCHAR2) 값은 작은따옴표로 감싸고, 숫자는 따옴표 없이 쓴다.
- 모르는 값은 `NULL`로 명시한다. Oracle은 빈 문자열 `''`도 NULL로 취급한다.
- DATE 열에는 `to_date('2020-01-01', 'yyyy-mm-dd')`처럼 문자열과 형식 모델을 함께 넘기거나, 표준 날짜 리터럴 `DATE '2020-01-01'`을 쓴다.

```sql
INSERT INTO PLAYER (PLAYER_ID, PLAYER_NAME, TEAM_ID, POSITION, HEIGHT, BACK_NO, BIRTH_DATE)
VALUES ('2002007', '홍길동', 'K07', 'MF', 178, 7, to_date('1981-02-25', 'yyyy-mm-dd'));
```

</details>

### UPDATE

```sql
UPDATE 테이블 SET {열_이름 = 산술식}+ [WHERE 조건];
```

```sql
-- 한 행: 학번 300의 학년을 2로
UPDATE STUDENT SET Year = 2 WHERE Sno = 300;

-- 여러 행: 컴퓨터학과 과목의 학점을 1씩 증가 (C123, C312, C324, C413의 4행)
UPDATE COURSE SET Credit = Credit + 1 WHERE Dept = '컴퓨터';

-- 부속 질의를 조건에: 컴퓨터학과 학생(100, 300, 400)의 기말성적을 5점씩 올린다 (9행)
UPDATE ENROL SET Final = Final + 5
WHERE  Sno IN (SELECT Sno FROM STUDENT WHERE Dept = '컴퓨터');

-- 부속 질의를 값에: 4학년의 학과를 데이터베이스 과목을 개설한 학과로
UPDATE STUDENT
SET    Dept = (SELECT Dept FROM COURSE WHERE Cname = '데이터베이스')
WHERE  Year = 4;
```

마지막 질의의 부속 질의는 '컴퓨터' 한 행을 반환하므로, 4학년인 100과 400의 Dept가 '컴퓨터'로 갱신된다. 두 학생은 이미 컴퓨터학과라 값은 바뀌지 않는다. ==WHERE 절을 생략한 UPDATE는 테이블의 모든 행을 갱신한다.==

### DELETE

```sql
DELETE FROM 테이블 [WHERE 조건];
```

```sql
-- 한 행: 학번 100 학생 삭제
DELETE FROM STUDENT WHERE Sno = 100;

-- 모든 행: ENROL의 등록 행 전부 삭제
DELETE FROM ENROL;

-- 부속 질의를 조건에: 컴퓨터학과 학생의 C413 기말성적이 60점 미만인 등록 행 삭제
DELETE FROM ENROL
WHERE  Cno = 'C413' AND Final < 60
  AND  ENROL.Sno IN (SELECT Sno FROM STUDENT WHERE Dept = '컴퓨터');
```

STUDENT에서 행을 삭제하면 그 학생을 참조하는 ENROL 행 때문에 참조 무결성 문제가 생길 수 있다. 위 ENROL 정의처럼 `ON DELETE CASCADE`면 학번 100의 등록 행 (100, C413)과 (100, E412)도 함께 삭제되고, 옵션이 없으면(NO ACTION) 삭제가 거부된다. 마지막 질의는 C413의 기말성적이 95, 90, 85라 삭제되는 행이 없다.

==WHERE 절을 생략하면 테이블의 모든 행이 삭제되지만 테이블 정의는 남는다.== 테이블 자체를 제거하는 것은 `DROP TABLE`이다. Oracle은 `DELETE ENROL;`처럼 `FROM`을 생략해도 된다.

## 연습문제 풀이

<details>
<summary>1. SQL 테이블과 릴레이션의 차이</summary>

> SQL에서 정의되는 테이블과 관계 데이터 모델에서 정의된 릴레이션의 차이점을 설명하라.

릴레이션은 추상적 개념이고 테이블은 릴레이션을 기술하는 구체적 표현이다. 차이는 [SQL 테이블과 릴레이션의 차이](#sql-테이블과-릴레이션의-차이) 절에서 다룬 중복 행 허용이 핵심이고, 순서와 키까지 비교하면 다음과 같다.

| 항목      | 릴레이션                       | SQL 테이블                                        |
| --------- | ------------------------------ | ------------------------------------------------- |
| 원소      | 튜플의 집합, 중복 튜플 없음    | 행의 다중 집합(bag), 중복 행 허용                 |
| 키        | 모든 릴레이션에 기본 키가 있다 | 기본 키 없이 정의할 수 있다                       |
| 튜플 순서 | 없다                           | 정해져 있지 않고 `ORDER BY`로 지정한다            |
| 열 순서   | 애트리뷰트 집합이라 순서 없음  | 정의한 순서가 있어 `SELECT *`와 `INSERT`가 따른다 |
| 집합 결과 | 연산 결과도 항상 집합          | `DISTINCT`를 명세해야 중복이 제거된다             |

</details>

<details>
<summary>5. 학생·과목·등록 질의를 SQL로 표현</summary>

> 학생(학번, 이름, 학년), 과목(과목번호, 과목이름, 교수), 등록(과목번호, 학번, 점수) 릴레이션에서 다음 질의문을 SQL로 표현하라.

#### (1) 과목 'DBMS'를 수강한 4학년 학생의 이름

```sql
-- 부속 질의를 두 번 중첩
SELECT 학생.이름
FROM   학생
WHERE  학생.학년 = 4
  AND  학생.학번 IN (SELECT 등록.학번 FROM 등록
                     WHERE 등록.과목번호 IN (SELECT 과목.과목번호 FROM 과목
                                             WHERE 과목.과목이름 = 'DBMS'));

-- 같은 질의를 조인으로
SELECT DISTINCT 학생.학번, 학생.이름
FROM   학생 JOIN 등록 ON 학생.학번 = 등록.학번
            JOIN 과목 ON 등록.과목번호 = 과목.과목번호
WHERE  학생.학년 = 4 AND 과목.과목이름 = 'DBMS';
```

과제를 제출한 시각에는 안쪽 부속 질의를 `등록.과목번호 = (SELECT …)`로 썼다. ==`=` 뒤의 부속 질의는 결과가 한 행일 때만 쓸 수 있다.== 과목이름은 키가 아니라 'DBMS'인 과목이 둘이면 실행 오류가 나므로 `IN`으로 고쳤다. 조인으로 쓰면 한 학생이 'DBMS' 과목을 둘 수강했을 때 이름이 두 번 나오므로 `DISTINCT`를 붙이고, 동명이인을 하나로 합치지 않도록 학번도 함께 출력했다.

#### (2) 'DBMS' 과목 삭제

```sql
DELETE FROM 과목 WHERE 과목이름 = 'DBMS';
```

등록이 과목번호로 과목을 참조하는 외래 키를 가지면, 외래 키의 `ON DELETE` 옵션에 따라 DBMS 과목의 등록 행이 함께 삭제되거나(CASCADE) 삭제 자체가 거부된다(NO ACTION).

#### (3) 'AI' 과목 삽입 (과목번호 'C419')

```sql
INSERT INTO 과목 (과목번호, 과목이름) VALUES ('C419', 'AI');
```

열 이름 리스트에서 빠진 교수는 NULL이 된다. 교수 열이 NOT NULL이면 이 삽입은 거부되므로 교수 값도 함께 넣어야 한다.

#### (4) 학번 12345 학생의 학년을 4로 변경

```sql
UPDATE 학생 SET 학년 = 4 WHERE 학번 = 12345;
```

학번을 문자 타입으로 정의했다면 `학번 = '12345'`로 쓴다.

</details>

<details>
<summary>6. 납품 데이터베이스 질의를 SQL로 표현</summary>

> S(Sno, Sname, Status, City), P(Pno, Pname, Colour, Weight), SP(Sno, Pno, Qty)에서 다음 질의문을 SQL로 표현하라.

[관계 대수 글](/memo/db-relational-algebra)에서 관계 대수식으로 쓴 질의를 SQL로 바꿨다. 관계 대수에서 SP를 거쳐야 했던 것처럼 SQL에서도 S와 P는 SP로 조인한다.

```sql
-- (1) 모든 납품업자의 Sname과 City
SELECT Sname, City FROM S;

-- (2) Pno가 123인 제품을 발송한 납품업자의 Sname
SELECT S.Sname FROM S JOIN SP ON S.Sno = SP.Sno WHERE SP.Pno = 123;

-- (3) 색이 red인 제품의 Pname
SELECT Pname FROM P WHERE Colour = 'red';

-- (4) 이름이 Nut인 제품을 발송한 납품업자의 Sname
SELECT DISTINCT S.Sno, S.Sname
FROM   S JOIN SP ON S.Sno = SP.Sno
         JOIN P  ON SP.Pno = P.Pno
WHERE  P.Pname = 'Nut';
```

과제를 제출한 시각에는 (1)을 `SELECT Sname City FROM S`로 썼다. 쉼표가 빠지면 City가 Sname 열의 별칭이 되어, City 열 대신 Sname 값을 City라는 이름으로 출력한다. (4)는 Pname이 키가 아니라 Nut 제품이 여럿이면 같은 납품업자가 여러 번 나오므로 `DISTINCT`를 붙였다. (2)는 SP의 기본 키가 {Sno, Pno}라 Pno = 123인 발송 행이 납품업자마다 하나뿐이어서 중복이 생기지 않는다.

</details>

<details>
<summary>실습 1. 예제 테이블을 DDL로 정의</summary>

> 학생(STUDENT), 과목(COURSE), 등록(ENROL) 테이블을 CREATE TABLE 문으로 정의하라.

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

과제를 제출한 시각의 답에는 다음 오류가 있었다.

| 제출한 답                     | 문제                                                  | 고친 내용                |
| ----------------------------- | ----------------------------------------------------- | ------------------------ |
| `FOREGIN KEY`                 | 키워드 오타로 문법 오류                               | `FOREIGN KEY`            |
| ENROL의 `Sno INT NOT NULL` 뒤 | 쉼표가 빠져 다음 열 정의와 붙는다                     | 쉼표 추가                |
| `Midterm ≥ 0`, `Final ≤ 100`  | `≥`·`≤`는 SQL 연산자가 아니다                         | `>=`, `<=`               |
| `Sname CHAR`, `Dept CHAR` 등  | 길이를 생략하면 `CHAR(1)`이라 '컴퓨터'를 넣을 수 없다 | `CHAR(10)`처럼 길이 명시 |
| 이름 없는 PRIMARY KEY·CHECK   | 오류는 아니지만 이름으로 제약조건을 삭제할 수 없다    | `CONSTRAINT 이름` 추가   |

제약조건에 이름을 붙여 두면 `ALTER TABLE ENROL DROP CONSTRAINT ENROL_SCORE`처럼 이름으로 제거할 수 있다. 위 정의는 표준 SQL이고, [Oracle의 DDL](#oracle의-ddl) 절의 규칙대로 Oracle에서 실행하려면 가변 길이 문자열을 VARCHAR2로, 정수를 NUMBER로 바꾸고 Oracle이 지원하지 않는 `ON UPDATE CASCADE`를 뺀다.

```sql
-- Oracle 버전의 ENROL (STUDENT·COURSE도 같은 방식으로 바꾼다)
CREATE TABLE ENROL
  (Sno     NUMBER(3)  NOT NULL,
   Cno     CHAR(4)    NOT NULL,
   Grade   CHAR(1),
   Midterm NUMBER(3),
   Final   NUMBER(3),
   CONSTRAINT ENROL_PK    PRIMARY KEY (Sno, Cno),
   CONSTRAINT ENROL_FK1   FOREIGN KEY (Sno) REFERENCES STUDENT(Sno) ON DELETE CASCADE,
   CONSTRAINT ENROL_FK2   FOREIGN KEY (Cno) REFERENCES COURSE(Cno)  ON DELETE CASCADE,
   CONSTRAINT ENROL_SCORE CHECK (Midterm BETWEEN 0 AND 100 AND Final BETWEEN 0 AND 100));
```

</details>

<details>
<summary>실습 2. 검색문 15개의 결과</summary>

> 본문의 검색문 15개를 예제 데이터에 적용한 결과를 구하라.

| 번호 | 검색문                      | 결과                                                               |
| ---- | --------------------------- | ------------------------------------------------------------------ |
| 1    | `DISTINCT Dept`             | 컴퓨터, 전기, 산공                                                 |
| 2    | `SELECT *`                  | STUDENT 5행 전체                                                   |
| 3    | 컴퓨터학과 4학년            | (100, 나수영), (400, 송병길)                                       |
| 4    | 중간성적 90 이상 정렬       | 400 C312, 400 C324, 300 C312, 300 C413, 100 C413, 100 E412         |
| 5    | C312 중간성적 + 3           | 300 93, 400 93, 500 88                                             |
| 6    | C413 등록 학생 조인         | 나수영 컴퓨터 A, 정기태 컴퓨터 A, 송병길 컴퓨터 B                  |
| 7    | 같은 학과 학번 쌍           | (100, 300), (100, 400), (300, 400)                                 |
| 8    | `COUNT(*)`                  | 5                                                                  |
| 9    | 과목별 기말평균             | C123 80, C312 90, C324 82.5, C413 90, E412 85                      |
| 10   | 수강생 3명 이상 과목의 평균 | C312 90, C413 90                                                   |
| 11   | C413 등록 학생 (`IN`)       | 나수영, 정기태, 송병길                                             |
| 12   | `Cno LIKE 'C%'`             | C123 프로그래밍, C312 자료 구조, C324 파일 구조, C413 데이터베이스 |
| 13   | `Dept IS NULL`              | 공집합 (교재 가정으로는 600 김길동)                                |
| 14   | C413 등록 학생 (`EXISTS`)   | 나수영, 정기태, 송병길                                             |
| 15   | 3학년 `UNION` C324 등록     | 200, 300, 400                                                      |

과제를 제출한 시각에는 9번에서 C324의 기말평균을 82로 적었다. (75 + 90) / 2 = 82.5이고, Oracle도 82.5를 반환한다. 정수로 버리는 DBMS가 있다는 점은 [집계 함수](#집계-함수-group-by-having) 절에서 다뤘다. 13번의 600 김길동은 교재가 Dept가 NULL인 학생 (600, 김길동)을 STUDENT에 추가했다고 가정한 결과다. 위 예제 데이터 5행에는 학과가 NULL인 학생이 없어 결과는 공집합이다. 제출한 SQL에 있던 `COUND`, `SELCET` 오타는 각각 `COUNT`, `SELECT`로 읽었다.

</details>

## 정리

- SQL은 DDL·DML·DCL을 모두 제공하는 비절차적 표준 언어이며, 결과가 다시 테이블인 폐쇄 시스템이다.
- 외래 키의 `ON DELETE`·`ON UPDATE` 옵션으로 참조 무결성을 지키는 방법(거부, 널, 기본값, 연쇄)을 정한다. Oracle은 `ON UPDATE`를 지원하지 않는다.
- Oracle은 VARCHAR2·NUMBER·DATE 타입을 쓰고, 이름을 붙인 제약조건을 `ALTER TABLE … DROP/ADD CONSTRAINT`로 관리한다.
- SQL 테이블은 중복 행을 허용하는 다중 집합이라, 집합 결과가 필요하면 `DISTINCT`를 쓴다.
- NULL 비교는 미정이 되므로 `IS NULL`로 검사한다.

## 관련 글

- [관계 대수의 연산자와 폐쇄 성질](/memo/db-relational-algebra): SQL의 이론적 기초인 관계 대수
- [SQL 뷰의 갱신 가능 조건과 삽입 SQL의 커서](/memo/db-sql-view-cursor): 6장 뒷부분을 다룬 다음 글

#데이터베이스 #SQL #CS
