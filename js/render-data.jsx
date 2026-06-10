// ============================================================
// Render fixture + 신호 함수 + 프롬프트 — 로직 동결, 표현만 분리.
// 원본 render_harness.jsx에서 그대로 옮김. window.RenderData 로 노출.
// ============================================================

// ---- DB 층 (schema.sql에서 파싱한 형태) ----
const RENDER_COLUMNS = [
  // LOAN_APPL_HIST (LOAN)
  { t: "LOAN_APPL_HIST", n: "LOAN_APPL_NO", type: "VARCHAR(20)", notNull: true, pk: true },
  { t: "LOAN_APPL_HIST", n: "CUST_NO", type: "VARCHAR(15)", notNull: true, fk: "CUST_BASE_INFO.CUST_NO" },
  { t: "LOAN_APPL_HIST", n: "LOAN_APPL_DT", type: "DATE", notNull: true },
  { t: "LOAN_APPL_HIST", n: "LOAN_AMT", type: "DECIMAL(15,2)", notNull: true },
  { t: "LOAN_APPL_HIST", n: "LOAN_TERM_MNTH", type: "SMALLINT", notNull: true },
  { t: "LOAN_APPL_HIST", n: "INT_RATE", type: "DECIMAL(5,3)", notNull: true },
  { t: "LOAN_APPL_HIST", n: "LOAN_STAT_CD", type: "CHAR(2)", notNull: true },
  { t: "LOAN_APPL_HIST", n: "TAX_EXMP_FLG", type: "CHAR(1)", notNull: true },
  { t: "LOAN_APPL_HIST", n: "CRDT_GRD_CD", type: "CHAR(1)", notNull: true },
  { t: "LOAN_APPL_HIST", n: "PRDT_CD", type: "VARCHAR(4)", notNull: true },
  { t: "LOAN_APPL_HIST", n: "BNS_CD", type: "CHAR(1)", notNull: true },
  { t: "LOAN_APPL_HIST", n: "RPYMT_MTHD_CD", type: "CHAR(2)", notNull: true },
  { t: "LOAN_APPL_HIST", n: "DSBR_DT", type: "DATE", notNull: false },
  { t: "LOAN_APPL_HIST", n: "CREATED_AT", type: "TIMESTAMP", notNull: true },
  { t: "LOAN_APPL_HIST", n: "UPDATED_BY", type: "VARCHAR(30)", notNull: false },
  // CUST_BASE_INFO (CUSTOMER)
  { t: "CUST_BASE_INFO", n: "CUST_NO", type: "VARCHAR(15)", notNull: true, pk: true },
  { t: "CUST_BASE_INFO", n: "CUST_NM", type: "VARCHAR(50)", notNull: true },
  { t: "CUST_BASE_INFO", n: "CUST_EMAIL", type: "VARCHAR(100)", notNull: false },
  { t: "CUST_BASE_INFO", n: "CUST_TEL_NO", type: "VARCHAR(20)", notNull: false },
  { t: "CUST_BASE_INFO", n: "BIRTH_DT", type: "DATE", notNull: false },
  { t: "CUST_BASE_INFO", n: "ADDR", type: "VARCHAR(200)", notNull: false },
  { t: "CUST_BASE_INFO", n: "ZIP_CD", type: "CHAR(5)", notNull: false },
  { t: "CUST_BASE_INFO", n: "JOIN_DT", type: "DATE", notNull: true },
  { t: "CUST_BASE_INFO", n: "CREATED_AT", type: "TIMESTAMP", notNull: true },
];

const rkey = (c) => `${c.t}.${c.n}`;
const renderTableDomain = (t) => (t === "CUST_BASE_INFO" ? "CUSTOMER" : "LOAN");

// ---- Catalog 층 (catalog.json) ----
const RENDER_CATALOG = {
  "LOAN_APPL_HIST.TAX_EXMP_FLG": { domain: "LOAN", term: { name: "세금면제", def: "대출 신청 건에 적용되는 세금 면제 상태", values: null } },
  "LOAN_APPL_HIST.LOAN_STAT_CD": { domain: "LOAN", term: { name: "대출상태", def: "대출 신청 건의 현재 처리 상태", values: { "01": "접수", "02": "심사중", "03": "승인", "04": "거절" } } },
  "LOAN_APPL_HIST.CRDT_GRD_CD": { domain: "LOAN", term: { name: "신용등급", def: "고객의 신용도를 나타내는 등급", values: null } },
};

// ---- Code 층 (code/*.java에서 추출되는 스니펫) ----
const RENDER_CODE = {
  "LOAN_APPL_HIST.LOAN_APPL_NO": `// LoanApplication.java\n@Id @Column(name="LOAN_APPL_NO")\nprivate String loanApplicationNo;`,
  "LOAN_APPL_HIST.CUST_NO": `// LoanApplication.java\n@Column(name="CUST_NO")\nprivate String customerNo;`,
  "LOAN_APPL_HIST.LOAN_APPL_DT": `// LoanApplication.java\n@Column(name="LOAN_APPL_DT")\nprivate LocalDate applicationDate;`,
  "LOAN_APPL_HIST.LOAN_AMT": `// LoanApplication.java\n@Column(name="LOAN_AMT")\nprivate BigDecimal loanAmount;`,
  "LOAN_APPL_HIST.LOAN_TERM_MNTH": `// LoanApplication.java\n@Column(name="LOAN_TERM_MNTH")\nprivate Short loanTermMonths;`,
  "LOAN_APPL_HIST.INT_RATE": `// LoanApplication.java\n@Column(name="INT_RATE")\nprivate BigDecimal interestRate;`,
  "LOAN_APPL_HIST.LOAN_STAT_CD": `// LoanApplication.java\n@Column(name="LOAN_STAT_CD")\nprivate String loanStatusCode;`,
  "LOAN_APPL_HIST.TAX_EXMP_FLG": `// LoanApplication.java\n@Column(name="TAX_EXMP_FLG")\n@Enumerated(EnumType.STRING)\nprivate TaxExemption taxExemption;\n\n// TaxExemption.java\npublic enum TaxExemption {\n    Y("면세"), N("과세"), P("부분면세"), X("해당없음");\n}`,
  "LOAN_APPL_HIST.CRDT_GRD_CD": `// LoanApplication.java\n@Column(name="CRDT_GRD_CD")\nprivate String creditGradeCode;`,
  "LOAN_APPL_HIST.RPYMT_MTHD_CD": `// LoanApplication.java\n@Column(name="RPYMT_MTHD_CD")\nprivate String repaymentMethodCode;`,
  "LOAN_APPL_HIST.PRDT_CD": `// LoanApplication.java\n@Column(name="PRDT_CD")\n@Enumerated(EnumType.STRING)\nprivate ProductCode productCode;\n\n// ProductCode.java\npublic enum ProductCode {\n    L01("직장인 신용대출"), M30("주택담보대출 30년 고정"),\n    K7("청년 전월세보증금 대출"), P10("정책서민금융 대출");\n}`,
  "LOAN_APPL_HIST.BNS_CD": `// LoanApplication.java\n@Column(name="BNS_CD")\n@Enumerated(EnumType.STRING)\nprivate BancassuranceConsent bancassuranceConsent;\n\n// BancassuranceConsent.java\npublic enum BancassuranceConsent {\n    Y("방카슈랑스 권유 동의"), N("권유 비동의"), X("권유 대상 아님");\n}`,
  "CUST_BASE_INFO.CUST_NO": `// Customer.java\n@Id @Column(name="CUST_NO")\nprivate String customerNo;`,
  "CUST_BASE_INFO.CUST_NM": `// Customer.java\n@PersonalInfo\n@Column(name="CUST_NM")\nprivate String customerName;\n\n// PersonalInfo.java\n/** 개인정보(PII) 필드를 마킹하는 어노테이션 */\n@interface PersonalInfo {}`,
  "CUST_BASE_INFO.CUST_EMAIL": `// Customer.java\n@PersonalInfo\n@Column(name="CUST_EMAIL")\nprivate String customerEmail;\n\n// PersonalInfo.java\n/** 개인정보(PII) 필드를 마킹하는 어노테이션 */\n@interface PersonalInfo {}`,
  "CUST_BASE_INFO.CUST_TEL_NO": `// Customer.java\n@PersonalInfo\n@Column(name="CUST_TEL_NO")\nprivate String customerTelNo;`,
  "CUST_BASE_INFO.BIRTH_DT": `// Customer.java\n@PersonalInfo\n@Column(name="BIRTH_DT")\nprivate LocalDate birthDate;`,
  "CUST_BASE_INFO.ADDR": `// Customer.java\n@PersonalInfo\n@Column(name="ADDR")\nprivate String address;`,
  "CUST_BASE_INFO.ZIP_CD": `// Customer.java\n@Column(name="ZIP_CD")\nprivate String zipCode;`,
  "CUST_BASE_INFO.JOIN_DT": `// Customer.java\n@Column(name="JOIN_DT")\nprivate LocalDate joinDate;`,
};

// ---- 소스별 신호 텍스트 ----
function renderDbSignal(c) {
  const cons = [c.notNull ? "NOT NULL" : "NULL 허용", c.pk ? "PK" : "", c.fk ? `FK → ${c.fk}` : ""].filter(Boolean).join(", ");
  return `테이블: ${c.t}\n컬럼: ${c.n}\n타입: ${c.type}\n제약: ${cons}`;
}
function renderCatalogSignal(c) {
  const k = rkey(c);
  const entry = RENDER_CATALOG[k];
  const domain = entry ? entry.domain : renderTableDomain(c.t);
  // 빈 항목은 '정보 부재'로 중립 표기 — "없음"을 "= 아님"(부정 증거)으로 읽지 못하게.
  const head = entry ? "" : "이 컬럼에 대한 카탈로그 항목 없음 — 아래는 도메인 추정뿐.\n";
  let s = `${head}도메인: ${domain}\n분류(Classification): 카탈로그에 항목 없음(정보 부재)\n기존 Description: 카탈로그에 등록된 Description 없음(정보 부재)`;
  if (entry && entry.term) {
    s += `\n연결된 Glossary Term: "${entry.term.name}"\n  정의: ${entry.term.def}\n  허용값: ${entry.term.values ? JSON.stringify(entry.term.values) : "용어집에 정의되어 있지 않음"}`;
  } else {
    s += `\n연결된 Glossary Term: 카탈로그에 매핑 없음(정보 부재)`;
  }
  return s;
}
function renderCodeSignal(c) {
  return RENDER_CODE[rkey(c)] || "이 컬럼과 관련된 코드 신호 없음";
}

// ---- 모델 호출 시스템 프롬프트 ----
const RENDER_SYSTEM = `너는 "Render"라는 데이터 카탈로그 증강 에이전트다. 단 하나의 DB 컬럼에 대해 비즈니스 Description을 작성한다.

너는 에이전틱하게 동작한다. 매 단계에서, 지금까지 확보한 신호가 "확신 있고 정확한 설명"을 쓰기에 충분한지 스스로 판단한다.

[설명이 담는 주장 — 해당하는 것만 진술]
- 정체: 이름·타입·제약(PK/FK/도메인)이 개념을 분명히 고정하면(날짜·금액·식별자·FK·자유텍스트) 그 자체로 근거가 선다.
- 값 의미: 이름으로는 추정만 가능. 근거는 권위 있는 소스(catalog 허용값, code enum)가 실제 값을 제공할 때만 선다.
- 분류(PII 등): 근거는 분류를 명시하는 소스(catalog 분류, code 어노테이션)가 있을 때만 선다. 통상·관례는 추정이지 근거가 아니다.

[근거 vs 추정 — 핵심]
- 근거 없는 특정값/분류를 사실처럼 단정하지 마라. 추정이면 설명 안에서 한정하라(예: "…로 추정", "값 코드 미확인", "통상 PII로 취급되나 분류 소스 미확인").
- 소스가 어떤 항목을 비워서 돌려준 것은 그 소스가 그 정보를 '관리하지 않음'이며, 증거의 부재이지 부정의 증거가 아니다. 그것으로 신뢰도를 낮추지 마라.
- 신뢰도는 입수한 증거에만 달려 있다. 어떤 소스가 연결/조회됐는지는 신뢰도를 바꾸지 않는다. 같은 컬럼은 같은 입수 증거에 대해 같은 신뢰도를 가진다.
- (참고) 이름·타입이 명확한 컬럼(날짜·금액·식별자·이름·우편번호)은 DB만으로 정체 근거가 선다.

[행동]
- 불충분하면, [아직 가져올 수 있는 소스] 목록에서 하나만 골라 need_source로 요청한다. 목록에 없는 소스는 요청하지 않는다(요청해도 무시됨).
- 어느 것부터 볼지는 "지금 무엇이 부족한가"로 정한다: 코드값의 의미·enum 정의가 필요하면 code, 도메인·용어·분류(PII 등)·기존 정의가 필요하면 catalog가 답을 가질 가능성이 높다. 단 반드시 가용 목록 안에서 고른다. 목록에 하나뿐이면 그것을 요청한다.
- 한 번에 하나씩 가져오고, 받은 뒤 다시 충분한지 판단한다. 여전히 부족하고 남은 가용 소스가 있으면 그 다음 것을 요청한다.
- 가져올 수 있는 소스가 없으면(목록 비었음) 반드시 최종 생성한다. 가용 정보로 최선의 설명을 쓰고, 불확실하면 confidence를 낮춘다. 이때 description은 반드시 채운다 — sufficient와 무관하게 null·빈 값·생성 거부 금지. 정체조차 불확실하면 "…로 추정되나 확인 불가"처럼 정직한 최소 설명을 쓰고 LOW로 둔다.

[Confidence] — '쓰여진 설명'의 신뢰도
- HIGH: 단정한 모든 주장이 근거 있음(또는 추정을 정직히 한정해 문장이 신뢰 가능). 자동 반영 가능.
- MEDIUM: 정체는 서지만 값/분류 일부가 추정에 의존.
- LOW: 정체부터 불확실하거나 근거가 거의 없는 추정.

반드시 아래 JSON 객체 하나만 출력한다. 마크다운/코드펜스/설명 텍스트 금지.
{"thinking":"왜 충분/불충분인지 한국어 1~2문장","sufficient":true|false,"need_source":"catalog"|"code"|null,"description":"최종일 때 비즈니스 설명 한 문장, 아니면 null","confidence":"HIGH"|"MEDIUM"|"LOW"|null}`;

function renderUserPrompt(c, gathered, available) {
  const parts = [`[대상 컬럼] ${rkey(c)}`, ``, `[지금까지 확보한 신호]`];
  parts.push(`■ DB\n${gathered.db}`);
  if (gathered.catalog) parts.push(`■ Catalog\n${gathered.catalog}`);
  if (gathered.code) parts.push(`■ Code\n${gathered.code}`);
  parts.push(``, `[아직 가져올 수 있는 소스] ${available.length ? available.join(", ") : "없음 — 지금 반드시 최종 생성하라"}`, ``, `판단해서 JSON 하나로 답하라.`);
  return parts.join("\n");
}

// ---- 정적 소스 원문 (홈 화면 '준비된 자료' 조회용) ----
const RENDER_SCHEMA_SQL = `-- LOAN 데모 데이터셋 — DB 층 (Render 에이전트 fixture)
-- DB 신호는 '형태(form)'만 제공한다.
-- 의도적으로 컬럼 코멘트를 넣지 않았다 — 의미는 DB 밖(Code/Catalog)에 있다.

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
);`;

// 홈에서 보여줄 코드 소스 원문 파일들
const RENDER_CODE_FILES = [
  { file: "LoanApplication.java", body: `@Entity @Table(name = "LOAN_APPL_HIST")\npublic class LoanApplication {\n    @Id @Column(name = "LOAN_APPL_NO")\n    private String loanApplicationNo;\n    @Column(name = "LOAN_AMT")\n    private BigDecimal loanAmount;\n    @Column(name = "TAX_EXMP_FLG")\n    @Enumerated(EnumType.STRING)\n    private TaxExemption taxExemption;\n    @Column(name = "PRDT_CD")\n    @Enumerated(EnumType.STRING)\n    private ProductCode productCode;\n    @Column(name = "BNS_CD")\n    @Enumerated(EnumType.STRING)\n    private BancassuranceConsent bancassuranceConsent;\n    @Column(name = "RPYMT_MTHD_CD")\n    private String repaymentMethodCode;\n    // ...\n}` },
  { file: "TaxExemption.java", body: `public enum TaxExemption {\n    Y("면세"),\n    N("과세"),\n    P("부분면세"),\n    X("해당없음");\n}` },
  { file: "ProductCode.java", body: `public enum ProductCode {\n    L01("직장인 신용대출"),\n    M30("주택담보대출 30년 고정"),\n    K7("청년 전월세보증금 대출"),\n    P10("정책서민금융 대출");\n}` },
  { file: "BancassuranceConsent.java", body: `public enum BancassuranceConsent {\n    Y("방카슈랑스 권유 동의"),\n    N("권유 비동의"),\n    X("권유 대상 아님");\n}` },
  { file: "Customer.java", body: `@Entity @Table(name = "CUST_BASE_INFO")\npublic class Customer {\n    @Id @Column(name = "CUST_NO")\n    private String customerNo;\n    @PersonalInfo @Column(name = "CUST_EMAIL")\n    private String customerEmail;\n    @PersonalInfo @Column(name = "BIRTH_DT")\n    private LocalDate birthDate;\n    @Column(name = "ZIP_CD")\n    private String zipCode;\n    // ...\n}` },
  { file: "PersonalInfo.java", body: `/**\n * 개인정보(PII) 필드를 명시적으로 마킹하는 어노테이션.\n * 데이터 분류·마스킹·접근 통제 파이프라인이 이 마킹을 근거로 동작한다.\n */\n@Target(ElementType.FIELD)\n@Retention(RetentionPolicy.RUNTIME)\npublic @interface PersonalInfo {}` },
];

window.RenderData = {
  COLUMNS: RENDER_COLUMNS,
  CATALOG: RENDER_CATALOG,
  CODE: RENDER_CODE,
  rkey, tableDomain: renderTableDomain,
  dbSignal: renderDbSignal,
  catalogSignal: renderCatalogSignal,
  codeSignal: renderCodeSignal,
  SYSTEM: RENDER_SYSTEM,
  userPrompt: renderUserPrompt,
  SCHEMA_SQL: RENDER_SCHEMA_SQL,
  CODE_FILES: RENDER_CODE_FILES,
};
