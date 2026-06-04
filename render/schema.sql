-- ============================================================
-- LOAN 데모 데이터셋 — DB 층 (Render 에이전트 fixture)
-- ------------------------------------------------------------
-- DB 신호는 '형태(form)'만 제공한다.
-- 의도적으로 컬럼 코멘트를 넣지 않았다 — 의미는 DB 밖(Code/Catalog)에 있다.
-- 샘플 데이터도 넣지 않았다 — 'DB = 스키마'라는 소스 역할을 깨끗이 유지하기 위함.
-- ============================================================

-- FK 대상 테이블을 먼저 생성
-- 고객 기본 정보 (CUSTOMER 도메인)
CREATE TABLE CUST_BASE_INFO (
    CUST_NO         VARCHAR(15)     NOT NULL,
    CUST_NM         VARCHAR(50)     NOT NULL,
    CUST_EMAIL      VARCHAR(100),
    CUST_TEL_NO     VARCHAR(20),
    BIRTH_DT        DATE,
    ADDR            VARCHAR(200),
    ZIP_CD          CHAR(5),
    JOIN_DT         DATE            NOT NULL,
    CREATED_AT      TIMESTAMP       NOT NULL,
    CONSTRAINT PK_CUST_BASE_INFO PRIMARY KEY (CUST_NO)
);

-- 대출 신청 이력 (LOAN 도메인)
CREATE TABLE LOAN_APPL_HIST (
    LOAN_APPL_NO    VARCHAR(20)     NOT NULL,
    CUST_NO         VARCHAR(15)     NOT NULL,
    LOAN_APPL_DT    DATE            NOT NULL,
    LOAN_AMT        DECIMAL(15,2)   NOT NULL,
    LOAN_TERM_MNTH  SMALLINT        NOT NULL,
    INT_RATE        DECIMAL(5,3)    NOT NULL,
    LOAN_STAT_CD    CHAR(2)         NOT NULL,
    TAX_EXMP_FLG    CHAR(1)         NOT NULL,
    CRDT_GRD_CD     CHAR(1)         NOT NULL,
    PRDT_CD         VARCHAR(4)      NOT NULL,
    BNS_CD          CHAR(1)         NOT NULL,
    RPYMT_MTHD_CD   CHAR(2)         NOT NULL,
    DSBR_DT         DATE,
    CREATED_AT      TIMESTAMP       NOT NULL,
    UPDATED_BY      VARCHAR(30),
    CONSTRAINT PK_LOAN_APPL_HIST PRIMARY KEY (LOAN_APPL_NO),
    CONSTRAINT FK_LOAN_APPL_CUST FOREIGN KEY (CUST_NO)
        REFERENCES CUST_BASE_INFO (CUST_NO)
);
