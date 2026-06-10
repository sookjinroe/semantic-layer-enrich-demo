// ============================================================
// 홈 · 에이전트 로직 섹션 (1단계) — 두 에이전트의 결정 흐름을 추상화해 보여준다.
// 흐름도(분기)는 정적, 각 분기는 클릭/호버하면 우측에 '실제 컬럼 예시 경로'가 뜬다.
// 로직은 추상화 — 프롬프트 원문이 아니라 개념 수준의 판단 규칙으로 서술.
// window.HomeLogicSection 으로 노출.
// ============================================================
const { useState: hlUseState } = React;

const hl = {
  mono: { fontFamily: "var(--mono)" },
  sans: { fontFamily: "var(--sans)" },
  panel: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 7 },
};

// ---- 예시 경로 데이터 (실제 fixture 기반) ----
// trace step: { k:'DB'|'Catalog'|'Code'|'BI'|'계보'|'판단', label, note? }
const RENDER_EX = {
  db_enough: {
    branch: "충분 — 이름·타입이 곧 의미",
    color: "var(--high)",
    column: "LOAN_APPL_HIST.LOAN_APPL_NO",
    criterion: "이름·타입·제약이 그대로 의미가 되는 컬럼(식별자·날짜·금액·이름 등)은 첫 신호인 DB만으로 멈춘다. 더 캐도 나아질 게 없다.",
    trace: [
      { k: "DB", label: "VARCHAR(20) · NOT NULL · PK", note: "이름과 제약이 식별자임을 그대로 말한다" },
      { k: "판단", label: "충분 — 추가 소스 불필요" },
    ],
    outcome: { conf: "HIGH", text: "대출신청 이력을 고유하게 식별하는 기본키 번호." },
  },
  catalog_enough: {
    branch: "불충분 → Catalog에서 해소",
    color: "var(--high)",
    column: "LOAN_APPL_HIST.LOAN_STAT_CD",
    criterion: "코드성 컬럼(_CD·_FLG)은 '값이 무엇을 뜻하는지'까지 확인돼야 멈춘다. 용어집(Catalog)에 허용값이 정의돼 있으면 거기서 충분해진다.",
    trace: [
      { k: "DB", label: "CHAR(2) 코드값", note: "코드 체계를 모르면 설명 불가 → 불충분" },
      { k: "Catalog", label: "용어 '대출상태' · 허용값 {01 접수, 02 심사중, 03 승인, 04 거절}", note: "값 의미 확보" },
      { k: "판단", label: "충분 — 값 체계 확정" },
    ],
    outcome: { conf: "HIGH", text: "대출 신청 건의 처리 상태 코드(접수·심사중·승인·거절)." },
  },
  code_escalate: {
    branch: "Catalog도 부족 → Code까지",
    color: "var(--high)",
    column: "LOAN_APPL_HIST.TAX_EXMP_FLG",
    criterion: "용어는 있어도 허용값이 비어 있으면 아직 부족. Code의 Enum 리터럴에서 값 의미를 확정하고서야 멈춘다 — 소스를 한 칸씩 올라간다.",
    trace: [
      { k: "DB", label: "CHAR(1) _FLG 코드값", note: "불충분" },
      { k: "Catalog", label: "용어 '세금면제' · 허용값 미정", note: "여전히 값 의미 없음 → 불충분" },
      { k: "Code", label: "enum TaxExemption { Y 면세, N 과세, P 부분면세, X 해당없음 }", note: "Enum에서 값 의미 확정" },
      { k: "판단", label: "충분" },
    ],
    outcome: { conf: "HIGH", text: "대출 건의 세금 면제 상태(면세·과세·부분면세·해당없음)." },
  },
  pii: {
    branch: "분류(PII)가 핵심 — Code의 근거 필요",
    color: "var(--high)",
    column: "CUST_BASE_INFO.CUST_EMAIL",
    criterion: "PII 같은 '분류'가 설명의 핵심이면 그 근거가 있어야 멈춘다. Code의 @PersonalInfo 어노테이션이 PII를 확정한다 — 추측이 아니라 표식.",
    trace: [
      { k: "DB", label: "VARCHAR(100) · NULL 허용", note: "이메일 형태지만 PII 분류 근거 없음 → 불충분" },
      { k: "Code", label: "@PersonalInfo @Column(CUST_EMAIL)", note: "PII 표식 확정" },
      { k: "판단", label: "충분 — 근거 확보" },
    ],
    outcome: { conf: "HIGH", text: "고객 이메일 주소. 개인정보(PII)로 분류된다." },
  },
  exhausted_low: {
    branch: "소스 소진 — 지어내지 않고 LOW",
    color: "var(--low)",
    column: "LOAN_APPL_HIST.CRDT_GRD_CD",
    criterion: "소스를 끝까지 올라가도 값 체계가 어디에도 없으면, 그럴듯하게 지어내지 않는다. 가능한 최선을 쓰되 LOW로 남겨 사람에게 넘긴다.",
    trace: [
      { k: "DB", label: "CHAR(1) 등급코드", note: "불충분" },
      { k: "Catalog", label: "용어 '신용등급' · 허용값 미정", note: "불충분" },
      { k: "Code", label: "private String creditGradeCode", note: "값 체계 단서 없음" },
      { k: "판단", label: "소스 소진 — 더 올라갈 곳 없음" },
    ],
    outcome: { conf: "LOW", text: "고객 신용등급 코드. 등급 체계(값 의미)는 소스에서 확인되지 않음." },
  },
};

const LINK_EX = {
  match: {
    branch: "기존 Term에 분명히 부합 → 연결",
    color: "var(--high)",
    column: "LOAN_APPL_HIST.CUST_NO",
    criterion: "검증된 Description의 의미가 기존 Term에 분명히 들어맞으면 연결한다. FK 같은 구조 신호가 이를 굳힌다.",
    trace: [
      { k: "판단", label: "후보 검색 → '고객번호'(CUSTOMER) 외 3개" },
      { k: "FK", label: "FK → CUST_BASE_INFO.CUST_NO (고객 마스터 PK)", note: "연결 근거를 굳힘" },
      { k: "판단", label: "match — '고객번호'" },
    ],
    outcome: { conf: "HIGH", text: "기존 Term '고객번호'에 연결." },
  },
  collision: {
    branch: "이름 같아도 도메인·허용값이 다름 → 거부",
    color: "var(--low)",
    column: "LOAN_APPL_HIST.RPYMT_MTHD_CD",
    criterion: "이름이 같다고 매칭하지 않는다. 후보 Term과 도메인·허용값이 어긋나면 '충돌'로 거부하고, 잔여로 넘겨 발견 단계에서 다룬다.",
    trace: [
      { k: "대상", label: "RPYMT_MTHD_CD (LOAN) · \"대출 상환 방식 코드\"", note: "타입 CHAR(2)" },
      { k: "Term상세", label: "후보 '상환방식' — 도메인 CARD · 허용값 {1 일시불, 2 할부, 3 리볼빙}", note: "이름은 같다" },
      { k: "판단", label: "LOAN ≠ CARD · 값 체계도 카드 전용 → 같은 개념 아님" },
      { k: "판단", label: "reject(collision) → 잔여로" },
    ],
    outcome: { conf: "MEDIUM", text: "'상환방식'(CARD)과 이름만 같음 — 대출 도메인의 별개 컴럼. 매칭 거부 후 Discoverer로 이관." },
  },
  need: {
    branch: "확신 부족 → 증거 조회 (Term 상세·FK·사용 중 하나)",
    color: "var(--med)",
    column: "LOAN_APPL_HIST.TAX_EXMP_RSN_CD",
    criterion: "결정이 애매하면 가장 값싼 증거 하나를 요청한다(Term 상세·FK·사용). 단 같은 증거는 한 번만 — 받은 걸로 확정한다.",
    trace: [
      { k: "판단", label: "후보 '세금면제'에 부합하나 범위 확신 부족" },
      { k: "Term상세", label: "need: term_detail:세금면제 → '면제 여부·사유 포괄'", note: "증거 1회 요청" },
      { k: "판단", label: "match — '세금면제'" },
    ],
    outcome: { conf: "HIGH", text: "증거 확인 후 '세금면제'에 연결." },
  },
  discover_junk: {
    branch: "라벨이 무의미해도 관계로 발견",
    color: "var(--med)",
    column: "담보 군집 (CLTRL_TYPE_CD + CLTRL_VAL_AMT)",
    criterion: "발견은 이름 유사도가 아니라 '사람이 한 개념으로 다루는가'로 묶는다. BI 라벨이 무의미해도(dim_07·측정값11) 공동참조·계보 같은 관계 신호로 경계를 잡는다.",
    trace: [
      { k: "BI", label: "라벨: dim_07, 측정값11 — 무의미", note: "이름 신호는 버린다" },
      { k: "BI", label: "'담보 현황' 대시보드에서 공동 참조", note: "함께 쓰인다 = 한 개념" },
      { k: "계보", label: "둘 다 COLLATERAL_EVAL_BATCH에서 파생", note: "개념적 친연성" },
      { k: "판단", label: "new_term 제안 — '담보'" },
    ],
    outcome: { conf: "MEDIUM", text: "신규 개념 '담보' 제안 (사람 검토 전제)." },
  },
  technical_skip: {
    branch: "기술 컬럼 — 사전 제외",
    color: "var(--dim)",
    column: "CREATED_AT · UPDATED_BY · RECORD_UUID",
    criterion: "비즈니스 의미가 없는 운영/기술 컬럼은 연결·발견을 시작하기 전에 가장 먼저 걸러낸다. 에이전트를 돌릴 가치가 없는 것에 돌리지 않는다.",
    trace: [
      { k: "판단", label: "이름 패턴 매칭 (감사 타임스탬프 · 작성자 · UUID)" },
      { k: "판단", label: "기술 컬럼으로 분류 → SKIP (Matcher에 안 넘김)" },
    ],
    outcome: { conf: null, text: "연결/발견 대상에서 제외." },
  },
  discover_low: {
    branch: "신호 부재 → 경계 못 그음 (candidate · LOW)",
    color: "var(--low)",
    column: "CUST_BASE_INFO.CUST_CLF_CD",
    criterion: "사용·계보 신호가 없으면 억지로 묶거나 만들지 않는다. 단독 군집으로 둔 채 candidate·LOW로 사람 검토에 넘긴다.",
    trace: [
      { k: "대상", label: "CUST_CLF_CD (CUSTOMER) · \"고객 분류 2자리 코드\"", note: "타입 CHAR(2)" },
      { k: "BI", label: "참조하는 BI 자산 없음", note: "이름 후보도 경계 신호도 없음" },
      { k: "계보", label: "상류·함께 파생된 컬럼 없음", note: "관계 신호 부재" },
      { k: "판단", label: "단독 군집 · 경계 못 그음 → candidate(LOW)" },
    ],
    outcome: { conf: "LOW", text: "신규 개념 후보로만 — 신호 부족으로 경계 미확정, 사람 검토 필요." },
  },
};

const TRACE_TONE = {
  DB: "var(--sig)", Catalog: "var(--sig)", Code: "var(--sig)", BI: "var(--sig)",
  "계보": "var(--lin)", FK: "var(--lin)", "Term상세": "var(--sig)", "판단": "var(--dim)",
  "대상": "var(--muted)",
};

// ---- 메인 ----
function HomeLogicSection() {
  const U = window.UI;
  const SectionHead = window.HomeSectionHead;
  const [agent, setAgent] = hlUseState("render");
  const [rSel, setRSel] = hlUseState("code_escalate");
  const [lSel, setLSel] = hlUseState("match");

  const isR = agent === "render";
  const EX = isR ? RENDER_EX : LINK_EX;
  const sel = isR ? rSel : lSel;
  const setSel = isR ? setRSel : setLSel;
  const ident = isR ? "var(--sig)" : "var(--accent)";

  return (
    <div style={{ paddingTop: 44 }}>
      <SectionHead>에이전트 로직</SectionHead>

      {/* 에이전트 토글 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <AgentTab on={isR} color="var(--sig)" onClick={() => setAgent("render")} title="Render" sub="컬럼 → Description" />
        <AgentTab on={!isR} color="var(--accent)" onClick={() => setAgent("link")} title="Link" sub="연결 · 발견" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)", gap: 18, alignItems: "start" }}>
        {/* 좌: 흐름도 */}
        <div style={{ ...hl.panel, padding: "20px 20px 22px" }}>
          {isR
            ? <RenderFlow sel={sel} setSel={setSel} EX={RENDER_EX} />
            : <LinkFlow sel={sel} setSel={setSel} EX={LINK_EX} />}
        </div>

        {/* 우: 예시 경로 */}
        <DetailPanel U={U} ex={EX[sel]} ident={ident} />
      </div>
    </div>
  );
}

// ---- Render 흐름도 ----
function RenderFlow({ sel, setSel, EX }) {
  return (
    <div>
      <FlowHead color="var(--sig)" title="소스 에스컬레이션 루프" note="DB → Catalog → Code, 한 번에 한 소스" />
      <SpineNode tone="src" title="DB 신호" sub="시드 — 무조건 주어짐 (형태만)" />
      <Conn />
      <SpineNode tone="decide" title="◇ 지금 신호로 충분한가?" sub="이름·타입 명확 / 코드값의 의미 / 분류 근거 / 모호성" />
      <Branches>
        <BranchRow on={sel === "db_enough"} onClick={() => setSel("db_enough")} EX={EX} k="db_enough" />
        <BranchRow on={sel === "catalog_enough"} onClick={() => setSel("catalog_enough")} EX={EX} k="catalog_enough" />
        <BranchRow on={sel === "code_escalate"} onClick={() => setSel("code_escalate")} EX={EX} k="code_escalate" />
        <BranchRow on={sel === "pii"} onClick={() => setSel("pii")} EX={EX} k="pii" />
        <BranchRow on={sel === "exhausted_low"} onClick={() => setSel("exhausted_low")} EX={EX} k="exhausted_low" last />
      </Branches>
      <LoopNote>불충분이고 가져올 소스가 남아 있으면 → <b style={{ color: "var(--sig)" }}>다음 소스 1개 요청</b> 후 다시 충분성 판단으로. 무한정 돌지 않는다 — 상한에서 멈추고 LOW로 남긴다.</LoopNote>
    </div>
  );
}

// ---- Link 흐름도 ----
function LinkFlow({ sel, setSel, EX }) {
  return (
    <div>
      <FlowHead color="var(--accent)" title="연결 → 발견 2막" note="기술 컬럼을 먼저 거르고 → Matcher가 잇고 → 잔여를 Discoverer가 묶는다" />
      <SpineNode tone="pre" title="사전 · 기술 컬럼 필터" sub="감사·운영 컬럼(CREATED_AT·UPDATED_BY·UUID)은 연결·발견 이전에 먼저 제외" />
      <Branches>
        <BranchRow on={sel === "technical_skip"} onClick={() => setSel("technical_skip")} EX={EX} k="technical_skip" last />
      </Branches>
      <Conn />
      <SpineNode tone="decideA" title="1막 · Matcher" sub="후보 검색 → 기존 Term에 연결 판단" />
      <Branches>
        <BranchRow on={sel === "match"} onClick={() => setSel("match")} EX={EX} k="match" />
        <BranchRow on={sel === "need"} onClick={() => setSel("need")} EX={EX} k="need" />
        <BranchRow on={sel === "collision"} onClick={() => setSel("collision")} EX={EX} k="collision" last />
      </Branches>
      <LoopNote>불확실하면 <b style={{ color: "var(--accent)" }}>증거 하나</b>(Term 상세·FK·사용)를 요청 후 다시 판단 — 같은 증거는 1회만. 충돌·미매칭은 <b style={{ color: "var(--text)" }}>잔여</b>로 내려간다.</LoopNote>
      <Conn />
      <SpineNode tone="decideA" title="2막 · Discoverer" sub="잔여를 사용·공동참조·계보로 묶어 새 개념 제안" />
      <Branches>
        <BranchRow on={sel === "discover_junk"} onClick={() => setSel("discover_junk")} EX={EX} k="discover_junk" />
        <BranchRow on={sel === "discover_low"} onClick={() => setSel("discover_low")} EX={EX} k="discover_low" last />
      </Branches>
      <LoopNote>그룹핑은 이름 유사도가 아니라 <b style={{ color: "var(--text)" }}>사용·공동참조·계보</b>로 묶는다. 모든 발견은 <b style={{ color: "var(--text)" }}>제안</b> — 사람 검토를 전제로 신뢰도를 매긴다.</LoopNote>
    </div>
  );
}

// ---- 흐름도 조각 ----
function FlowHead({ color, title, note }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 9, height: 9, borderRadius: 9, background: color }} />
        <span style={{ ...hl.mono, fontSize: 14.5, fontWeight: 600, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{title}</span>
      </div>
      <div style={{ ...hl.sans, fontSize: 12, color: "var(--muted)", marginTop: 4, marginLeft: 18 }}>{note}</div>
    </div>
  );
}

function SpineNode({ tone, title, sub }) {
  const decide = tone === "decide" || tone === "decideA";
  const accent = tone === "decideA" ? "var(--accent)" : tone === "decide" ? "var(--med)" : tone === "pre" ? "var(--dim)" : "var(--sig)";
  return (
    <div style={{
      border: `1px solid ${decide ? accent + "55" : "var(--border)"}`,
      borderLeft: `2px solid ${accent}`,
      borderRadius: 5, padding: "10px 13px",
      background: decide ? accent + "12" : "rgba(0,0,0,0.2)",
    }}>
      <div style={{ ...hl.mono, fontSize: 13, color: "var(--text)" }}>{title}</div>
      {sub && <div style={{ ...hl.sans, fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

function Conn() {
  return <div style={{ width: 2, height: 16, background: "var(--border)", margin: "0 auto" }} />;
}

function Branches({ children }) {
  return <div style={{ marginTop: 10, marginLeft: 10, borderLeft: "1px dashed var(--border)", paddingLeft: 0 }}>{children}</div>;
}

function BranchRow({ on, onClick, EX, k, last }) {
  const [h, setH] = hlUseState(false);
  const ex = EX[k];
  const active = on || h;
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: "flex", alignItems: "stretch", gap: 0, cursor: "pointer", marginBottom: last ? 0 : 7 }}>
      {/* 트리 커넥터 */}
      <div style={{ position: "relative", width: 18, flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 16, left: -1, width: 14, height: 2, background: active ? ex.color : "var(--border)" }} />
      </div>
      {/* 분기 카드 */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", borderRadius: 5,
        border: `1px solid ${active ? ex.color + "88" : "var(--border)"}`,
        background: on ? ex.color + "16" : h ? "rgba(255,255,255,0.03)" : "transparent",
        transition: "border-color .12s, background .12s",
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 7, background: ex.color, flexShrink: 0 }} />
        <span style={{ ...hl.sans, fontSize: 12.5, color: "var(--text)", flex: 1, lineHeight: 1.4 }}>{ex.branch}</span>
        <span style={{ ...hl.mono, fontSize: 11, color: active ? ex.color : "var(--dim)", whiteSpace: "nowrap" }}>{ex.outcome.conf || "SKIP"}</span>
      </div>
    </div>
  );
}

function LoopNote({ children }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12, padding: "9px 12px", borderRadius: 5, background: "rgba(0,0,0,0.22)", border: "1px solid var(--border)" }}>
      <span style={{ ...hl.mono, fontSize: 12, color: "var(--muted)", flexShrink: 0 }}>↻</span>
      <span style={{ ...hl.sans, fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>{children}</span>
    </div>
  );
}

// ---- 우측 예시 경로 패널 ----
function DetailPanel({ U, ex, ident }) {
  return (
    <div style={{ ...hl.panel, overflow: "hidden", position: "sticky", top: 16 }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.2)" }}>
        <div style={{ ...hl.mono, fontSize: 10.5, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 5 }}>예시 경로</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span style={{ ...hl.mono, fontSize: 13.5, color: "var(--text)" }}>{ex.column}</span>
          {ex.outcome.conf ? <U.ConfBadge c={ex.outcome.conf} /> : <U.Tag border="var(--border)">SKIP</U.Tag>}
        </div>
      </div>

      {/* 판단 규칙 (추상) */}
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ ...hl.sans, fontSize: 13, color: "var(--text)", lineHeight: 1.62 }}>{ex.criterion}</div>
      </div>

      {/* 경로 트레이스 */}
      <div style={{ padding: "14px 16px 6px" }}>
        {ex.trace.map((s, i) => <TraceStep key={i} s={s} last={i === ex.trace.length - 1 && !ex.outcome.text} />)}
        {ex.outcome.text && <Outcome U={U} o={ex.outcome} />}
      </div>
    </div>
  );
}

function TraceStep({ s, last }) {
  const c = TRACE_TONE[s.k] || "var(--muted)";
  const decide = s.k === "판단";
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 14 }}>
        <span style={{ width: 9, height: 9, borderRadius: 9, background: decide ? "transparent" : c, border: decide ? `2px solid ${c}` : "none", marginTop: 3 }} />
        {!last && <span style={{ flex: 1, width: 2, background: "var(--border)", marginTop: 3, minHeight: 14 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: 13, minWidth: 0 }}>
        <div style={{ ...hl.mono, fontSize: 10.5, letterSpacing: "0.06em", color: c, textTransform: "uppercase", marginBottom: 2 }}>{s.k}</div>
        <div style={{ ...hl.mono, fontSize: 12, color: "var(--text)", lineHeight: 1.5, wordBreak: "break-word" }}>{s.label}</div>
        {s.note && <div style={{ ...hl.sans, fontSize: 11.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.45 }}>{s.note}</div>}
      </div>
    </div>
  );
}

function Outcome({ U, o }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 14 }}>
        <span style={{ color: o.conf ? U.CONF_COLOR[o.conf] : "var(--dim)", fontSize: 13, lineHeight: "16px", marginTop: 1 }}>✓</span>
      </div>
      <div style={{ flex: 1, paddingBottom: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ ...hl.mono, fontSize: 10.5, letterSpacing: "0.06em", color: "var(--muted)", textTransform: "uppercase" }}>결과</span>
          {o.conf && <U.ConfBadge c={o.conf} />}
        </div>
        <div style={{ ...hl.sans, fontSize: 13, color: "var(--text)", lineHeight: 1.55 }}>{o.text}</div>
      </div>
    </div>
  );
}

function AgentTab({ on, color, onClick, title, sub }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 9, padding: "9px 15px", borderRadius: 6, cursor: "pointer",
      border: `1px solid ${on ? color + "88" : "var(--border)"}`,
      background: on ? color + "16" : "transparent", transition: "all .12s",
    }}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: on ? color : "var(--dim)" }} />
      <span style={{ ...hl.mono, fontSize: 14, fontWeight: 600, color: on ? "var(--text)" : "var(--muted)" }}>{title}</span>
      <span style={{ ...hl.mono, fontSize: 11.5, color: on ? color : "var(--dim)", whiteSpace: "nowrap" }}>· {sub}</span>
    </button>
  );
}

window.HomeLogicMono = { fontFamily: "var(--mono)" };
window.HomeLogicSection = HomeLogicSection;
