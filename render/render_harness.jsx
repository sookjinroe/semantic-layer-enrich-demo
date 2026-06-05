import { useState } from "react";

// ============================================================
// Render 실행 하니스 — 검증용 (폴리시드 데모 아님)
// 실제 API 루프를 우리 LOAN fixture에 물려 돌린다.
// 출력은 스크립트하지 않는다. 데이터(입력)만 공급한다.
// ============================================================

// ---- DB 층 (schema.sql에서 파싱한 형태) ----
const COLUMNS = [
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

const key = (c) => `${c.t}.${c.n}`;

// ---- Catalog 층 (catalog.json) ----
const CATALOG = {
  "LOAN_APPL_HIST.TAX_EXMP_FLG": { domain: "LOAN", term: { name: "세금면제", def: "대출 신청 건에 적용되는 세금 면제 상태", values: null } },
  "LOAN_APPL_HIST.LOAN_STAT_CD": { domain: "LOAN", term: { name: "대출상태", def: "대출 신청 건의 현재 처리 상태", values: { "01": "접수", "02": "심사중", "03": "승인", "04": "거절" } } },
  "LOAN_APPL_HIST.CRDT_GRD_CD": { domain: "LOAN", term: { name: "신용등급", def: "고객의 신용도를 나타내는 등급", values: null } },
};
const tableDomain = (t) => (t === "CUST_BASE_INFO" ? "CUSTOMER" : "LOAN");

// ---- Code 층 (code/*.java에서 추출되는 스니펫) ----
const CODE = {
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
function dbSignal(c) {
  const cons = [c.notNull ? "NOT NULL" : "NULL 허용", c.pk ? "PK" : "", c.fk ? `FK → ${c.fk}` : ""].filter(Boolean).join(", ");
  return `테이블: ${c.t}\n컬럼: ${c.n}\n타입: ${c.type}\n제약: ${cons}`;
}
function catalogSignal(c) {
  const k = key(c);
  const entry = CATALOG[k];
  const domain = entry ? entry.domain : tableDomain(c.t);
  let s = `도메인: ${domain}\n분류(Classification): 없음\n기존 Description: 없음`;
  if (entry && entry.term) {
    s += `\n연결된 Glossary Term: "${entry.term.name}"\n  정의: ${entry.term.def}\n  허용값: ${entry.term.values ? JSON.stringify(entry.term.values) : "용어집에 정의되어 있지 않음"}`;
  } else {
    s += `\n연결된 Glossary Term: 없음`;
  }
  return s;
}
function codeSignal(c) {
  return CODE[key(c)] || "이 컬럼과 관련된 코드 신호 없음";
}

// ---- 모델 호출 (실제 API) ----
const SYSTEM = `너는 "Render"라는 데이터 카탈로그 증강 에이전트다. 단 하나의 DB 컬럼에 대해 비즈니스 Description을 작성한다.

너는 에이전틱하게 동작한다. 매 단계에서, 지금까지 확보한 신호가 "확신 있고 정확한 설명"을 쓰기에 충분한지 스스로 판단한다.

[충분성 판단 기준]
- 이름과 타입이 명확한 컬럼(날짜, 금액, 식별자, 이름, 우편번호 등)은 DB 신호만으로 충분할 수 있다.
- 코드값 컬럼(CHAR/VARCHAR 코드: 보통 _CD, _FLG 접미사)은 "가능한 값과 각 값의 의미"가 확인되어야 충분하다. 값 의미를 모르면 충분하지 않다.
- 의미상 모호함이 남으면 충분하지 않다.
- PII 여부 등 분류가 핵심이면 그 근거가 있어야 한다.

[행동]
- 불충분하고 아직 가져오지 않은 소스가 있으면, 다음 소스 하나를 이름으로 요청한다(catalog 또는 code).
- 가져올 수 있는 소스가 없으면(availableSources 비었음) 반드시 최종 생성한다. 가용 정보로 가능한 최선의 설명을 쓰고, 불확실하면 confidence를 낮춘다.

[Confidence]
- HIGH: 설명에 확신. 자동 반영 가능.
- MEDIUM: 그럴듯하나 검증 권장.
- LOW: 추측 수준. 검토 필요.

반드시 아래 JSON 객체 하나만 출력한다. 마크다운/코드펜스/설명 텍스트 금지.
{"thinking":"왜 충분/불충분인지 한국어 1~2문장","sufficient":true|false,"need_source":"catalog"|"code"|null,"description":"최종일 때 비즈니스 설명 한 문장, 아니면 null","confidence":"HIGH"|"MEDIUM"|"LOW"|null}`;

function parseJSON(text) {
  let t = (text || "").trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(t); } catch (e) {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

async function callModel(c, gathered, available) {
  const parts = [`[대상 컬럼] ${key(c)}`, ``, `[지금까지 확보한 신호]`];
  parts.push(`■ DB\n${gathered.db}`);
  if (gathered.catalog) parts.push(`■ Catalog\n${gathered.catalog}`);
  if (gathered.code) parts.push(`■ Code\n${gathered.code}`);
  parts.push(``, `[아직 가져올 수 있는 소스] ${available.length ? available.join(", ") : "없음 — 지금 반드시 최종 생성하라"}`, ``, `판단해서 JSON 하나로 답하라.`);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000, // link 하니스와 동일 — 긴 출력이 잘리지 않도록 넉넉히(상한이라 실제 사용은 필요한 만큼만)
      system: SYSTEM,
      messages: [{ role: "user", content: parts.join("\n") }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const json = parseJSON(text);
  if (!json) throw new Error("JSON 파싱 실패: " + text.slice(0, 120));
  return json;
}

const CONF_COLOR = { HIGH: "var(--high)", MEDIUM: "var(--med)", LOW: "var(--low)" };

export default function RenderHarness() {
  const [srcCatalog, setSrcCatalog] = useState(true);
  const [srcCode, setSrcCode] = useState(true);
  const [results, setResults] = useState({}); // key -> {status, confidence, description, steps, error}
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandAll, setExpandAll] = useState(false); // 우측: active 하나 vs 실행된 전체 누적 조회

  function setRes(k, patch) {
    setResults((prev) => ({ ...prev, [k]: { ...(prev[k] || {}), ...patch } }));
  }

  // 소스 조건이 바뀌면 기존 결과는 무효 — 비운다(혼동 방지)
  function toggleSource(which) {
    if (busy) return;
    setResults({});
    setActive(null);
    if (which === "catalog") setSrcCatalog((v) => !v);
    else setSrcCode((v) => !v);
  }

  // 조회: 저장된 결과만 본다(API 호출 없음). 안 돌렸으면 active만 잡아 안내 표시.
  function viewColumn(c) {
    setActive(key(c));
  }

  async function runColumn(c) {
    const k = key(c);
    setActive(k);
    setRes(k, { status: "running", steps: [], confidence: null, description: null, error: null });
    const gathered = { db: dbSignal(c) };
    const fetched = ["db"];
    const steps = [];
    try {
      for (let i = 0; i < 4; i++) {
        const available = ["catalog", "code"].filter(
          (s) => (s === "catalog" ? srcCatalog : srcCode) && !fetched.includes(s)
        );
        const resp = await callModel(c, gathered, available);
        steps.push({ held: [...fetched], ...resp });
        setRes(k, { steps: [...steps] });

        const canEscalate = !resp.sufficient && resp.need_source && available.includes(resp.need_source);
        if (resp.sufficient || available.length === 0 || !canEscalate) {
          // 최종 — 모델이 description을 안 줬고 더 갈 소스도 없으면 마지막 강제 호출
          if (!resp.description) {
            const fin = await callModel(c, gathered, []);
            steps.push({ held: [...fetched], ...fin });
            setRes(k, { steps: [...steps] });
            setRes(k, { status: "done", confidence: fin.confidence || "LOW", description: fin.description || "(설명 생성 실패)" });
          } else {
            setRes(k, { status: "done", confidence: resp.confidence || "LOW", description: resp.description });
          }
          return;
        }
        // 에스컬레이션
        gathered[resp.need_source] = resp.need_source === "catalog" ? catalogSignal(c) : codeSignal(c);
        fetched.push(resp.need_source);
      }
      setRes(k, { status: "done", confidence: "LOW", description: "(반복 한도 도달)" });
    } catch (e) {
      setRes(k, { status: "done", error: String(e.message || e), confidence: "LOW", description: null });
    }
  }

  async function runAll() {
    setBusy(true);
    for (const c of COLUMNS) {
      await runColumn(c);
    }
    setBusy(false);
  }

  // 행 ▷ 버튼: 개별 실행/재실행 (busy 잠금)
  async function runOne(c) {
    if (busy) return;
    setBusy(true);
    await runColumn(c);
    setBusy(false);
  }

  const counts = COLUMNS.reduce((a, c) => {
    const r = results[key(c)];
    if (r && r.status === "done" && r.confidence) a[r.confidence] = (a[r.confidence] || 0) + 1;
    return a;
  }, {});

  const activeCol = active ? COLUMNS.find((c) => key(c) === active) : null;

  const S = {
    page: { background: "var(--bg)", color: "var(--text)", minHeight: "100%", fontFamily: "'IBM Plex Sans', sans-serif", padding: 18, boxSizing: "border-box" },
    title: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, letterSpacing: "0.18em", color: "var(--muted)", textTransform: "uppercase" },
    h1: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, margin: "2px 0 14px" },
    bar: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 14 },
    toggle: (on) => ({ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "5px 11px", borderRadius: 2, cursor: "pointer", border: "1px solid var(--border)", background: on ? "var(--accent)" : "transparent", color: on ? "#1a1205" : "var(--muted)", userSelect: "none" }),
    btn: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "6px 14px", borderRadius: 2, cursor: "pointer", border: "1px solid var(--high)", background: "transparent", color: "var(--high)" },
    grid: { display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.3fr)", gap: 14, alignItems: "start" },
    panel: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 3 },
    row: (on, sel) => ({ display: "flex", alignItems: "center", gap: 10, padding: "7px 11px", cursor: on ? "pointer" : "default", borderLeft: sel ? "2px solid var(--accent)" : "2px solid transparent", background: sel ? "rgba(232,179,65,0.06)" : "transparent", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }),
    chip: (col) => ({ width: 9, height: 9, borderRadius: 9, background: col, flexShrink: 0 }),
    runBtn: (dim) => ({ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: dim ? "var(--border)" : "var(--high)", border: `1px solid ${dim ? "var(--border)" : "var(--high)"}`, borderRadius: 2, padding: "0 6px", cursor: dim ? "default" : "pointer", userSelect: "none", lineHeight: "16px" }),
    sub: { color: "var(--muted)", fontSize: 11 },
    step: { borderTop: "1px solid var(--border)", padding: "10px 12px", fontSize: 12.5, lineHeight: 1.55 },
    tag: (bg, fg) => ({ display: "inline-block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, padding: "1px 7px", borderRadius: 2, background: bg, color: fg, letterSpacing: "0.05em" }),
    code: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: "var(--muted)", whiteSpace: "pre-wrap", margin: "5px 0 0", padding: "8px 10px", background: "rgba(0,0,0,0.25)", borderRadius: 2 },
  };

  const renderStatusColor = (r) => {
    if (!r || r.status === "pending" || !r.status) return "var(--border)";
    if (r.status === "running") return "var(--accent)";
    if (r.error) return "var(--low)";
    return CONF_COLOR[r.confidence] || "var(--muted)";
  };

  let lastTable = null;

  return (
    <div style={S.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        :root{--bg:#0d0f12;--panel:#16191e;--border:#2a2f37;--text:#d7dbe0;--muted:#8a929e;--accent:#e8b341;--high:#4ec98a;--med:#e8b341;--low:#e06b5e;}
        *{box-sizing:border-box;} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>

      <div style={S.title}>Render · 실행 하니스 (검증용)</div>
      <div style={S.h1}>LOAN 데이터셋 · 라이브 실행</div>

      <div style={S.bar}>
        <span style={{ ...S.sub, fontFamily: "'IBM Plex Mono', monospace" }}>SOURCES</span>
        <span style={S.toggle(true)} title="항상 켜짐">DB ●</span>
        <span style={S.toggle(srcCatalog)} onClick={() => toggleSource("catalog")}>Catalog {srcCatalog ? "●" : "○"}</span>
        <span style={S.toggle(srcCode)} onClick={() => toggleSource("code")}>Code {srcCode ? "●" : "○"}</span>
        <span style={{ ...S.sub, marginLeft: 4 }}>|</span>
        <span style={S.toggle(expandAll)} onClick={() => setExpandAll((v) => !v)} title="실행된 컬럼들의 결과를 한 번에 조회">전체 로그 {expandAll ? "●" : "○"}</span>
        <span style={{ flex: 1 }} />
        <span style={S.sub}>
          <span style={{ color: "var(--high)" }}>HIGH {counts.HIGH || 0}</span> ·{" "}
          <span style={{ color: "var(--med)" }}>MED {counts.MEDIUM || 0}</span> ·{" "}
          <span style={{ color: "var(--low)" }}>LOW {counts.LOW || 0}</span>
        </span>
        <button style={S.btn} disabled={busy} onClick={runAll}>{busy ? "실행 중…" : "▷ 전체 실행"}</button>
      </div>

      <div style={S.grid}>
        {/* 좌: 컬럼 리스트 (채움 macro) */}
        <div style={S.panel}>
          {COLUMNS.map((c) => {
            const k = key(c);
            const r = results[k];
            const showHeader = c.t !== lastTable;
            lastTable = c.t;
            return (
              <div key={k}>
                {showHeader && (
                  <div style={{ ...S.sub, fontFamily: "'IBM Plex Mono', monospace", padding: "8px 11px 4px", borderTop: "1px solid var(--border)", letterSpacing: "0.08em" }}>
                    {c.t} <span style={{ opacity: 0.6 }}>· {tableDomain(c.t)}</span>
                  </div>
                )}
                <div style={S.row(true, active === k)} onClick={() => viewColumn(c)}>
                  <span style={{ ...S.chip(renderStatusColor(r)), animation: r && r.status === "running" ? "pulse 1s infinite" : "none" }} />
                  <span style={{ flex: 1 }}>{c.n}</span>
                  <span style={{ ...S.sub, fontSize: 11 }}>{c.type}</span>
                  {r && r.status === "done" && r.confidence && (
                    <span style={S.tag("transparent", CONF_COLOR[r.confidence])}>{r.confidence}</span>
                  )}
                  <span
                    style={S.runBtn(busy)}
                    title={r && r.status === "done" ? "다시 실행" : "실행"}
                    onClick={(e) => { e.stopPropagation(); runOne(c); }}
                  >▷</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 우: 추론 패널 — expandAll이면 실행된 전체를 누적 조회, 아니면 active 하나 */}
        <div style={S.panel}>
          {(() => {
            const ColResult = (c, r, withHeader) => {
              const k = key(c);
              return (
                <div key={k}>
                  {withHeader && (
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", borderTop: withHeader === "first" ? "none" : "1px solid var(--border)" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14 }}>{k}</div>
                      <div style={S.sub}>{c.type}</div>
                    </div>
                  )}
                  {(r.steps || []).map((s, i) => (
                    <div key={i} style={S.step}>
                      <div style={{ marginBottom: 5 }}>
                        <span style={S.tag("rgba(255,255,255,0.06)", "var(--muted)")}>보유: {s.held.join(" + ").toUpperCase()}</span>{" "}
                        {s.sufficient ? (
                          <span style={S.tag("rgba(78,201,138,0.12)", "var(--high)")}>충분</span>
                        ) : s.need_source ? (
                          <span style={S.tag("rgba(232,179,65,0.12)", "var(--med)")}>불충분 → {s.need_source.toUpperCase()} 요청</span>
                        ) : (
                          <span style={S.tag("rgba(224,107,94,0.12)", "var(--low)")}>소진</span>
                        )}
                      </div>
                      <div style={{ color: "var(--text)" }}>{s.thinking}</div>
                    </div>
                  ))}
                  {r.status === "running" && <div style={{ ...S.step, color: "var(--accent)", animation: "pulse 1s infinite" }}>판단 중…</div>}
                  {r.status === "done" && (
                    <div style={{ ...S.step, background: "rgba(0,0,0,0.2)" }}>
                      {r.error ? (
                        <div style={{ color: "var(--low)" }}>오류: {r.error}</div>
                      ) : (
                        <>
                          <div style={{ marginBottom: 6 }}>
                            <span style={S.tag(CONF_COLOR[r.confidence], "#10130f")}>{r.confidence}</span>{" "}
                            <span style={S.sub}>최종 Description</span>
                          </div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{r.description}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            if (expandAll) {
              const ran = COLUMNS.filter((c) => results[key(c)]);
              if (!ran.length) return <div style={{ padding: 18, color: "var(--muted)", fontSize: 13 }}>아직 실행된 컬럼이 없습니다. 행의 <b style={{ color: "var(--high)" }}>▷</b> 또는 <b>전체 실행</b>으로 돌린 뒤, 여기서 전체 결과를 한 번에 조회할 수 있습니다.</div>;
              return <div>{ran.map((c, idx) => ColResult(c, results[key(c)], idx === 0 ? "first" : true))}</div>;
            }

            if (!active) {
              return (
                <div style={{ padding: 18, color: "var(--muted)", fontSize: 13 }}>
                  왼쪽 행을 <b>클릭</b>하면 그 컬럼의 결과를 조회합니다(실행 안 함). 행의 <b style={{ color: "var(--high)" }}>▷</b>로 실행/재실행, 상단 <b>전체 실행</b>으로 일괄.
                  <div style={{ marginTop: 10, ...S.sub }}>소스 토글(Catalog/Code)을 바꾸면 조건이 달라져 결과가 초기화됩니다. <b>전체 로그</b> 토글로 실행된 컬럼을 한 번에 조회.</div>
                </div>
              );
            }
            const ar = results[active];
            if (!ar) {
              const ac = COLUMNS.find((c) => key(c) === active);
              return (
                <div style={{ padding: 18, color: "var(--muted)", fontSize: 13 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, color: "var(--text)" }}>{active}</div>
                  <div style={{ ...S.sub, marginTop: 4 }}>{ac && ac.type}</div>
                  <div style={{ marginTop: 12 }}>아직 실행되지 않았습니다. 이 행의 <b style={{ color: "var(--high)" }}>▷</b>를 눌러 실행하세요.</div>
                </div>
              );
            }
            return ColResult(activeCol, ar, true);
          })()}
        </div>
      </div>

      <div style={{ ...S.sub, marginTop: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
        결과·경로는 실제 모델이 정합니다. 우리는 fixture(입력)만 공급합니다.
      </div>
    </div>
  );
}
