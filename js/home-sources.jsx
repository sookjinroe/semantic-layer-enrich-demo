// ============================================================
// 홈 · 신호 & 가용 소스 (2단계) — 소스별 탭으로 한 번에 하나씩.
//   · 구조적 신호(Term·BI·계보·Catalog·DB컬럼·Description) → 헤더 테이블
//   · 코드형 소스(schema.sql·*.java) → 코드 패널
// window.HomeSources 로 노출. props: { U, L, R, lineageGroups }
// ============================================================
const { useState: hsUseState } = React;

const hs = {
  mono: { fontFamily: "var(--mono)" },
  sans: { fontFamily: "var(--sans)" },
};

// ---- 헤더 테이블 ----
function DataTable({ template, head, rows }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", background: "var(--panel)" }}>
      <div style={{ display: "grid", gridTemplateColumns: template, background: "rgba(0,0,0,0.24)", borderBottom: "1px solid var(--border)" }}>
        {head.map((h, i) => (
          <div key={i} style={{ ...hs.mono, fontSize: 10.5, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", padding: "9px 12px" }}>{h}</div>
        ))}
      </div>
      {rows.map((r, ri) => (
        <div key={ri} style={{ display: "grid", gridTemplateColumns: template, borderBottom: ri < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
          {r.map((c, ci) => (
            <div key={ci} style={{ padding: "9px 12px", minWidth: 0, display: "flex", alignItems: "flex-start" }}>{c}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

// 셀 헬퍼
const Mn = ({ children, color = "var(--text)", size = 11.5 }) => <span style={{ ...hs.mono, fontSize: size, color, wordBreak: "break-word" }}>{children}</span>;
const Sn = ({ children, color = "var(--muted)", size = 12 }) => <span style={{ ...hs.sans, fontSize: size, color, lineHeight: 1.5, wordBreak: "break-word" }}>{children}</span>;
function DomainTag({ U, d }) { return <U.Tag border="var(--border)">{d}</U.Tag>; }
function Vals({ U, values, mono }) {
  if (!values) return <Sn color="var(--dim)">—</Sn>;
  return <span style={{ ...hs.mono, fontSize: 11, color: "var(--accent)", lineHeight: 1.55, wordBreak: "break-word" }}>{Object.entries(values).map(([k, v]) => `${k}=${v}`).join("  ")}</span>;
}

function Caption({ children }) {
  return <p style={{ ...hs.sans, fontSize: 12.5, color: "var(--muted)", margin: "0 0 13px", maxWidth: 820, lineHeight: 1.6 }}>{children}</p>;
}

// ---- Render 소스 ----
function SrcDB({ U, R }) {
  const [raw, setRaw] = hsUseState(false);
  const rows = R.COLUMNS.map((c) => {
    const flags = [];
    if (c.pk) flags.push(<U.Tag key="pk" bg="rgba(106,169,224,0.12)" fg="var(--sig)">PK</U.Tag>);
    if (c.fk) flags.push(<U.Tag key="fk" bg="rgba(178,145,230,0.12)" fg="var(--lin)">FK</U.Tag>);
    flags.push(<span key="nn" style={{ ...hs.sans, fontSize: 11, color: c.notNull ? "var(--muted)" : "var(--dim)", whiteSpace: "nowrap" }}>{c.notNull ? "NOT NULL" : "NULL"}</span>);
    return [
      <Mn color="var(--dim)">{c.t}</Mn>,
      <Mn>{c.n}</Mn>,
      <Mn color="var(--muted)">{c.type}</Mn>,
      <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{flags}</span>,
    ];
  });
  return (
    <div>
      <Caption>물리 스키마의 <b style={{ color: "var(--text)" }}>형태(form)</b>만 제공한다 — 컬럼 코멘트·샘플데이터 없음. 의미는 Catalog·Code에 있다.</Caption>
      <DataTable template="minmax(150px,1.1fr) minmax(150px,1.2fr) 0.8fr 1.1fr" head={["테이블", "컬럼", "타입", "제약"]} rows={rows} />
      <button onClick={() => setRaw((v) => !v)} style={{ ...hs.mono, fontSize: 11.5, color: "var(--muted)", background: "transparent", border: "1px solid var(--border)", borderRadius: 4, padding: "6px 12px", marginTop: 12, cursor: "pointer" }}>
        {raw ? "▾ schema.sql 원본 닫기" : "▸ schema.sql 원본 보기"}
      </button>
      {raw && <CodePanel title="schema.sql" body={R.SCHEMA_SQL} />}
    </div>
  );
}

function SrcCatalog({ U, R }) {
  const rows = Object.entries(R.CATALOG).map(([asset, e]) => [
    <Mn>{asset.split(".")[1]}</Mn>,
    <DomainTag U={U} d={e.domain} />,
    <Mn color="var(--accent)">{e.term.name}</Mn>,
    <Sn>{e.term.def}</Sn>,
    e.term.values ? <Vals U={U} values={e.term.values} /> : <U.Tag bg="rgba(224,107,94,0.1)" fg="var(--low)">미정</U.Tag>,
  ]);
  return (
    <div>
      <Caption>도메인·용어집 Term·term-link. 분류(Classification)와 기존 Description은 <b style={{ color: "var(--text)" }}>의도적으로 비움</b> — 일부 Term은 허용값도 미정이라 Code까지 올라가야 확정된다.</Caption>
      <DataTable template="1fr 0.7fr 0.9fr 1.7fr 1.4fr" head={["컬럼", "도메인", "Glossary Term", "정의", "허용값"]} rows={rows} />
    </div>
  );
}

function SrcCode({ R }) {
  return (
    <div>
      <Caption>값 의미는 <b style={{ color: "var(--text)" }}>Enum 리터럴</b>, PII는 <b style={{ color: "var(--text)" }}>@PersonalInfo 어노테이션</b>, 비즈니스 이름은 <b style={{ color: "var(--text)" }}>ORM 필드명</b>에서 — 산문 주석이 아니라 코드 구조에서 추론한다.</Caption>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {R.CODE_FILES.map((f) => <CodePanel key={f.file} title={f.file} body={f.body} compact />)}
      </div>
    </div>
  );
}

function CodePanel({ title, body, compact }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 5, overflow: "hidden", marginTop: compact ? 0 : 12, background: "var(--panel)" }}>
      <div style={{ ...hs.mono, fontSize: 11, color: "var(--high)", padding: "7px 11px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.2)" }}>{title}</div>
      <pre style={{ ...hs.mono, fontSize: 10.6, lineHeight: 1.55, color: "var(--text)", background: "rgba(0,0,0,0.28)", padding: "11px 12px", margin: 0, overflowX: "auto", whiteSpace: "pre" }}>{body}</pre>
    </div>
  );
}

// ---- Link 신호 ----
function SigDesc({ U, L }) {
  const rows = L.CLUSTER.map((c) => [
    <Mn>{L.col(c.asset)}</Mn>,
    <DomainTag U={U} d={c.domain} />,
    <Mn color="var(--muted)" size={11}>{c.type}</Mn>,
    <Sn color="var(--text)">{c.desc}</Sn>,
  ]);
  return (
    <div>
      <Caption>Matcher가 받는 <b style={{ color: "var(--text)" }}>검증된 Description</b>(입력). 의미 판단의 핵심 신호 — 컬럼명·도메인·FK는 보강.</Caption>
      <DataTable template="1.1fr 0.7fr 0.7fr 2.4fr" head={["컬럼", "도메인", "타입", "Description"]} rows={rows} />
    </div>
  );
}

function SigTerm({ U, L }) {
  const rows = L.LIBRARY.map((t) => [
    <Mn color="var(--text)" size={12.5}>{t.name}</Mn>,
    <DomainTag U={U} d={t.domain} />,
    <Sn>{t.def}</Sn>,
    t.values ? <Vals U={U} values={t.values} /> : <Sn color="var(--dim)">—</Sn>,
    t.note ? <Sn color="var(--low)" size={11.5}>{t.note}</Sn> : <Sn color="var(--dim)">—</Sn>,
  ]);
  return (
    <div>
      <Caption>기존 Term 사전. 정답 외에 <b style={{ color: "var(--low)" }}>근접오답·이름충돌</b>이 섞여 있어(비고) 매칭이 자명하지 않다.</Caption>
      <DataTable template="0.8fr 0.7fr 1.5fr 0.9fr 1.5fr" head={["Term", "도메인", "정의", "허용값", "비고 (근접오답·충돌)"]} rows={rows} />
    </div>
  );
}

function SigBI({ U, L }) {
  const junk = (label) => /^dim_|^측정값/.test(label);
  const tyColor = { field: "var(--sig)", metric: "var(--accent)", dashboard: "var(--lin)" };
  const rows = L.BI_ASSETS.map((b) => [
    <Mn color={junk(b.label) ? "var(--low)" : "var(--text)"}>{b.label}</Mn>,
    <Mn color="var(--dim)" size={11}>{b.tool}</Mn>,
    <span style={{ ...hs.mono, fontSize: 11, color: tyColor[b.type] || "var(--muted)" }}>{b.type}</span>,
    <Mn color="var(--muted)" size={11}>{b.references.map((r) => L.col(r)).join(", ")}</Mn>,
  ]);
  return (
    <div>
      <Caption>BI 도구 메타데이터(역방향으로 읽는 <b style={{ color: "var(--text)" }}>사용 신호</b>). 라벨은 깨끗할 수도(세금면제 여부), <b style={{ color: "var(--low)" }}>무의미</b>할 수도(dim_07) 있다.</Caption>
      <DataTable template="1.2fr 0.6fr 0.6fr 1.8fr" head={["라벨", "도구", "타입", "참조 컬럼"]} rows={rows} />
    </div>
  );
}

function SigLineage({ U, L, lineageGroups }) {
  const rows = Object.entries(lineageGroups)
    .filter(([up]) => up !== "(상류 없음)")
    .map(([up, cols]) => [
      <Mn color="var(--lin)">{up}</Mn>,
      <Mn color="var(--muted)">{cols.map((c) => L.col(c.asset)).join(", ")}</Mn>,
    ]);
  return (
    <div>
      <Caption>같은 변환(upstream)에서 함께 파생된 컬럼. 타입이 달라도 같은 배치에서 나왔다면 <b style={{ color: "var(--text)" }}>개념적 친연성</b>의 신호가 된다.</Caption>
      <DataTable template="1fr 2fr" head={["상류 변환", "함께 파생된 컬럼"]} rows={rows} />
    </div>
  );
}

// ---- 탭 컨트롤 ----
// 상위(에이전트): 연결된 세그먼트 컨트롤. 하위(소스): 언더라인 탭.
function AgentSeg({ items, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
      {items.map((it, i) => {
        const on = value === it.id;
        return (
          <button key={it.id} onClick={() => onChange(it.id)}
            style={{ ...hs.mono, fontSize: 13, padding: "9px 18px", cursor: "pointer", border: "none", whiteSpace: "nowrap",
              borderLeft: i ? "1px solid var(--border)" : "none",
              background: on ? it.color + "1e" : "transparent",
              color: on ? "var(--text)" : "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: on ? it.color : "var(--dim)" }} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function SrcUnderTab({ on, color, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ ...hs.mono, fontSize: 12.5, padding: "8px 14px 9px", cursor: "pointer", background: "transparent", whiteSpace: "nowrap",
        border: "none", borderBottom: `2px solid ${on ? color : "transparent"}`, marginBottom: -1,
        color: on ? "var(--text)" : "var(--muted)", letterSpacing: "0.02em" }}>{children}</button>
  );
}

const RENDER_TABS = [
  { id: "db", label: "DB · schema", color: "var(--sig)" },
  { id: "catalog", label: "Catalog · 용어집", color: "var(--sig)" },
  { id: "code", label: "Code · *.java", color: "var(--sig)" },
];
const LINK_TABS = [
  { id: "desc", label: "Description", color: "var(--accent)" },
  { id: "term", label: "Term 라이브러리", color: "var(--accent)" },
  { id: "bi", label: "BI 자산", color: "var(--accent)" },
  { id: "lineage", label: "계보", color: "var(--accent)" },
];

function HomeSources({ U, L, R, lineageGroups }) {
  const [agent, setAgent] = hsUseState("render");
  const [rSrc, setRSrc] = hsUseState("db");
  const [lSrc, setLSrc] = hsUseState("term");
  const isR = agent === "render";
  const tabs = isR ? RENDER_TABS : LINK_TABS;
  const src = isR ? rSrc : lSrc;
  const setSrc = isR ? setRSrc : setLSrc;
  const identAgent = isR ? "var(--sig)" : "var(--accent)";

  return (
    <div>
      {/* 상위: 에이전트 세그먼트 · 하위: 소스 언더라인 탭 */}
      <div style={{ marginTop: 18 }}>
        <AgentSeg
          items={[{ id: "render", label: "Render 소스", color: "var(--sig)" }, { id: "link", label: "Link 신호", color: "var(--accent)" }]}
          value={agent} onChange={(id) => setAgent(id)} />
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginTop: 14, marginBottom: 20, flexWrap: "wrap" }}>
          {tabs.map((t) => <SrcUnderTab key={t.id} on={src === t.id} color={identAgent} onClick={() => setSrc(t.id)}>{t.label}</SrcUnderTab>)}
        </div>
      </div>

      {/* 내용 */}
      {isR && src === "db" && <SrcDB U={U} R={R} />}
      {isR && src === "catalog" && <SrcCatalog U={U} R={R} />}
      {isR && src === "code" && <SrcCode R={R} />}
      {!isR && src === "desc" && <SigDesc U={U} L={L} />}
      {!isR && src === "term" && <SigTerm U={U} L={L} />}
      {!isR && src === "bi" && <SigBI U={U} L={L} />}
      {!isR && src === "lineage" && <SigLineage U={U} L={L} lineageGroups={lineageGroups} />}
    </div>
  );
}

window.HomeSources = HomeSources;
