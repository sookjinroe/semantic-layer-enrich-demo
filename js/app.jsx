// ============================================================
// 셸 — 상단 네비 + 화면 라우팅. 위치는 localStorage 유지.
// ============================================================
const { useState: aUseState, useEffect: aUseEffect } = React;

function App() {
  const [screen, setScreen] = aUseState(() => localStorage.getItem("demo_screen") || "home");
  aUseEffect(() => { localStorage.setItem("demo_screen", screen); }, [screen]);
  aUseEffect(() => { window.scrollTo(0, 0); }, [screen]);

  const nav = (s) => setScreen(s);
  const mono = { fontFamily: "var(--mono)" };

  const NavTab = ({ id, label, color }) => {
    const on = screen === id;
    return (
      <button onClick={() => nav(id)} style={{
        ...mono, fontSize: 13, padding: "6px 14px", borderRadius: 4, cursor: "pointer", letterSpacing: "0.02em",
        border: `1px solid ${on ? (color || "var(--accent)") + "77" : "transparent"}`,
        background: on ? (color || "var(--accent)") + "1c" : "transparent",
        color: on ? (color || "var(--accent)") : "var(--muted)",
      }}>{label}</button>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* 상단 네비 */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(12,14,17,0.86)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 24px", height: 54, display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => nav("home")} style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <span style={{ width: 11, height: 11, borderRadius: 2, background: "var(--accent)", transform: "rotate(45deg)" }} />
            <span style={{ ...mono, fontSize: 13.5, color: "var(--text)", letterSpacing: "0.04em", fontWeight: 600 }}>Semantic Layer Agent</span>
          </button>
          <span style={{ width: 1, height: 20, background: "var(--border)" }} />
          <div style={{ display: "flex", gap: 4 }}>
            <NavTab id="home" label="개요" color="var(--accent)" />
            <NavTab id="render" label="Render" color="var(--sig)" />
            <NavTab id="link" label="Link" color="var(--accent)" />
          </div>
          <span style={{ flex: 1 }} />
          <span style={{ ...mono, fontSize: 10.5, color: "var(--dim)", letterSpacing: "0.08em" }}>LIVE · 실제 모델 판단</span>
        </div>
      </div>

      {/* 화면 */}
      {screen === "home" && <window.HomeScreen nav={nav} />}
      {screen === "render" && <window.RenderScreen />}
      {screen === "link" && <window.LinkScreen />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
