// ============================================================
// 홈 '준비된 입력 자료' 라이브러리 컴포넌트 — Link 신호 / Render 소스.
// window.HomeLib 로 노출. 모든 데이터는 fixture 원본 그대로.
// ============================================================
const { useState: libUseState } = React;

// ---------- Link 신호 라이브러리 ----------
function LinkDataLib({ L, U, lineageGroups, biByType, mono }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      {/* Term 라이브러리 */}
      <U.Collapse label="Term 라이브러리 (사전)" count={L.LIBRARY.length} openByDefault accent="var(--accent)">
        <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--sans)", marginBottom: 11, lineHeight: 1.55 }}>
          Matcher가 검색·매칭하는 기존 Term. 정답 외에 <b style={{ color: "var(--text)" }}>근접오답(distractor)</b>이 섞여 있어 매칭이 자명하지 않다.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {L.LIBRARY.map((t) => (
            <div key={t.name + t.domain} style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "9px 11px", background: "rgba(0,0,0,0.18)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ ...mono, fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", flexShrink: 0 }}>{t.name}</span>
                <U.Tag border="var(--border)">{t.domain}</U.Tag>
                {t.values && <U.Tag bg="rgba(232,179,65,0.1)" fg="var(--accent)">허용값 {Object.keys(t.values).length}</U.Tag>}
                {t.linked.length > 0 && <U.Tag bg="rgba(106,169,224,0.1)" fg="var(--sig)">연결됨</U.Tag>}
                {t.note && <U.Tag bg="rgba(224,107,94,0.1)" fg="var(--low)">근접오답 주의</U.Tag>}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--sans)", lineHeight: 1.5 }}>{t.def}</div>
              {t.values && <div style={{ ...mono, fontSize: 11, color: "var(--accent)", marginTop: 4 }}>{Object.entries(t.values).map(([k, v]) => `${k}=${v}`).join("  ")}</div>}
              {t.note && <div style={{ fontSize: 11.5, color: "var(--low)", fontFamily: "var(--sans)", marginTop: 5, lineHeight: 1.5, opacity: 0.9 }}>↳ {t.note}</div>}
            </div>
          ))}
        </div>
      </U.Collapse>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* BI 자산 */}
        <U.Collapse label="BI 자산 (Looker / Tableau)" count={L.BI_ASSETS.length} openByDefault accent="var(--sig)">
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--sans)", marginBottom: 11, lineHeight: 1.55 }}>
            BI 도구 메타데이터. 필드·지표·대시보드가 물리 컬럼을 참조한다. Link는 이 참조를 <b style={{ color: "var(--text)" }}>역방향</b>으로 읽어 사용 신호를 얻는다. 라벨은 깨끗할 수도(<span style={{ color: "var(--text)" }}>세금면제 여부</span>) 무의미할 수도(<span style={{ color: "var(--low)" }}>dim_07</span>) 있다.
          </div>
          {["field", "metric", "dashboard"].map((ty) => (
            <div key={ty} style={{ marginBottom: 11 }}>
              <div style={{ ...mono, fontSize: 10.5, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>{ty} · {biByType[ty].length}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {biByType[ty].map((b) => {
                  const junk = /^dim_|^측정값/.test(b.label);
                  return (
                    <div key={b.id} style={{ display: "flex", gap: 9, alignItems: "baseline", fontSize: 11.5, fontFamily: "var(--sans)" }}>
                      <span style={{ ...mono, fontSize: 11.5, color: junk ? "var(--low)" : "var(--text)", minWidth: 110, flexShrink: 0, whiteSpace: "nowrap" }}>{b.label}</span>
                      <span style={{ ...mono, fontSize: 10.5, color: "var(--dim)", flexShrink: 0, minWidth: 50 }}>{b.tool}</span>
                      <span style={{ color: "var(--muted)", lineHeight: 1.5 }}>{b.references.map((r) => r.split(".")[1]).join(", ")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </U.Collapse>

        {/* 계보 */}
        <U.Collapse label="계보 (Lineage)" count={Object.keys(lineageGroups).length + " 상류"} accent="var(--lin)">
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--sans)", marginBottom: 11, lineHeight: 1.55 }}>
            같은 변환(upstream)에서 함께 파생된 컬럼들. 타입이 달라도 같은 배치에서 나왔다면 개념적 친연성의 신호가 된다.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(lineageGroups).filter(([up]) => up !== "(상류 없음)").map(([up, cols]) => (
              <div key={up} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                <span style={{ ...mono, fontSize: 11, color: "var(--lin)", minWidth: 168, flexShrink: 0 }}>{up}</span>
                <span style={{ ...mono, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>{cols.map((c) => c.asset.split(".")[1]).join(", ")}</span>
              </div>
            ))}
          </div>
        </U.Collapse>
      </div>
    </div>
  );
}

// ---------- Render 소스 라이브러리 ----------
function RenderDataLib({ R, U, mono }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      {/* 좌: DB + Catalog */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <U.Collapse label="DB 층 — schema.sql" openByDefault accent="var(--sig)">
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--sans)", marginBottom: 11, lineHeight: 1.55 }}>
            DB는 <b style={{ color: "var(--text)" }}>형태(form)</b>만 준다. 컬럼 코멘트·샘플데이터 없음 — 의미는 DB 밖(Code/Catalog)에 있다.
          </div>
          <pre style={{ ...mono, fontSize: 10.8, lineHeight: 1.55, color: "var(--text)", background: "rgba(0,0,0,0.28)", border: "1px solid var(--border)", borderRadius: 4, padding: "11px 12px", margin: 0, overflowX: "auto", whiteSpace: "pre" }}>{R.SCHEMA_SQL}</pre>
        </U.Collapse>

        <U.Collapse label="Catalog 층 — 용어집 Term" count={Object.keys(R.CATALOG).length + " link"} accent="var(--accent)">
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--sans)", marginBottom: 11, lineHeight: 1.55 }}>
            도메인·용어집 Term·term-link. 분류(Classification)와 기존 Description은 의도적으로 비어 있다 — PII는 Catalog가 아니라 Code의 어노테이션이 확정한다.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {Object.entries(R.CATALOG).map(([asset, e]) => (
              <div key={asset} style={{ border: "1px solid var(--border)", borderRadius: 4, padding: "9px 11px", background: "rgba(0,0,0,0.18)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ ...mono, fontSize: 11.5, color: "var(--dim)" }}>{asset.split(".")[1]}</span>
                  <span style={{ ...mono, fontSize: 10 }}>→</span>
                  <span style={{ ...mono, fontSize: 12.5, color: "var(--accent)", whiteSpace: "nowrap", flexShrink: 0 }}>{e.term.name}</span>
                  {e.term.values
                    ? <U.Tag bg="rgba(78,201,138,0.1)" fg="var(--high)">허용값 정의됨</U.Tag>
                    : <U.Tag bg="rgba(224,107,94,0.1)" fg="var(--low)">허용값 미정</U.Tag>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--sans)" }}>{e.term.def}</div>
                {e.term.values && <div style={{ ...mono, fontSize: 11, color: "var(--accent)", marginTop: 4 }}>{Object.entries(e.term.values).map(([k, v]) => `${k}=${v}`).join("  ")}</div>}
              </div>
            ))}
          </div>
        </U.Collapse>
      </div>

      {/* 우: Code */}
      <U.Collapse label="Code 층 — code/*.java" count={R.CODE_FILES.length + " 파일"} openByDefault accent="var(--high)">
        <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--sans)", marginBottom: 11, lineHeight: 1.55 }}>
          의미를 떠먹이는 산문 주석은 제거했다. 값 의미는 <b style={{ color: "var(--text)" }}>Enum 리터럴</b>, PII는 <b style={{ color: "var(--text)" }}>@PersonalInfo 어노테이션</b>, 비즈니스 이름은 ORM 필드명에서 나온다 — 주석이 아니라 코드 구조에서 추론한다.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {R.CODE_FILES.map((f) => (
            <div key={f.file}>
              <div style={{ ...mono, fontSize: 11, color: "var(--high)", marginBottom: 4 }}>{f.file}</div>
              <pre style={{ ...mono, fontSize: 10.6, lineHeight: 1.5, color: "var(--text)", background: "rgba(0,0,0,0.28)", border: "1px solid var(--border)", borderRadius: 4, padding: "10px 11px", margin: 0, overflowX: "auto", whiteSpace: "pre" }}>{f.body}</pre>
            </div>
          ))}
        </div>
      </U.Collapse>
    </div>
  );
}

window.HomeLib = { LinkDataLib, RenderDataLib };
