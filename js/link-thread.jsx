// ============================================================
// Link · 1막(Matcher) 스레드 — Render의 '추론 스레드' 어휘를 그대로 재사용.
// 한 컬럼 = 한 조사 스레드. 라이브 실행과 사후 리뷰가 같은 컴포넌트를 공유한다.
// 이벤트 모양:
//   {type:'search',  candidates:[{name,domain,def}...]}      라이브러리 검색(주어진 재료)
//   {type:'think',   text, pending}                          모델 판단 1문장(루프의 '생각')
//   {type:'evidence',kind, need, reason, status, data|text}  능동적 증거 수집(루프의 '행동')
//   {type:'verdict', decision, term?, reason?, confidence}   판정
// window.LinkThreadMod 로 노출.
// ============================================================

// 증거 종류 → 쿨 톤(신호등 색 아님). usage/term=sig, fk=lin.
const LT_EV = {
  usage:       { tone: "bi",      label: "BI 사용 신호 조회",  req: "BI 사용 신호 요청" },
  fk:          { tone: "fk",      label: "FK 대상 조회",       req: "FK 대상 요청" },
  term_detail: { tone: "term",    label: "Term 상세 조회",     req: "Term 상세 요청" },
};

function ltMono() { return { fontFamily: "var(--mono)" }; }

// 좌측 게터(점+연결선) + 우측 내용 — Render ThreadNode와 동형
function LTNode({ U, ev, isLast }) {
  const mono = ltMono();
  const isVerdict = ev.type === "verdict";
  let color = "var(--muted)";
  if (ev.type === "search") color = "var(--sig)";
  else if (ev.type === "think") color = "var(--dim)";
  else if (ev.type === "evidence") color = ev.kind === "fk" ? "var(--lin)" : "var(--sig)";
  else if (ev.type === "verdict") color = ev.decision === "match" ? (U.CONF_COLOR[ev.confidence] || "var(--muted)") : "var(--muted)";

  const active = ev.pending || ev.status === "requesting";
  return (
    <div style={{ display: "flex", gap: 13 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 14 }}>
        {isVerdict
          ? <span style={{ color, fontSize: 13, lineHeight: "16px", marginTop: 2 }}>{ev.decision === "match" ? "✓" : "—"}</span>
          : <span style={{ width: 9, height: 9, borderRadius: 9, marginTop: 4,
              background: ev.type === "think" ? "transparent" : color,
              border: ev.type === "think" ? `2px solid ${color}` : "none",
              boxShadow: active ? `0 0 0 4px ${color}22` : "none",
              animation: active ? "pulse 1.1s infinite" : "none" }} />}
        {!isLast && <span style={{ flex: 1, width: 2, background: "var(--border)", marginTop: 4, minHeight: 16 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 4 : 16, minWidth: 0 }}>
        {ev.type === "search" && <LTSearch U={U} ev={ev} />}
        {ev.type === "think" && <LTThink ev={ev} />}
        {ev.type === "evidence" && <LTEvidence U={U} ev={ev} />}
        {ev.type === "verdict" && <LTVerdict U={U} ev={ev} />}
      </div>
    </div>
  );
}

// 검색: Term 라이브러리 조회 요청(읽을 시간) → 조회 완료 + 후보 Term. 미리 주어진 게 아니라 그 자리에서 조회.
function LTSearch({ U, ev }) {
  const mono = ltMono();
  const items = ev.candidates || [];
  const requesting = ev.status === "requesting";
  return (
    <div style={{ paddingTop: 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span key={ev.status} className="fadeIn" style={{ ...mono, fontSize: 12.5, color: "var(--sig)", letterSpacing: "0.03em" }}>
          {requesting ? "Term 라이브러리 조회 요청" : `Term 라이브러리 조회 완료 · 후보 ${items.length}`}
        </span>
        {requesting && <span style={{ ...mono, fontSize: 10.5, color: "var(--dim)", animation: "pulse 1.1s infinite" }}>…</span>}
      </div>
      {!requesting && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
          {items.length === 0 && <span style={{ ...mono, fontSize: 11.5, color: "var(--dim)" }}>일치 후보 없음 — 매칭 실패 가능</span>}
          {items.map((cd) => (
            <span key={cd.name} style={{ ...mono, fontSize: 11, color: "var(--text)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px", background: "rgba(0,0,0,0.25)" }}>
              {cd.name} <span style={{ color: "var(--dim)" }}>·{cd.domain}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// 생각: 모델 판단 1문장 (루프의 '왜 더 보는가' / '왜 이렇게 정했나')
function LTThink({ ev }) {
  if (ev.pending && !ev.text) return <span style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", animation: "pulse 1.1s infinite" }}>판단 중…</span>;
  return <span style={{ fontSize: 13.5, lineHeight: 1.65, color: "#aab1bd" }}>{ev.text}</span>;
}

// 증거 수집: 요청(읽을 시간) → 조회 완료 + 원문 카드. 에이전트의 능동적 행동.
function LTEvidence({ U, ev }) {
  const mono = ltMono();
  const meta = LT_EV[ev.kind] || { tone: "neutral", label: "조회", req: "요청" };
  const requesting = ev.status === "requesting";
  const titleName = ev.kind === "term_detail" ? (ev.data ? ` — ${ev.data.name}` : ev.missing ? ` — ${ev.missing}` : "") : "";
  return (
    <div style={{ paddingTop: 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span key={ev.status} className="fadeIn" style={{ ...mono, fontSize: 12.5, letterSpacing: "0.03em", color: ev.kind === "fk" ? "var(--lin)" : "var(--sig)" }}>
          {requesting ? meta.req : meta.label + titleName}
        </span>
        {requesting && <span style={{ ...mono, fontSize: 10.5, color: "var(--dim)", animation: "pulse 1.1s infinite" }}>…</span>}
      </div>
      {!requesting && <div style={{ marginTop: 8 }}><LTEvBody U={U} ev={ev} /></div>}
    </div>
  );
}

function LTEvBody({ U, ev }) {
  if (ev.kind === "fk") {
    const d = ev.data || {};
    return <U.SignalBlock tone="fk" mono={false} body={`${d.target} — "${d.desc}"  (도메인 ${d.domain}${d.pk ? ", PK" : ""})`} />;
  }
  if (ev.kind === "usage") return <U.SignalBlock tone="bi" mono={false} body={ev.text} />;
  if (ev.kind === "term_detail") {
    if (ev.missing) return <U.SignalBlock tone="reject" mono={false} body={`"${ev.missing}" — 라이브러리에 없는 Term(지어낸 후보). 부합 Term 아님으로 처리.`} />;
    const d = ev.data || {};
    const valstr = d.values ? Object.entries(d.values).map(([k, v]) => `${k}=${v}`).join("  ") : "없음";
    return (
      <U.SignalBlock tone="term" mono={false}>
        <div style={{ fontFamily: "var(--sans)" }}>{d.def}</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", marginTop: 5 }}>도메인 {d.domain} · 허용값 {valstr} · 연결자산 {d.linked && d.linked.length ? d.linked.join(", ") : "없음"}</div>
      </U.SignalBlock>
    );
  }
  return null;
}

// 판정: 매칭 Term + 신뢰도 / 무매칭→잔여
function LTVerdict({ U, ev }) {
  const mono = ltMono();
  const matched = ev.decision === "match";
  return (
    <div style={{ paddingTop: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ ...mono, fontSize: 11, color: "var(--muted)", letterSpacing: "0.06em" }}>판정</span>
        {matched
          ? <><span style={{ ...mono, fontSize: 14, color: "var(--text)" }}>{ev.term}</span><U.ConfBadge c={ev.confidence} /></>
          : <span style={{ ...mono, fontSize: 13, color: "var(--muted)" }}>{ev.reason === "collision" ? "이름 충돌 — 매칭 거부" : ev.reason === "scope" ? "입도 불일치 — 매칭 거부" : "부합 Term 없음"} <span style={{ color: "var(--accent)" }}>→ 발견으로 이관</span></span>}
      </div>
    </div>
  );
}

// 한 컬럼의 스레드 전체 (헤더 + 노드들)
function MatcherThread({ U, L, asset, events, title }) {
  const { col, byAsset } = L;
  const c = byAsset[asset];
  const mono = ltMono();
  const evs = events || [];
  return (
    <div>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.15)" }}>
        <div style={{ ...mono, fontSize: 14, color: "var(--text)" }}>{asset}</div>
        <div style={{ ...mono, fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
          {c ? c.type : ""}{c && c.fk ? ` · FK → ${c.fk}` : ""}{c && c.pk ? " · PK" : ""}
          {title && <span style={{ color: "var(--dim)" }}> · {title}</span>}
        </div>
      </div>
      <div style={{ padding: "16px 16px 8px" }}>
        {evs.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", animation: "pulse 1.1s infinite" }}>스레드 시작 중…</div>}
        {evs.map((ev, i) => <LTNode key={i} U={U} ev={ev} isLast={i === evs.length - 1} />)}
      </div>
    </div>
  );
}

window.LinkThreadMod = { MatcherThread };
