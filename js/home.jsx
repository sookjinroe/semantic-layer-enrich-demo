// ============================================================
// 홈 화면 — 데모 개요 + 읽는 법 + 두 파이프라인 입구 + '준비된 입력 자료' 라이브러리.
// window.HomeScreen 으로 노출. props: { nav }
// ============================================================
const { useState: homeUseState } = React;

function HomeScreen({ nav }) {
  const U = window.UI, L = window.LinkData, R = window.RenderData;
  const HomeLogicSection = window.HomeLogicSection;
  const HomeSources = window.HomeSources;

  // 계보 맵: upstream 기준으로 클러스터 컬럼 묶기
  const lineageGroups = {};
  for (const c of L.CLUSTER) {
    const up = (c.lineage && c.lineage.upstream) || "(상류 없음)";
    (lineageGroups[up] = lineageGroups[up] || []).push(c);
  }

  const biByType = {
    field: L.BI_ASSETS.filter((b) => b.type === "field"),
    metric: L.BI_ASSETS.filter((b) => b.type === "metric"),
    dashboard: L.BI_ASSETS.filter((b) => b.type === "dashboard"),
  };

  const wrap = { maxWidth: 1180, margin: "0 auto", padding: "0 26px 80px" };
  const mono = { fontFamily: "var(--mono)" };

  // 데이터셋 탭 (Render 소스 / Link 신호)
  const [tab, setTab] = homeUseState("link");

  return (
    <div style={{ color: "var(--text)" }}>
      {/* 히어로 (compact) */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "linear-gradient(180deg, rgba(255,255,255,0.018), transparent)" }}>
        <div style={{ ...wrap, paddingTop: 44, paddingBottom: 34 }}>
          <div style={{ ...mono, fontSize: 11.5, letterSpacing: "0.22em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 16 }}>
            Semantic Layer · Enrichment Agent — 라이브 데모
          </div>
          <h1 style={{ fontSize: 33, lineHeight: 1.22, fontWeight: 600, margin: 0, letterSpacing: "-0.01em", maxWidth: 880, textWrap: "balance" }}>
            시맨틱 레이어 증강 에이전트
          </h1>
        </div>
      </div>

      <div style={wrap}>
        {/* ② 실행 진입 */}
        <div style={{ paddingTop: 40 }}>
          <SectionHead>실행</SectionHead>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 16 }}>
            <EntryCard kind="Render" color="var(--sig)" onClick={() => nav("render")}
              tagline="컬럼 → 비즈니스 Description"
              desc="DB·Catalog·Code를 한 칸씩 올라가며, 매 단계 신호가 충분한지 스스로 판단해 컬럼에 비즈니스 설명을 붙인다." />
            <EntryCard kind="Link" color="var(--accent)" onClick={() => nav("link")}
              tagline="연결 · 발견"
              desc="컬럼을 기존 Term에 연결하고, 못 붙인 잔여를 사용·계보 신호로 묶어 새 개념을 발견한다." />
          </div>
        </div>

        {/* ① 에이전트 로직 — 결정 흐름 */}
        <HomeLogicSection />

        {/* ③ 신호 & 가용 소스 */}
        <div style={{ paddingTop: 48 }}>
          <SectionHead>신호 & 가용 소스</SectionHead>
          <HomeSources U={U} L={L} R={R} lineageGroups={lineageGroups} />
        </div>

        {/* 신뢰도 범례 — 슬림 */}
        <div style={{ paddingTop: 36 }}>
          <ConfLegendStrip />
        </div>
      </div>
    </div>
  );
}

// ---- 보조 컴포넌트 ----
function SectionHead({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <span style={{ width: 3, height: 17, background: "var(--accent)", borderRadius: 2 }} />
      <h2 style={{ fontFamily: "var(--mono)", fontSize: 16.5, fontWeight: 600, margin: 0, letterSpacing: "0.01em", color: "var(--text)", whiteSpace: "nowrap" }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function EntryCard({ kind, color, tagline, desc, onClick }) {
  const [h, setH] = homeUseState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: "var(--panel)", border: `1px solid ${h ? color + "66" : "var(--border)"}`, borderRadius: 7, padding: "20px 22px", cursor: "pointer", transition: "border-color .14s", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: 9, background: color }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 600, letterSpacing: "0.02em" }}>{kind}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>· {tagline}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: h ? color : "var(--muted)", transition: "color .14s" }}>실행 →</span>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--muted)", margin: 0, fontFamily: "var(--sans)" }}>{desc}</p>
    </div>
  );
}

function ConfLegendStrip() {
  const chip = (c, name, desc) => (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 7 }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 3, background: `var(--${c})`, color: "#0c0e11" }}>{name}</span>
      <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--sans)" }}>{desc}</span>
    </span>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, padding: "13px 18px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 7 }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase" }}>신뢰도</span>
      {chip("high", "HIGH", "확신 · 자동 반영")}
      {chip("med", "MEDIUM", "검증 권장")}
      {chip("low", "LOW", "추측 · 신호 부재 → 사람 검토")}
      <span style={{ width: 1, height: 16, background: "var(--border)" }} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)", fontFamily: "var(--sans)" }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--sig)" }} /> 소스·신호
        <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--lin)", marginLeft: 8 }} /> 계보
      </span>
    </div>
  );
}

function DataTab({ children, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "var(--mono)", fontSize: 12.5, padding: "7px 15px", borderRadius: 4, cursor: "pointer",
      border: `1px solid ${active ? color + "77" : "var(--border)"}`,
      background: active ? color + "1f" : "transparent", color: active ? color : "var(--muted)", letterSpacing: "0.03em",
    }}>{children}</button>
  );
}

window.HomeSectionHead = SectionHead;
window.HomeScreen = HomeScreen;
