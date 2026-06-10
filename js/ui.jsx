// ============================================================
// 공용 UI 프리미티브 — 다크 인스트루먼트 톤. window.UI 로 노출.
// 핵심: SignalBlock = 모델이 실제로 본 입력 신호 '원문'을 펼쳐 보이는 블록.
// ============================================================
const { useState: uiUseState } = React;

const CONF_COLOR = { HIGH: "var(--high)", MEDIUM: "var(--med)", LOW: "var(--low)" };
const CONF_BG = { HIGH: "rgba(78,201,138,0.13)", MEDIUM: "rgba(232,179,65,0.13)", LOW: "rgba(224,107,94,0.13)" };

// 작은 라벨 태그
function Tag({ children, bg = "transparent", fg = "var(--muted)", border }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: "var(--mono)", fontSize: 10.5, lineHeight: "16px",
      padding: "1px 7px", borderRadius: 3, background: bg, color: fg,
      letterSpacing: "0.04em", border: border ? `1px solid ${border}` : "1px solid transparent",
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

// 상태 점
function Dot({ color = "var(--border)", pulsing = false, size = 8 }) {
  return <span style={{ width: size, height: size, borderRadius: size, background: color, flexShrink: 0, animation: pulsing ? "pulse 1s infinite" : "none", boxShadow: pulsing ? `0 0 0 3px ${color}22` : "none" }} />;
}

// 신뢰도 배지 (채움)
function ConfBadge({ c }) {
  if (!c) return null;
  return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 3, background: CONF_COLOR[c], color: "#0c0e11", letterSpacing: "0.04em" }}>{c}</span>;
}

// 신뢰도 배지 (외곽선)
function ConfOutline({ c }) {
  if (!c) return null;
  return <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 3, background: CONF_BG[c], color: CONF_COLOR[c], letterSpacing: "0.04em", border: `1px solid ${CONF_COLOR[c]}55` }}>{c}</span>;
}

// 섹션 라벨 (얇은 머리글)
function SectionLabel({ children, accent = "var(--muted)" }) {
  return <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: accent, display: "flex", alignItems: "center", gap: 8 }}>{children}</div>;
}

// 핵심: 원문 신호 블록 — 모델이 실제로 받은 입력 텍스트를 그대로 노출.
// tone: db | catalog | code | bi | lineage | term | neutral
// A안: 소스·신호·Term 은 하나의 쿨 톤(sig). 관계 신호(계보·FK)만 두 번째 쿨 톤(lin).
// 신호등 색은 신뢰도 전용 — 신호 블록엔 쓰지 않는다.
const SIGNAL_TONE = {
  db:      { c: "var(--sig)",    label: "DB" },
  catalog: { c: "var(--sig)",    label: "CATALOG" },
  code:    { c: "var(--sig)",    label: "CODE" },
  bi:      { c: "var(--sig)",    label: "BI / 사용" },
  lineage: { c: "var(--lin)",    label: "LINEAGE / 계보" },
  term:    { c: "var(--sig)",    label: "TERM" },
  fk:      { c: "var(--lin)",    label: "FK" },
  reject:  { c: "var(--muted)",  label: "① MATCHER · 거부" },
  neutral: { c: "var(--muted)",  label: "신호" },
};

function SignalBlock({ tone = "neutral", title, body, mono = true, children, dim }) {
  const t = SIGNAL_TONE[tone] || SIGNAL_TONE.neutral;
  return (
    <div style={{ border: `1px solid var(--border)`, borderLeft: `2px solid ${t.c}`, borderRadius: 3, background: "rgba(0,0,0,0.22)", overflow: "hidden", opacity: dim ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderBottom: "1px solid var(--border-soft)", background: "rgba(255,255,255,0.018)" }}>
        <Dot color={t.c} size={6} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", color: t.c, textTransform: "uppercase" }}>{t.label}</span>
        {title && <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>{title}</span>}
      </div>
      <div style={{ padding: "8px 11px", fontFamily: mono ? "var(--mono)" : "var(--sans)", fontSize: 11.5, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {body != null ? body : children}
      </div>
    </div>
  );
}

// 카드 (홈 등에서)
function Card({ children, style }) {
  return <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, ...style }}>{children}</div>;
}

// 접기/펼치기
function Collapse({ label, count, openByDefault = false, accent = "var(--muted)", children }) {
  const [open, setOpen] = uiUseState(openByDefault);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 5, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", background: open ? "rgba(255,255,255,0.02)" : "transparent", border: "none", borderBottom: open ? "1px solid var(--border)" : "none", cursor: "pointer", textAlign: "left", color: "var(--text)" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: accent, transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}>▶</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, letterSpacing: "0.03em", flex: 1 }}>{label}</span>
        {count != null && <Tag border="var(--border)">{count}</Tag>}
      </button>
      {open && <div style={{ padding: 13 }}>{children}</div>}
    </div>
  );
}

window.UI = { Tag, Dot, ConfBadge, ConfOutline, SectionLabel, SignalBlock, Card, Collapse, CONF_COLOR, CONF_BG };
