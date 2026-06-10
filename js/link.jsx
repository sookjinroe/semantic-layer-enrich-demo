// ============================================================
// Link 화면 — 2막 2트리거(① 연결 / ② 발견) + 영구 척추(catalog) + 잔여 트레이.
// 제어 흐름·모델 호출·에스컬레이션 조건은 link_harness.jsx 그대로(로직 동결).
// 구조:
//   · 좌측 = 두 막을 관통하는 영구 인덱스(카탈로그). 행 클릭 → 그 행의 추론 재조회.
//   · 우측 작업영역(sticky) = 잔여 트레이 + 무대.
//        - 1막: 컬럼별 조사 스레드(Render 동형). 잔여는 트레이에 적재.
//        - 2막: 트레이의 잔여가 수렴 보드로 조직(군집→개념).
//   · 라이브는 막 단위로 화면 점유, 사후는 단일 아카이브 + 연결/발견 필터.
// window.LinkScreen 으로 노출.
// ============================================================
const { useState: lUseState, useRef: lUseRef } = React;

const L_T = { search: 430, think: 520, req: 920, ev: 640, verdict: 440, between: 360, group: 520, judgeSig: 320, sigReveal: 560, thinkRead: 560, cps: 52 };

function LinkScreen() {
  const U = window.UI, L = window.LinkData, API = window.LiveAPI;
  const { col, tbl, byAsset } = L;
  const { StageRouter } = window.LinkPanelMod;

  const [phase, setPhase] = lUseState("idle");      // idle | filtering | matching | connected | discovering | done
  const [skips, setSkips] = lUseState([]);
  const [mlog, setMlog] = lUseState([]);            // [{asset, events, decision, term?, reason?, confidence, candidates}]
  const [assign, setAssign] = lUseState({});        // asset -> {kind:'match'|'disc', term/concept, confidence, decision?}
  const [residue, setResidue] = lUseState([]);      // [{asset, reason, reasoning}] — 1막이 못 붙인 것
  const [groups, setGroups] = lUseState([]);
  const [concepts, setConcepts] = lUseState([]);
  const [judgingIdx, setJudgingIdx] = lUseState(-1);
  const [liveJudge, setLiveJudge] = lUseState(null);
  const [clusterLive, setClusterLive] = lUseState(null); // ② 군집화 라이브: {gi, streaming} — 군집 형성 + basis 스트리밍
  const [placed, setPlaced] = lUseState([]);             // ② 단계에서 군집으로 이주(트레이→군집)한 컬럼
  const [err, setErr] = lUseState(null);
  const [retryNote, setRetryNote] = lUseState(null);
  const [devOpen, setDevOpen] = lUseState(false);
  const [busy, setBusy] = lUseState(false);
  const [activeAsset, setActiveAsset] = lUseState(null);
  const [activeEvents, setActiveEvents] = lUseState([]);
  const [justAssigned, setJustAssigned] = lUseState([]);
  const [filter, setFilter] = lUseState("all");     // 사후 패싯: all | match | disc

  const abortRef = lUseRef(false);
  const stopAll = () => { abortRef.current = true; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const needKind = (need) => (need.startsWith("term_detail:") ? "term_detail" : need);
  // 시간예산형 스트림 — 경과 시간 기준으로 노출 글자수를 계산해, 타이머 스로틀(백그라운드 탭)에서도
  // 1글자=1초로 느려지지 않고 한 틱에 따라잡는다. cps=초당 글자수.
  const stream = async (apply, full, cps = L_T.cps) => {
    const t = String(full || ""); if (!t) { apply(""); return; }
    const start = Date.now();
    for (;;) {
      const n = Math.min(t.length, Math.max(1, Math.floor((Date.now() - start) / 1000 * cps)));
      apply(t.slice(0, n));
      if (n >= t.length) break;
      await sleep(40);
    }
  };
  const onRetry = (attempt, delay, e) => setRetryNote(`일시 오류로 재시도 중… (${attempt}회, ${Math.round(delay / 100) / 10}s) ${e ? String(e.message || e).slice(0, 36) : ""}`);

  // ---------- ① 연결 (국면0 필터 + Matcher) ----------
  async function runConnect() {
    abortRef.current = false;
    setBusy(true); setErr(null); setRetryNote(null); setFilter("all");
    setSkips([]); setMlog([]); setAssign({}); setResidue([]); setGroups([]); setConcepts([]); setJudgingIdx(-1); setLiveJudge(null);
    setClusterLive(null); setPlaced([]);
    setActiveAsset(null); setActiveEvents([]); setJustAssigned([]);
    const RETRY = { onRetry };

    setPhase("filtering");
    const survivors = [], techs = [];
    for (const c of L.CLUSTER) (L.isTechnical(col(c.asset)) ? techs : survivors).push(c);
    for (const t of techs) { if (abortRef.current) break; await sleep(130); setSkips((s) => [...s, t.asset]); }
    await sleep(200);

    setPhase("matching");
    const res = [];
    try {
      for (const c of survivors) {
        if (abortRef.current) break;
        setActiveAsset(c.asset);
        const events = [];
        const sync = () => setActiveEvents([...events]);
        const push = (ev) => { events.push(ev); sync(); return events.length - 1; };
        const patch = (i, p) => { events[i] = { ...events[i], ...p }; sync(); };

        // Term 라이브러리 조회: 요청(읽을 시간) → 그 자리에서 실제 검색 → 완료+후보
        const si = push({ type: "search", status: "requesting" });
        await sleep(L_T.req);
        const gathered = { candidates: L.searchLibrary(c) };
        patch(si, { status: "done", candidates: gathered.candidates });
        await sleep(L_T.search);

        const provided = new Set();
        const steps = [];
        const evidence = [];
        let decided = null;

        try {
          for (let i = 0; i < 5; i++) {
            const exhausted = i > 0 && provided.size > 0;
            const ti = push({ type: "think", pending: true });
            const r = await API.complete(L.MATCHER_SYS, L.matcherUser(c, gathered, exhausted), RETRY);
            setRetryNote(null);
            patch(ti, { pending: false, text: "" });
            await stream((s) => patch(ti, { text: s }), r.reasoning || "(근거 없음)");
            await sleep(L_T.think);

            if (r.decision === "need" && r.need) {
              if (provided.has(r.need)) {
                const ti2 = push({ type: "think", pending: true });
                decided = await API.complete(L.MATCHER_SYS, L.matcherUser(c, gathered, true), RETRY);
                setRetryNote(null);
                patch(ti2, { pending: false, text: "" });
                await stream((s) => patch(ti2, { text: s }), decided.reasoning || "추가 증거로도 확정 불가");
                await sleep(L_T.think);
                if (decided.decision === "need") decided = { decision: "reject", reason: "no_match", reasoning: "추가 증거로도 확정 불가", confidence: "LOW" };
                break;
              }
              provided.add(r.need); steps.push(r.need);
              const kind = needKind(r.need);
              const ei = push({ type: "evidence", kind, need: r.need, reason: r.reasoning, status: "requesting" });
              await sleep(L_T.req);
              if (r.need === "fk") {
                const t = byAsset[c.fk];
                gathered.fk = t ? { target: c.fk, desc: t.desc, domain: t.domain, pk: t.pk } : { target: c.fk || "(없음)", desc: "(클러스터 밖)", domain: "?" };
                evidence.push({ kind: "fk", reason: r.reasoning, data: gathered.fk });
                patch(ei, { status: "done", data: gathered.fk });
              } else if (r.need === "usage") {
                gathered.usage = true;
                const text = L.usageText(c);
                evidence.push({ kind: "usage", reason: r.reasoning, text });
                patch(ei, { status: "done", text });
              } else if (r.need.startsWith("term_detail:")) {
                const nm = r.need.split(":")[1];
                const d = L.termDetail(nm);
                if (d) {
                  gathered.detail = d;
                  evidence.push({ kind: "term_detail", reason: r.reasoning, data: d });
                  patch(ei, { status: "done", data: d });
                } else {
                  // B3: 비실존(지어낸) Term 요청 — 없는 근거를 만들지 않고 '없음' 신호로 표기.
                  gathered.detailMissing = nm;
                  evidence.push({ kind: "term_detail", reason: r.reasoning, missing: nm });
                  patch(ei, { status: "done", missing: nm });
                }
              }
              await sleep(L_T.ev);
              continue;
            }
            decided = r; break;
          }
        } catch (me) {
          setRetryNote(null);
          const li = events.length - 1;
          if (li >= 0 && (events[li].pending || events[li].status === "requesting")) patch(li, { pending: false, status: "done" });
          decided = { decision: "reject", reason: "no_match", reasoning: "매칭 중 일시 오류로 자동 판단 미완 — 잔여로 이관(사람 검토).", confidence: "LOW" };
        }
        if (!decided) decided = { decision: "reject", reason: "no_match", reasoning: "추가 증거로도 확정 불가", confidence: "LOW" };

        push({ type: "verdict", decision: decided.decision, term: decided.term, reason: decided.reason, confidence: decided.confidence });
        await sleep(L_T.verdict);

        setMlog((m) => [...m, { asset: c.asset, events: [...events], steps, evidence, candidates: gathered.candidates, ...decided, need: undefined }]);
        if (decided.decision === "match") {
          setAssign((p) => ({ ...p, [c.asset]: { kind: "match", term: decided.term, confidence: decided.confidence } }));
        } else {
          const r = { asset: c.asset, reason: decided.reason || "no_match", reasoning: decided.reasoning || "" };
          res.push(r);
          setResidue((p) => [...p, r]);     // 잔여 트레이에 적재
        }
        await sleep(L_T.between);
      }
      setActiveAsset(null); setActiveEvents([]);
      setPhase(abortRef.current ? "idle" : "connected");
    } catch (e) {
      setErr(`재시도 후에도 실패: ${String(e.message || e)} — 잠시 후 다시 실행해 주세요.`);
      setRetryNote(null); setPhase("connected");
    }
    abortRef.current = false;
    setBusy(false);
  }

  // ---------- ② 발견 (Discoverer: 군집 → 판단). 연결의 잔여를 입력으로 ----------
  async function runDiscover() {
    if (!residue.length) return;
    abortRef.current = false;
    setBusy(true); setErr(null); setRetryNote(null); setFilter("all");
    setGroups([]); setConcepts([]); setJudgingIdx(-1); setLiveJudge(null);
    setClusterLive(null); setPlaced([]);
    setActiveAsset(null); setActiveEvents([]); setJustAssigned([]);
    // 이전 발견 배정 초기화(잔여는 다시 미배정 상태로)
    setAssign((p) => { const n = {}; for (const k in p) if (p[k].kind === "match") n[k] = p[k]; return n; });
    const RETRY = { onRetry };

    setPhase("discovering");
    try {
      let gs = [];
      try {
        const gResp = await API.complete(L.DISC_GROUP_SYS, L.discGroupUser(residue), RETRY);
        setRetryNote(null);
        gs = (gResp && gResp.groups) || [];
      } catch (ge) { setRetryNote(null); gs = []; }
      if (!gs.length) gs = residue.map((r) => ({ group_label: col(r.asset), columns: [r.asset] }));
      // 발견은 '잔여'에만 작용한다. 모델이 신호(공동참조 등)에서 본 '이미 연결된' 컬럼명을
      // 군집에 섞어오면 척추의 연결을 덮어쓰므로, 군집 컬럼을 잔여로 한정(결정이 아니라 적용 범위 가드).
      gs = gs.map((g) => ({ ...g, columns: (g.columns || []).filter((a) => residue.some((r) => r.asset === a)) })).filter((g) => g.columns.length);
      if (!gs.length) gs = residue.map((r) => ({ group_label: col(r.asset), columns: [r.asset] }));

      // ───────── ② 단계 A · 군집화 연출 ─────────
      // 군집을 '한 번에' 쏟지 않고 하나씩 형성한다: 칩이 트레이에서 군집으로 이주(placed) →
      // 그 군집의 '묶은 근거(basis)'가 스트리밍된다. basis도 그룹핑 모델의 추론 산출물이므로 글자로 흘린다.
      const formed = [];
      for (let gi = 0; gi < gs.length; gi++) {
        if (abortRef.current) break;
        formed.push({ ...gs[gi], basis: "" });          // basis는 아직 빈 채로 군집만 등장
        setGroups(formed.map((g) => ({ ...g })));
        setClusterLive({ gi, streaming: true });
        setPlaced((p) => [...p, ...gs[gi].columns]);     // 트레이 → 군집으로 칩 이주(트레이 드레인)
        await sleep(L_T.group);                          // 칩이 자리잡고 읽을 시간
        await stream((s) => { formed[gi] = { ...formed[gi], basis: s }; setGroups(formed.map((g) => ({ ...g }))); }, gs[gi].basis || "");
        setClusterLive({ gi, streaming: false });
        await sleep(L_T.between);
      }
      setClusterLive(null);
      if (abortRef.current) {
        // 중단: 연결 핸드오프 상태로 깨끗하게 복원
        setGroups([]); setConcepts([]); setPlaced([]);
        setPhase("connected"); abortRef.current = false; setBusy(false); return;
      }
      await sleep(L_T.group);

      // ───────── ② 단계 B · 군집별 판단 ─────────
      const gsFinal = formed;
      setGroups(gsFinal.map((g) => ({ ...g })));
      for (let gi = 0; gi < gsFinal.length; gi++) {
        if (abortRef.current) break;
        const g = gsFinal[gi];
        setJudgingIdx(gi);
        // 1) 신호를 컬럼별로 '한 개씩' 펼친다 — 많은 컬럼이 한꺼번에 쏟아지지 않게(읽기 가능)
        setLiveJudge({ gi, step: "signals", columns: g.columns, basis: g.basis, revealed: 0, reasoning: "", driving_signal: "", name: "", decision: "", confidence: "" });
        await sleep(L_T.judgeSig);
        for (let ci = 0; ci < g.columns.length; ci++) {
          setLiveJudge((p) => (p ? { ...p, revealed: ci + 1 } : p));
          await sleep(L_T.sigReveal);
        }
        // 2) 생각 — 실제 추론을 스트리밍
        setLiveJudge((p) => (p ? { ...p, step: "thinking", reasoning: "" } : p));
        let cpt;
        try {
          cpt = await API.complete(L.DISC_JUDGE_SYS, L.discJudgeUser(g, residue), RETRY);
          setRetryNote(null);
        } catch (je) {
          setRetryNote(null);
          cpt = { name: g.group_label, columns: g.columns, decision: "candidate", confidence: "LOW", driving_signal: "", reasoning: "신호 종합 중 일시 오류로 자동 판단을 완료하지 못했습니다 — 사람 검토가 필요합니다.", _failed: true };
        }
        if (!cpt.columns) cpt.columns = g.columns;
        // 판단이 군집 밖(이미 연결된) 컬럼을 끌어와도 잔여로 한정
        cpt.columns = (cpt.columns || g.columns).filter((a) => residue.some((r) => r.asset === a));
        if (!cpt.columns.length) cpt.columns = g.columns;
        await stream((s) => setLiveJudge((p) => (p ? { ...p, reasoning: s } : p)), cpt.reasoning || "");
        setLiveJudge((p) => (p ? { ...p, driving_signal: cpt.driving_signal || "" } : p));
        await sleep(L_T.thinkRead);
        // 3) 결과 — 개념 제안은 마지막에
        setLiveJudge((p) => (p ? { ...p, step: "verdict", name: cpt.name, decision: cpt.decision, confidence: cpt.confidence } : p));
        await sleep(L_T.verdict);
        setConcepts((p) => [...p, cpt]);
        const cols = cpt.columns || [];
        setAssign((p) => { const n = { ...p }; cols.forEach((a) => { if (n[a] && n[a].kind === "match") return; n[a] = { kind: "disc", concept: cpt.name, decision: cpt.decision, confidence: cpt.confidence }; }); return n; });
        // B2: judge가 군집의 일부 컬럼만 개념에 담아도 빠진 컬럼을 버리지 않는다 — 단독 candidate(검토)로 보존.
        const covered = new Set(cols);
        const dropped = g.columns.filter((a) => !covered.has(a) && residue.some((r) => r.asset === a));
        for (const a of dropped) {
          const stray = { name: null, columns: [a], decision: "candidate", confidence: "LOW", driving_signal: "군집 판단에서 누락됨", reasoning: "judge가 개념에 포함하지 않음 — 단독 검토로 보존(누락 방지)." };
          setConcepts((p) => [...p, stray]);
          setAssign((p) => ({ ...p, [a]: { kind: "disc", concept: "단독 검토", decision: "candidate", confidence: "LOW" } }));
        }
        setJustAssigned([...cols, ...dropped]);
        await sleep(650);
        setJustAssigned([]);
      }
      setLiveJudge(null); setJudgingIdx(-1);
      setPhase(abortRef.current ? "connected" : "done");
    } catch (e) {
      setErr(`재시도 후에도 실패: ${String(e.message || e)} — 잠시 후 다시 실행해 주세요.`);
      setRetryNote(null); setLiveJudge(null); setJudgingIdx(-1); setPhase("done");
    }
    abortRef.current = false;
    setBusy(false);
  }

  // ---------- 스냅샷: 시연용 즉시 로드 / 현재 상태 저장 ----------
  function loadSnapshot() {
    let s = window.LinkSnapshot;
    if (!s) { try { const raw = localStorage.getItem("link_snapshot_v1"); if (raw) s = JSON.parse(raw); } catch (e) {} }
    if (!s) { setErr("스냅샷이 없습니다 — 전체 실행 후 ‘저장’하거나 구운 스냅샷 파일이 필요합니다."); return; }
    setBusy(false); setErr(null); setRetryNote(null); setFilter("all");
    setSkips(s.skips || []); setMlog(s.mlog || []); setAssign(s.assign || {});
    setResidue(s.residue || []); setGroups(s.groups || []); setConcepts(s.concepts || []);
    setClusterLive(null); setPlaced([]);
    setJudgingIdx(-1); setLiveJudge(null); setActiveAsset(null); setActiveEvents([]); setJustAssigned([]);
    setPhase(s.phase || "done");
  }
  function saveSnapshot() {
    const s = JSON.stringify({ phase, skips, mlog, assign, residue, groups, concepts });
    try { localStorage.setItem("link_snapshot_v1", s); } catch (e) {}
    // 다운로드: 다른 브라우저/공유용으로 파일을 내려받아 업로드 → fixture로 굽는다.
    try {
      const blob = new Blob([s], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "snapshot.json";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {}
    setRetryNote(`스냅샷 저장됨 · ${s.length}B (localStorage + snapshot.json 다운로드)`);
  }

  // 집계
  const counts = { match: 0, propose: 0, review: 0, skip: skips.length };
  for (const v of Object.values(assign)) {
    if (v.kind === "match") counts.match++;
    else if (v.decision === "new_term" || v.decision === "link_existing") counts.propose++;
    else counts.review++;
  }
  // 트레이: 아직 군집/개념으로 이동·수렴되지 않은 잔여 (placed = ②단계에서 군집으로 이주됨)
  const trayResidue = residue.filter((r) => !placed.includes(r.asset) && !(assign[r.asset] && assign[r.asset].kind === "disc"));
  const canDiscover = (phase === "connected" || phase === "done") && residue.length > 0 && !busy;

  const phaseLabel = { idle: "대기", filtering: "기술 컬럼 필터", matching: "1막 · 연결", connected: "연결 완료 · 발견 대기", discovering: "2막 · 발견", done: "완료" }[phase];
  const mono = { fontFamily: "var(--mono)" };
  let lastTable = null;

  // 선택과 필터를 항상 일치시킨다 — 모순 상태(연결 보면서 발견 필터 등)를 만들지 않는다.
  const assetKind = (a) => { const v = assign[a]; return v ? v.kind : null; }; // 'match' | 'disc' | null
  const clickRow = (a) => {
    if (busy) return;
    // 행 종류가 현재 필터와 안 맞으면 필터를 '전체'로 해제
    if (filter !== "all" && assetKind(a) !== filter) setFilter("all");
    setActiveAsset((cur) => (cur === a ? null : a));
  };
  const clickFilter = (f) => {
    setFilter(f);
    // 활성 행 종류가 새 필터와 안 맞으면 활성 해제
    if (f !== "all" && activeAsset && assetKind(activeAsset) !== f) setActiveAsset(null);
  };
  const btn = (label, on, onClick, disabled, color) => (
    <button onClick={onClick} disabled={disabled} style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "7px 15px", borderRadius: 4, cursor: disabled ? "default" : "pointer", border: `1px solid ${disabled ? "var(--border)" : color}`, background: disabled ? "transparent" : `${color}1f`, color: disabled ? "var(--dim)" : color, opacity: disabled ? 0.55 : 1 }}>{label}</button>
  );

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "22px 24px 60px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: "0.18em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 5 }}>Link · 라이브 실행</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ ...mono, fontSize: 21, fontWeight: 600, margin: 0 }}>컬럼 → Term 연결 · 새 개념 발견</h2>
        </div>
      </div>

      {/* 컨트롤 바 — 2트리거 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderTop: "1px solid var(--border)", padding: "11px 0 9px" }}>
        <span style={{ ...mono, fontSize: 12, color: phase === "idle" ? "var(--muted)" : "var(--text)" }}>{phaseLabel}</span>
        {retryNote && <span style={{ fontSize: 11.5, color: "var(--med)", animation: "pulse 1s infinite", fontFamily: "var(--sans)" }}>↻ {retryNote}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ ...mono, fontSize: 11.5 }}>
          <span style={{ color: "var(--high)" }}>연결 {counts.match}</span> · <span style={{ color: "var(--text)" }}>발견 {counts.propose}</span> · <span style={{ color: "var(--muted)" }}>검토 {counts.review}</span> · <span style={{ color: "var(--dim)" }}>잔여 {trayResidue.length} · SKIP {counts.skip}</span>
        </span>
        {busy
          ? <button onClick={stopAll} title="실행 중단" style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "7px 16px", borderRadius: 4, cursor: "pointer", border: "1px solid var(--low)", background: "var(--low)1f", color: "var(--low)" }}>■ 중단</button>
          : <React.Fragment>
              {btn("① 연결 실행", true, runConnect, false, "var(--high)")}
              {btn("② 발견 실행", true, runDiscover, !canDiscover, "var(--accent)")}
            </React.Fragment>}
        <span style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "3px 3px" }} />
        <button onClick={loadSnapshot} disabled={busy} title="저장된 스냅샷으로 즉시 완료 화면 (모델 실행 없음)"
          style={{ fontFamily: "var(--mono)", fontSize: 12, padding: "7px 13px", borderRadius: 4, cursor: busy ? "default" : "pointer", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", opacity: busy ? 0.5 : 1 }}>⚡ 스냅샷 로드</button>
        <button onClick={() => setDevOpen((v) => !v)} title="스냅샷 유지보수"
          style={{ fontFamily: "var(--mono)", fontSize: 15, lineHeight: 1, padding: "4px 8px", borderRadius: 4, cursor: "pointer", border: `1px solid ${devOpen ? "var(--border)" : "transparent"}`, background: devOpen ? "var(--border)" : "transparent", color: "var(--dim)" }}>⋯</button>
      </div>

      {/* 숨김 트레이 — 스냅샷 유지보수(코드 수정 후 갱신용) */}
      {devOpen && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 11px", marginTop: 6, background: "var(--panel)", border: "1px dashed var(--border)", borderRadius: 6, ...mono, fontSize: 11 }}>
          <span style={{ color: "var(--dim)", letterSpacing: "0.05em" }}>스냅샷 유지보수 · 코드 수정 후 ①·② 실행 → 갱신 → 받은 파일 업로드</span>
          <span style={{ flex: 1 }} />
          {phase === "done" && !busy
            ? btn("⬇ 스냅샷 갱신(저장+다운로드)", true, saveSnapshot, false, "var(--sig)")
            : <span style={{ color: "var(--dim)" }}>완료(done) 상태에서만 — ①·② 실행 후 가능</span>}
        </div>
      )}

      {/* 범례 + 사후 필터 */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border)", padding: "7px 0", marginBottom: 16, ...mono, fontSize: 10.5, color: "var(--dim)" }}>
        <span style={{ color: "var(--muted)", letterSpacing: "0.06em" }}>행 읽는 법</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><U.Dot color="var(--high)" size={7} /> 신뢰도</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><U.Tag fg="var(--high)" border="var(--high)55">연결</U.Tag> 기존 Term</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><U.Tag fg="var(--accent)" border="var(--accent)55">발견</U.Tag> 새 개념(N:1)</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><U.Tag fg="var(--muted)" border="var(--border)">잔여</U.Tag> 발견 대기</span>
        <span style={{ flex: 1 }} />
        {(phase === "done") && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--muted)" }}>보기</span>
            {[["all", "전체"], ["match", "연결"], ["disc", "발견"]].map(([k, lab]) => (
              <span key={k} onClick={() => clickFilter(k)} style={{ cursor: "pointer", padding: "2px 8px", borderRadius: 3, border: `1px solid ${filter === k ? "var(--text)" : "var(--border)"}`, color: filter === k ? "var(--text)" : "var(--muted)" }}>{lab}</span>
            ))}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(290px, 0.82fr) minmax(440px, 1.3fr)", gap: 16, alignItems: "start" }}>
        {/* 좌: 영구 척추(카탈로그) */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
          {L.CLUSTER.map((c) => {
            const a = c.asset, v = assign[a], skipped = skips.includes(a);
            const head = tbl(a) !== lastTable; lastTable = tbl(a);
            const isActive = activeAsset === a;
            const isResidueRow = residue.some((r) => r.asset === a) && !(v && v.kind === "disc");
            const pulsing = isActive && busy;
            const flash = justAssigned.includes(a);
            const dotColor = skipped ? "var(--border)" : v ? U.CONF_COLOR[v.confidence] : "var(--dim)";
            // 사후 필터 디밍
            const dimmed = phase === "done" && filter !== "all" && !isActive && !(v && ((filter === "match" && v.kind === "match") || (filter === "disc" && v.kind === "disc")));

            return (
              <div key={a}>
                {head && <div style={{ ...mono, fontSize: 10.5, color: "var(--muted)", padding: "9px 12px 5px", borderTop: "1px solid var(--border)", letterSpacing: "0.08em", background: "rgba(0,0,0,0.15)" }}>{tbl(a)} <span style={{ color: "var(--dim)" }}>· {c.domain}</span></div>}
                <div className="row-hover" onClick={() => clickRow(a)} style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", cursor: busy ? "default" : "pointer",
                  opacity: skipped ? 0.4 : dimmed ? 0.32 : 1,
                  borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  background: isActive ? "rgba(232,179,65,0.06)" : flash ? "rgba(78,201,138,0.10)" : undefined,
                  transition: "background .4s, opacity .25s",
                }}>
                  <U.Dot color={dotColor} pulsing={pulsing} size={9} />
                  <span style={{ ...mono, fontSize: 12.5, flex: 1, color: skipped ? "var(--muted)" : "var(--text)" }}>{col(a)}</span>
                  {skipped
                    ? <U.Tag fg="var(--muted)">SKIP</U.Tag>
                    : v
                      ? <>
                          <U.Tag fg={v.kind === "match" ? "var(--high)" : "var(--accent)"} border={(v.kind === "match" ? "var(--high)" : "var(--accent)") + "55"}>{v.kind === "match" ? "연결" : "발견"}</U.Tag>
                          <span style={{ ...mono, fontSize: 11, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 104 }} title={(v.kind === "match" ? "연결: " : "발견: ") + (v.kind === "match" ? v.term : v.concept)}>{v.kind === "match" ? v.term : v.concept}</span>
                          <U.ConfBadge c={v.confidence} />
                        </>
                      : isResidueRow
                        ? <U.Tag fg="var(--muted)" border="var(--border)">잔여</U.Tag>
                        : <span style={{ ...mono, fontSize: 10.5, color: "var(--dim)" }}>{c.type}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 우: 작업영역 (sticky) — 잔여 트레이 + 무대 */}
        <div style={{ position: "sticky", top: 14, alignSelf: "start", display: "flex", flexDirection: "column", gap: 12, maxHeight: "calc(100vh - 30px)" }}>
          {trayResidue.length > 0 && (phase === "matching" || phase === "connected" || phase === "discovering") && (
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderLeft: "2px solid var(--accent)", borderRadius: 6, padding: "11px 13px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: "var(--accent)", transform: "rotate(45deg)" }} />
                <span style={{ ...mono, fontSize: 11.5, color: "var(--accent)", letterSpacing: "0.06em" }}>잔여 트레이</span>
                <span style={{ ...mono, fontSize: 11, color: "var(--text)" }}>{trayResidue.length}</span>
                <span style={{ ...mono, fontSize: 10.5, color: "var(--dim)" }}>· {phase === "discovering" ? "군집으로 이동 중" : phase === "matching" ? "연결 실패분 적재 중" : "발견 입력 대기"}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {trayResidue.map((r) => (
                  <span key={r.asset} className="trayPop" style={{ ...mono, fontSize: 11, color: "var(--text)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 8px", background: "rgba(0,0,0,0.25)" }}>{col(r.asset)}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden auto", minHeight: 200, flex: "1 1 auto" }}>
            <StageRouter {...{ U, L, phase, busy, skips, mlog, assign, residue, groups, concepts, judgingIdx, liveJudge, clusterLive, err, activeAsset, activeEvents, filter, onDiscover: runDiscover, canDiscover, onCardFocus: clickRow }} />
          </div>
        </div>
      </div>
    </div>
  );
}

window.LinkScreen = LinkScreen;
