// ============================================================
// Render 화면 — 라이브 실행 + '추론 스레드' UI.
// 제어 흐름·모델 호출·에스컬레이션 조건은 render_harness.jsx 그대로(로직 동결).
// 표현만: 왼쪽 수직 스레드에 노드를 시간순으로 쌓는다.
//   · 행동(source): "Code 조회 요청" → (읽을 시간) → "조회 완료" + 데이터 카드(별 컴포넌트)
//   · 생각(think):  "생각 중…"(실제 모델 지연) → thinking 산문(중앙 상태로 스트리밍)
//   · 결과(answer): Description 을 스트리밍 → 우측 패널 + 좌측 목록에 동시 작성
// 스트리밍은 실행 루프에서 중앙 state로 흘려 좌·우가 같은 값을 읽어 동기화된다.
// (진짜 토큰 스트림은 환경상 불가 — complete은 완료 후 전체를 1회 반환. 받은 텍스트의 표시 스트리밍.)
// window.RenderScreen 으로 노출.
// ============================================================
const { useState: rUseState, useRef: rUseRef } = React;

// 읽을 시간(가짜 진행 아님 — 관객이 텍스트를 읽을 정도의 스테이징).
// live = 단일 실행(타이핑 + 느린 비트), batch = 전체 실행(즉시 표시로 빠르게 채움)
const R_T = {
  live:  { seed: 620, thinkRead: 560, reqHold: 1180, doneRead: 820, charMs: 15 },
  batch: { seed: 120, thinkRead: 160, reqHold: 360, doneRead: 220, charMs: 0 },
};

// 소스 조합 키 — DB는 항상 켜짐, Catalog/Code 토글에 따라 4개: db / db+catalog / db+code / db+catalog+code
const EMPTY = {};
function comboKey(cat, code) {
  return ["db", cat && "catalog", code && "code"].filter(Boolean).join("+");
}

function RenderScreen() {
  const U = window.UI, R = window.RenderData, API = window.LiveAPI;
  const { rkey: key, tableDomain } = R;

  const [srcCatalog, setSrcCatalog] = rUseState(true);
  const [srcCode, setSrcCode] = rUseState(true);
  // 조합별로 결과·활성행을 따로 보관 → 토글해도 리셋되지 않고 탭처럼 전환된다.
  const [resultsByCombo, setResultsByCombo] = rUseState({});
  const [activeByCombo, setActiveByCombo] = rUseState({});
  const [busy, setBusy] = rUseState(false);
  const [expandAll, setExpandAll] = rUseState(false);
  const [retryNote, setRetryNote] = rUseState(null);
  const [devOpen, setDevOpen] = rUseState(false);
  const abortRef = rUseRef(false);
  const stopAll = () => { abortRef.current = true; };

  // 현재 토글 상태가 곧 현재 조합. 표시용 results/active 는 그 조합의 버킷에서 읽는다.
  const combo = comboKey(srcCatalog, srcCode);
  const results = resultsByCombo[combo] || EMPTY;
  const active = activeByCombo[combo] || null;
  const setActive = (v) => setActiveByCombo((p) => ({ ...p, [combo]: v }));
  const storedN = Object.keys(resultsByCombo).filter((cb) => resultsByCombo[cb] && Object.keys(resultsByCombo[cb]).length).length;

  const onRetry = (attempt, delay, e) => setRetryNote(`일시 오류로 재시도 중… (${attempt}회, ${Math.round(delay / 100) / 10}s) ${e ? String(e.message || e).slice(0, 36) : ""}`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function setRes(k, patch) {
    setResultsByCombo((prev) => {
      const bucket = prev[combo] || {};
      return { ...prev, [combo]: { ...bucket, [k]: { ...(bucket[k] || {}), ...patch } } };
    });
  }

  function toggleSource(which) {
    if (busy) return;
    // 결과를 지우지 않는다 — 조합별 버킷이 살아있어 토글하면 해당 조합 결과로 자동 전환.
    if (which === "catalog") setSrcCatalog((v) => !v); else setSrcCode((v) => !v);
  }
  function viewColumn(c) { setActive(key(c)); }

  function signalText(c, source) {
    if (source === "db") return R.dbSignal(c);
    if (source === "catalog") return R.catalogSignal(c);
    if (source === "code") return R.codeSignal(c);
    return "";
  }

  async function runColumn(c, live = true) {
    const k = key(c);
    const T = live ? R_T.live : R_T.batch;
    setActive(k);
    const events = [];
    const sync = () => setRes(k, { events: [...events] });
    const push = (ev) => { events.push(ev); sync(); };
    const patchLast = (p) => { events[events.length - 1] = { ...events[events.length - 1], ...p }; sync(); };
    // 텍스트를 한 글자씩 흘린다(batch면 즉시). apply는 부분 문자열을 받아 상태에 반영.
    const stream = async (apply, full) => {
      const t = String(full || "");
      if (!live) { apply(t); return; }
      for (let n = 1; n <= t.length; n++) { apply(t.slice(0, n)); await sleep(T.charMs); }
    };

    setRes(k, { status: "running", events: [], confidence: null, description: null, error: null });

    // 제어 흐름은 원본과 동일. 표시 이벤트만 추가로 기록한다.
    const gathered = { db: R.dbSignal(c) };
    const fetched = ["db"];

    // 시드: DB 스키마는 요청한 게 아니라 처음부터 주어진 입력 (카드 원문은 타이핑 안 함)
    push({ type: "source", source: "db", given: true, status: "done", text: R.dbSignal(c) });
    await sleep(T.seed);

    try {
      for (let i = 0; i < 4; i++) {
        if (abortRef.current) { setRes(k, { status: "done" }); return; }
        const available = ["catalog", "code"].filter((s) => (s === "catalog" ? srcCatalog : srcCode) && !fetched.includes(s));

        // 생각 중 → thinking (멈춤의 무게는 여기, 실제 모델 지연). 텍스트는 스트리밍.
        push({ type: "think", pending: true });
        const resp = await API.complete(R.SYSTEM, R.userPrompt(c, gathered, available), { onRetry });
        setRetryNote(null);
        patchLast({ pending: false, text: "" });
        await stream((s) => patchLast({ text: s }), resp.thinking || "");
        await sleep(T.thinkRead);

        // 충분하거나, 더 볼 소스가 아예 없을 때만 종료
        if (resp.sufficient || available.length === 0) {
          let conf, desc;
          if (!resp.description) {
            push({ type: "think", pending: true });
            const fin = await API.complete(R.SYSTEM, R.userPrompt(c, gathered, []), { onRetry });
            setRetryNote(null);
            patchLast({ pending: false, text: "" });
            await stream((s) => patchLast({ text: s }), fin.thinking || "");
            await sleep(T.thinkRead);
            conf = fin.confidence || "LOW"; desc = fin.description || "(설명 생성 실패)";
          } else {
            conf = resp.confidence || "LOW"; desc = resp.description;
          }
          // 결과: confidence 확정 + Description 스트리밍 → 우측 패널 + 좌측 목록에 동시 작성
          push({ type: "answer", confidence: conf, description: "" });
          setRes(k, { status: "done", confidence: conf, description: "" });
          await stream((s) => {
            events[events.length - 1] = { ...events[events.length - 1], description: s };
            setRes(k, { events: [...events], description: s });
          }, desc);
          return;
        }

        // 불충분 + 남은 가용 소스 있음 → 절대 포기 안 함.
        // 모델이 고른 게 가용하면 그대로(순서는 모델이 정함). 가용 밖을 지목/누락하면 가용 소스로 보정(1개뿐이면 자연히 그것).
        const pick = available.includes(resp.need_source) ? resp.need_source : available[0];
        // 행동: 소스 요청(읽을 시간) → 조회 완료 + 데이터 카드
        push({ type: "source", source: pick, status: "requesting" });
        await sleep(T.reqHold);
        gathered[pick] = signalText(c, pick);
        fetched.push(pick);
        patchLast({ status: "done", text: gathered[pick] });
        await sleep(T.doneRead);
      }
      push({ type: "answer", confidence: "LOW", description: "(반복 한도 도달)" });
      setRes(k, { status: "done", confidence: "LOW", description: "(반복 한도 도달)" });
    } catch (e) {
      setRes(k, { status: "done", error: String(e.message || e), confidence: "LOW", description: null });
      setRetryNote(null);
    }
  }

  // 전체 실행: 미실행(또는 미완료)인 컬럼만 — 중단 후 다시 누르면 남은 것만 이어서 실행
  async function runAll() {
    abortRef.current = false; setBusy(true);
    for (const c of R.COLUMNS) {
      if (abortRef.current) break;
      const ex = results[key(c)];
      if (ex && ex.status === "done" && !ex.error) continue;
      await runColumn(c, false);
    }
    setBusy(false); abortRef.current = false;
  }
  async function runOne(c) { if (busy) return; abortRef.current = false; setBusy(true); await runColumn(c, true); setBusy(false); abortRef.current = false; }

  // ---------- 스냅샷: 시연용 즉시 로드 / 현재 상태 저장 (4조합 통째) ----------
  function loadSnapshot() {
    if (busy) return;
    let s = window.RenderSnapshot;
    if (!s) { try { const raw = localStorage.getItem("render_snapshot_v1"); if (raw) s = JSON.parse(raw); } catch (e) {} }
    if (!s) { setRetryNote("스냅샷이 없습니다 — 조합을 실행 후 ‘갱신’하거나 구운 스냅샷 파일이 필요합니다."); return; }
    abortRef.current = false; setBusy(false); setRetryNote(null); setExpandAll(false);
    setResultsByCombo(s.resultsByCombo || {});
    setActiveByCombo(s.activeByCombo || {});
    if (typeof s.srcCatalog === "boolean") setSrcCatalog(s.srcCatalog);
    if (typeof s.srcCode === "boolean") setSrcCode(s.srcCode);
  }
  function saveSnapshot() {
    const s = JSON.stringify({ resultsByCombo, activeByCombo, srcCatalog, srcCode });
    try { localStorage.setItem("render_snapshot_v1", s); } catch (e) {}
    // 다운로드: 공유용으로 파일을 내려받아 업로드 → fixture로 굽는다.
    try {
      const blob = new Blob([s], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "render_snapshot.json";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {}
    setRetryNote(`스냅샷 저장됨 · ${storedN}/4 조합 · ${s.length}B (localStorage + render_snapshot.json)`);
  }

  const counts = R.COLUMNS.reduce((a, c) => {
    const r = results[key(c)];
    if (r && r.status === "done" && r.confidence) a[r.confidence] = (a[r.confidence] || 0) + 1;
    return a;
  }, {});
  const doneCount = R.COLUMNS.filter((c) => results[key(c)] && results[key(c)].status === "done").length;

  const renderStatusColor = (r) => {
    if (!r || !r.status) return "var(--border)";
    if (r.status === "running") return "var(--accent)";
    if (r.error) return "var(--low)";
    return U.CONF_COLOR[r.confidence] || "var(--muted)";
  };

  const activeCol = active ? R.COLUMNS.find((c) => key(c) === active) : null;
  const mono = { fontFamily: "var(--mono)" };
  let lastTable = null;

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "22px 24px 60px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", color: "var(--sig)", textTransform: "uppercase", marginBottom: 5 }}>Render · 라이브 실행</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ ...mono, fontSize: 21, fontWeight: 600, margin: 0 }}>컬럼 → 비즈니스 Description</h2>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "11px 0", marginBottom: 16 }}>
        <span style={{ ...mono, fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>SOURCES</span>
        <SrcToggle on label="DB" fixed />
        <SrcToggle on={srcCatalog} label="Catalog" onClick={() => toggleSource("catalog")} />
        <SrcToggle on={srcCode} label="Code" onClick={() => toggleSource("code")} />
        <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 3px" }} />
        <SrcToggle on={expandAll} label="전체 로그" alt onClick={() => !busy && setExpandAll((v) => !v)} />
        {storedN > 1 && <span title="소스 조합마다 결과가 따로 저장됩니다" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--dim)", letterSpacing: "0.04em" }}>⧉ {storedN}/4 조합 저장됨</span>}
        {retryNote && <span style={{ fontSize: 11.5, color: "var(--med)", animation: "pulse 1s infinite", fontFamily: "var(--sans)" }}>↻ {retryNote}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ ...mono, fontSize: 11.5 }}>
          <span style={{ color: "var(--high)" }}>HIGH {counts.HIGH || 0}</span> · <span style={{ color: "var(--med)" }}>MED {counts.MEDIUM || 0}</span> · <span style={{ color: "var(--low)" }}>LOW {counts.LOW || 0}</span>
          <span style={{ color: "var(--dim)" }}>  ·  {doneCount}/{R.COLUMNS.length}</span>
        </span>
        {busy
          ? <button onClick={stopAll} title="실행 중단" style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "7px 16px", borderRadius: 4, cursor: "pointer", border: "1px solid var(--low)", background: "rgba(224,107,94,0.13)", color: "var(--low)" }}>■ 중단</button>
          : <RunBtn busy={false} onClick={runAll} label="전체 실행" />}
        <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "3px 3px" }} />
        <button onClick={loadSnapshot} disabled={busy} title="저장된 스냅샷으로 즉시 4조합 결과 (모델 실행 없음)"
          style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "7px 13px", borderRadius: 4, cursor: busy ? "default" : "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", opacity: busy ? 0.5 : 1 }}>⚡ 스냅샷 로드</button>
        <button onClick={() => setDevOpen((v) => !v)} title="스냅샷 유지보수"
          style={{ fontFamily: "var(--mono)", fontSize: 15, lineHeight: 1, padding: "4px 8px", borderRadius: 4, cursor: "pointer", border: `1px solid ${devOpen ? "var(--border)" : "transparent"}`, background: devOpen ? "var(--border)" : "transparent", color: "var(--dim)" }}>⋯</button>
      </div>

      {/* 숨김 트레이 — 스냅샷 유지보수(4조합 굽기) */}
      {devOpen && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 11px", marginTop: -8, marginBottom: 16, background: "var(--panel)", border: "1px dashed var(--border)", borderRadius: 6, fontFamily: "var(--mono)", fontSize: 11 }}>
          <span style={{ color: "var(--dim)", letterSpacing: "0.05em" }}>스냅샷 유지보수 · 4조합 모두 실행 → 갱신 → 받은 파일 업로드</span>
          <span style={{ flex: 1 }} />
          {storedN > 0 && !busy
            ? <button onClick={saveSnapshot} style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "7px 15px", borderRadius: 4, cursor: "pointer", border: "1px solid var(--sig)", background: "rgba(106,169,224,0.12)", color: "var(--sig)" }}>⬇ 스냅샷 갱신 ({storedN}/4)</button>
            : <span style={{ color: "var(--dim)" }}>{busy ? "실행 중…" : "조합 1개 이상 실행 후 가능"}</span>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 0.92fr) minmax(380px, 1.25fr)", gap: 16, alignItems: "start" }}>
        {/* 좌: 컬럼 목록 (결과·Description 인라인 동시 작성) */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          {R.COLUMNS.map((c) => {
            const k = key(c), r = results[k];
            const showHeader = c.t !== lastTable; lastTable = c.t;
            const sel = active === k;
            return (
              <div key={k}>
                {showHeader && (
                  <div style={{ ...mono, fontSize: 10.5, color: "var(--muted)", padding: "9px 12px 5px", borderTop: "1px solid var(--border)", letterSpacing: "0.08em", background: "rgba(0,0,0,0.15)" }}>
                    {c.t} <span style={{ color: "var(--dim)" }}>· {tableDomain(c.t)}</span>
                  </div>
                )}
                <div className="row-hover" onClick={() => viewColumn(c)} style={{ padding: "7px 12px", cursor: "pointer", borderLeft: sel ? "2px solid var(--accent)" : "2px solid transparent", background: sel ? "rgba(232,179,65,0.06)" : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <U.Dot color={renderStatusColor(r)} pulsing={r && r.status === "running"} size={9} />
                    <span style={{ ...mono, fontSize: 12.5, flex: 1 }}>{c.n}</span>
                    {r && r.status === "done" && r.confidence
                      ? <U.ConfBadge c={r.confidence} />
                      : <span style={{ ...mono, fontSize: 10.5, color: "var(--dim)" }}>{c.type}</span>}
                    <span onClick={(e) => { e.stopPropagation(); runOne(c); }} title={r && r.status === "done" ? "다시 실행" : "실행"}
                      style={{ ...mono, fontSize: 11, color: busy ? "var(--border)" : "var(--high)", border: `1px solid ${busy ? "var(--border)" : "var(--high)"}`, borderRadius: 3, padding: "0 6px", cursor: busy ? "default" : "pointer", lineHeight: "17px" }}>▷</span>
                  </div>
                  {r && r.description && (
                    <div style={{ marginLeft: 19, marginTop: 3, fontSize: 11.5, color: "var(--muted)", fontFamily: "var(--sans)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.description}>{r.description}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 우: 추론 스레드 */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", minHeight: 200 }}>
          <RenderPanel {...{ U, R, results, active, activeCol, expandAll }} />
        </div>
      </div>
    </div>
  );
}

// ---- 우측 패널 ----
function RenderPanel({ U, R, results, active, activeCol, expandAll }) {
  const { rkey: key } = R;

  const ColResult = (c, r, withHeader) => {
    const k = key(c);
    const evs = r.events || [];
    return (
      <div key={k}>
        {withHeader && (
          <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--border)", borderTop: withHeader === "first" ? "none" : "1px solid var(--border)", background: "rgba(0,0,0,0.15)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--text)" }}>{k}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{c.type}{c.fk ? ` · FK → ${c.fk}` : ""}{c.pk ? " · PK" : ""}</div>
          </div>
        )}
        <div style={{ padding: "16px 16px 6px" }}>
          {evs.map((ev, i) => <ThreadNode key={i} U={U} ev={ev} isLast={i === evs.length - 1} />)}
          {r.error && <div style={{ color: "var(--low)", fontSize: 12.5, fontFamily: "var(--mono)", paddingLeft: 30 }}>오류: {r.error}</div>}
        </div>
      </div>
    );
  };

  if (expandAll) {
    const ran = R.COLUMNS.filter((c) => results[key(c)]);
    if (!ran.length) return <Empty>아직 실행된 컬럼이 없습니다. 행의 <B>▷</B> 또는 <B>전체 실행</B>으로 돌린 뒤 여기서 전체 결과를 조회합니다.</Empty>;
    return <div>{ran.map((c, idx) => ColResult(c, results[key(c)], idx === 0 ? "first" : true))}</div>;
  }
  if (!active) {
    return (
      <div style={{ padding: 20, color: "var(--muted)", fontSize: 13, fontFamily: "var(--sans)", lineHeight: 1.7 }}>
        왼쪽 행을 <B>클릭</B>하면 그 컬럼의 결과를 조회합니다(실행 안 함). 행의 <B accent="var(--high)">▷</B>로 실행/재실행, 상단 <B>전체 실행</B>으로 일괄 실행.
      </div>
    );
  }
  const ar = results[active];
  if (!ar) {
    return (
      <div style={{ padding: 20, color: "var(--muted)", fontSize: 13, fontFamily: "var(--sans)" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--text)" }}>{active}</div>
        <div style={{ marginTop: 12 }}>아직 실행되지 않았습니다. 이 행의 <B accent="var(--high)">▷</B>를 눌러 실행하세요.</div>
      </div>
    );
  }
  return ColResult(activeCol, ar, true);
}

// ---- 스레드 노드: 왼쪽 게터(점+연결선) + 내용 ----
// A안: 소스는 범주형 — 하나의 절제된 쿨 톤으로 통일(정체는 라벨이 담당).
// 신호등 색(초록/앰버/빨강)은 신뢰도 전용으로 비워둔다.
const SRC_META = {
  db: { c: "var(--sig)" },
  catalog: { c: "var(--sig)" },
  code: { c: "var(--sig)" },
};
function nodeColor(ev, U) {
  if (ev.type === "source") return (SRC_META[ev.source] || { c: "var(--muted)" }).c;
  if (ev.type === "think") return "var(--dim)";
  if (ev.type === "answer") return U.CONF_COLOR[ev.confidence] || "var(--muted)";
  return "var(--muted)";
}

function ThreadNode({ U, ev, isLast }) {
  const color = nodeColor(ev, U);
  const isAnswer = ev.type === "answer";
  return (
    <div style={{ display: "flex", gap: 13 }}>
      {/* 게터: 점 + 연결선 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 14 }}>
        {isAnswer
          ? <span style={{ color, fontSize: 13, lineHeight: "16px", marginTop: 2 }}>✓</span>
          : <span style={{ width: 9, height: 9, borderRadius: 9, background: ev.type === "think" ? "transparent" : color, border: ev.type === "think" ? `2px solid ${color}` : "none", marginTop: 4, boxShadow: ev.pending || ev.status === "requesting" ? `0 0 0 4px ${color}22` : "none", animation: (ev.pending || ev.status === "requesting") ? "pulse 1.1s infinite" : "none" }} />}
        {!isLast && <span style={{ flex: 1, width: 2, background: "var(--border)", marginTop: 4, minHeight: 16 }} />}
      </div>
      {/* 내용 */}
      <div style={{ flex: 1, paddingBottom: isLast ? 4 : 16, minWidth: 0 }}>
        {ev.type === "source" && <SourceNode U={U} ev={ev} />}
        {ev.type === "think" && <ThinkNode ev={ev} />}
        {ev.type === "answer" && <AnswerNode U={U} ev={ev} />}
      </div>
    </div>
  );
}

const SRC_LABEL = {
  db: { req: "DB 스키마 읽는 중…", done: "DB 스키마" },
  catalog: { req: "Catalog 조회 요청", done: "Catalog 조회 완료" },
  code: { req: "Code 조회 요청", done: "Code 조회 완료" },
};

// 행동(조회): 상태 줄 + (완료 시) 데이터 카드 — 카드는 별 컴포넌트로 줄 아래 매달림
function SourceNode({ U, ev }) {
  const meta = SRC_META[ev.source] || { c: "var(--muted)" };
  const lab = SRC_LABEL[ev.source] || { req: "조회 요청", done: "조회 완료" };
  const requesting = ev.status === "requesting";
  const mono = { fontFamily: "var(--mono)" };
  return (
    <div style={{ paddingTop: 1 }}>
      {/* 상태 줄 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span key={ev.status} className="fadeIn" style={{ ...mono, fontSize: 12.5, letterSpacing: "0.03em", color: meta.c }}>
          {requesting ? lab.req : lab.done}
        </span>
        {ev.given && <span style={{ ...mono, fontSize: 10.5, color: "var(--dim)" }}>· 입력으로 주어짐</span>}
        {requesting && <span style={{ ...mono, fontSize: 10.5, color: "var(--dim)", animation: "pulse 1.1s infinite" }}>…</span>}
      </div>
      {/* 데이터 카드 (별 컴포넌트) */}
      {!requesting && (
        <pre className="ev" style={{ ...mono, fontSize: 11.5, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "8px 0 0", padding: "10px 12px", background: "rgba(0,0,0,0.26)", border: "1px solid var(--border)", borderLeft: `2px solid ${meta.c}`, borderRadius: 4 }}>{ev.text}</pre>
      )}
    </div>
  );
}

// 생각: 생각 중 → thinking 산문(중앙 상태로 스트리밍됨). 카드 없음.
function ThinkNode({ ev }) {
  return (
    <div style={{ paddingTop: 1 }}>
      {ev.pending && !ev.text
        ? <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--sans)", fontStyle: "italic", animation: "pulse 1.1s infinite" }}>생각 중…</span>
        : <span style={{ fontSize: 13.5, lineHeight: 1.68, color: "#aab1bd", fontFamily: "var(--sans)" }}>{ev.text}</span>}
    </div>
  );
}

// 결과: 최종 Description (스트리밍, 좌측 목록과 동기화)
function AnswerNode({ U, ev }) {
  return (
    <div style={{ paddingTop: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.06em" }}>최종 DESCRIPTION</span>
        <U.ConfBadge c={ev.confidence} />
      </div>
      <div style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--text)", fontFamily: "var(--sans)" }}>{ev.description}</div>
    </div>
  );
}

// ---- 작은 컨트롤 ----
function SrcToggle({ on, label, onClick, fixed, alt }) {
  const base = { fontFamily: "var(--mono)", fontSize: 11.5, padding: "5px 11px", borderRadius: 3, userSelect: "none", letterSpacing: "0.02em" };
  const colorOn = alt ? "var(--sig)" : "var(--accent)";
  return (
    <span onClick={onClick} title={fixed ? "항상 켜짐" : ""}
      style={{ ...base, cursor: fixed ? "default" : "pointer", border: `1px solid ${on ? colorOn + "77" : "var(--border)"}`, background: on ? colorOn + "1c" : "transparent", color: on ? colorOn : "var(--muted)" }}>
      {label} {on ? "●" : "○"}
    </span>
  );
}
function RunBtn({ busy, onClick, label }) {
  return (
    <button onClick={onClick} disabled={busy} style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "7px 16px", borderRadius: 4, cursor: busy ? "default" : "pointer", border: "1px solid var(--high)", background: busy ? "transparent" : "rgba(78,201,138,0.12)", color: "var(--high)", opacity: busy ? 0.6 : 1 }}>{busy ? "실행 중…" : `▷ ${label}`}</button>
  );
}
function Empty({ children }) { return <div style={{ padding: 20, color: "var(--muted)", fontSize: 13, fontFamily: "var(--sans)", lineHeight: 1.7 }}>{children}</div>; }
function B({ children, accent }) { return <b style={{ color: accent || "var(--text)" }}>{children}</b>; }

window.RenderScreen = RenderScreen;
