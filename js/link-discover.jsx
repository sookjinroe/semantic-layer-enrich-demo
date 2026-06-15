// ============================================================
// Link · 2막(Discoverer) 수렴 보드 — 두 단계로 명확히 분리한다.
//   ① 군집화(clustering): 잔여 칩이 트레이에서 군집으로 이주하고, 군집마다
//      '묶은 근거(basis)'가 스트리밍된다. 개념·신뢰도는 아직 없다. (clusterLive)
//   ② 군집별 판단(judging): 군집을 하나씩 펼쳐 — 묶은 근거(전제) → 컬럼별 검증 신호
//      (사용·계보, 하나씩) → 생각(추론) → 개념 제안. 끝나면 접히고 다음 군집. (liveJudge)
// Render의 '재료 → 생각 → 결과' 리듬을 두 층위로 적용. Matcher 거부 사유는 기본 숨김.
// window.LinkDiscMod 로 노출.
// ============================================================

const LD_DECISION = { new_term: "신규 제안", link_existing: "기존 연결", candidate: "검토 요청" };
const LD_REJECT = { collision: "비슷한 이름의 Term이 있으나 의미가 다름", scope: "같은 개념군이나 입도(범위)가 안 맞음", no_match: "연결할 기존 Term 없음" };
const { useState: ldUseState } = React;
function ldMono() { return { fontFamily: "var(--mono)" }; }

// ── 묶은 근거(basis) 박스 — 1단계의 추론 산출물. forming이면 스트리밍, 그 외엔 '확정된 전제'. ──
function BasisBox({ basis, streaming, premise }) {
  const mono = ldMono();
  const empty = !basis;
  return (
    <div style={{ borderLeft: "2px solid var(--sig)", paddingLeft: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ ...mono, fontSize: 13, color: "var(--sig)", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{premise ? "묶은 신호 · 1단계 확정" : "이 컬럼들을 묶은 신호"}</span>
        {premise && <span style={{ ...mono, fontSize: 13, color: "var(--dim)" }}>✓</span>}
      </div>
      {empty && streaming
        ? <span style={{ fontSize: 15, color: "var(--muted)", fontStyle: "italic", animation: "pulse 1s infinite" }}>묶은 근거 쓰는 중…</span>
        : <div style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--text)", fontFamily: "var(--sans)" }}>
            {basis}{streaming && <span className="caret">▍</span>}
          </div>}
    </div>
  );
}

// ── 칩 줄 (수렴의 재료) ──
function Chips({ U, L, cols, pop }) {
  const { col } = L;
  const mono = ldMono();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {cols.map((a) => (
        <span key={a} className={pop ? "trayPop" : ""} style={{ ...mono, fontSize: 14, color: "var(--text)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 9px", background: "rgba(0,0,0,0.25)" }}>{col(a)}</span>
      ))}
    </div>
  );
}

// ── 컬럼별 검증 신호(사용·계보) — '판단'을 위해 들여다보는 재료. 하나씩 등장. ──
//    A: 컬럼당 카드 1개(내부 사용/계보 2행). B: 신호를 긴 문장 대신 라벨 칩으로.
//    Matcher 거부 사유는 여기 섞지 않고 별도 disclosure로 접어둔다.
function SigChip({ kind, value, tone }) {
  const c = tone === "lineage" ? "var(--lin)" : "var(--sig)";
  const tint = tone === "lineage" ? "rgba(178,145,230,0.10)" : "rgba(106,169,224,0.10)";
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 14, display: "inline-flex", gap: 6, alignItems: "baseline", borderRadius: 4, padding: "3px 9px", background: tint, border: `1px solid ${c}38`, maxWidth: "100%" }}>
      <span style={{ color: c, fontSize: 12, letterSpacing: "0.03em", flexShrink: 0 }}>{kind}</span>
      <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </span>
  );
}
function SigRow({ label, tone, chips }) {
  const c = tone === "lineage" ? "var(--lin)" : "var(--sig)";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, width: 46, flexShrink: 0, paddingTop: 4 }}>
        <span style={{ width: 5, height: 5, borderRadius: 5, background: c, flexShrink: 0 }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: c, letterSpacing: "0.04em" }}>{label}</span>
      </span>
      {chips.length
        ? <div style={{ display: "flex", flexWrap: "wrap", gap: 5, minWidth: 0 }}>{chips}</div>
        : <span style={{ fontSize: 14, color: "var(--dim)", fontFamily: "var(--sans)", paddingTop: 3 }}>신호 없음</span>}
    </div>
  );
}
function Verification({ U, L, cols, revealed, residue }) {
  const { col, byAsset } = L;
  const mono = ldMono();
  const [rejOpen, setRejOpen] = ldUseState(false);
  const visible = cols.slice(0, revealed == null ? cols.length : revealed);
  const rejects = cols.map((a) => ({ a, rj: residue && residue.find((r) => r.asset === a) })).filter((x) => x.rj && (x.rj.reasoning || x.rj.reason));
  const total = cols.length;

  return (
    <div>
      <div style={{ ...mono, fontSize: 13, color: "var(--muted)", letterSpacing: "0.06em", marginBottom: 9 }}>수집 신호</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {visible.map((a, idx) => {
          const c = byAsset[a]; if (!c) return null;
          const sig = L.biSignals(a);
          const biChips = [];
          sig.metrics.forEach((m, i) => biChips.push(<SigChip key={"m" + i} kind="지표" value={m} tone="bi" />));
          sig.dashboards.forEach((d, i) => biChips.push(<SigChip key={"d" + i} kind="대시보드" value={d} tone="bi" />));
          sig.labels.forEach((l, i) => biChips.push(<SigChip key={"f" + i} kind="필드" value={l} tone="bi" />));
          sig.cooccur.forEach((x, i) => biChips.push(<SigChip key={"co" + i} kind="공동참조" value={col(x)} tone="bi" />));
          const lin = c.lineage || {};
          const linChips = [];
          if (lin.upstream) linChips.push(<SigChip key="u" kind="상류" value={lin.upstream} tone="lineage" />);
          (lin.derived_with || []).forEach((x, i) => linChips.push(<SigChip key={"p" + i} kind="파생" value={col(x)} tone="lineage" />));
          return (
            <div key={a} className="fadeIn" style={{ borderTop: idx > 0 ? "1px solid var(--border-soft)" : "none", paddingTop: idx > 0 ? 11 : 0, paddingBottom: 11 }}>
              <div style={{ ...mono, fontSize: 14.5, color: "var(--text)", marginBottom: 8 }}>{col(a)} <span style={{ color: "var(--dim)" }}>· {c.type}</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <SigRow label="usage" tone="bi" chips={biChips} />
                <SigRow label="lineage" tone="lineage" chips={linChips} />
              </div>
            </div>
          );
        })}
        {revealed != null && revealed < total && (
          <div style={{ ...mono, fontSize: 14.5, color: "var(--muted)", animation: "pulse 1s infinite", paddingTop: 4 }}>다음 컬럼 신호 읽는 중… ({revealed}/{total})</div>
        )}
      </div>

      {/* Matcher 거부 사유 — 기본 숨김, 확인하고 싶을 때만 펼침 */}
      {rejects.length > 0 && (revealed == null || revealed >= total) && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setRejOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", textAlign: "left", background: "transparent", border: "1px dashed var(--border)", borderRadius: 4, padding: "6px 9px", cursor: "pointer" }}>
            <span style={{ ...mono, fontSize: 12.5, color: "var(--muted)", transition: "transform .15s", transform: rejOpen ? "rotate(90deg)" : "none" }}>▶</span>
            <span style={{ ...mono, fontSize: 12.5, color: "var(--muted)", letterSpacing: "0.04em", flex: 1 }}>① 연결에서 보류한 이유</span>
            <span style={{ ...mono, fontSize: 12, color: "var(--dim)", border: "1px solid var(--border)", borderRadius: 3, padding: "0 6px" }}>{rejects.length}</span>
          </button>
          {rejOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 7 }}>
              {rejects.map(({ a, rj }) => (
                <U.SignalBlock key={a} tone="reject" mono={false} title={`${col(a)} · ${LD_REJECT[rj.reason] || "보류"}`} body={rj.reasoning || "Matcher가 판단을 보류해 사람 검토로 넘김"} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 한 군집 카드 — mode로 표현을 가른다 ──
//    forming  : ① 군집화 중(스트리밍 basis). 칩 + 묶은 근거만.
//    waiting  : ② 판단 대기. 칩 + 묶은 근거(전제), 디밍.
//    judging  : ② 판단 중(펼침). 전제 → 검증 신호(하나씩) → 생각 → 결과.
//    done     : ② 판단 끝(접힘). 칩 + 결과(+가른 신호).
//    review   : 사후 행 클릭. judging과 동일 레이아웃을 개념 데이터로 전부 노출.
function ConvergeNode({ U, L, group, gi, concept, live, mode, residue, onFocus }) {
  const mono = ldMono();
  const cardRef = React.useRef(null);
  const cols = (live && live.columns) || (concept && concept.columns) || group.columns || [];
  const basis = group.basis || (live && live.basis);
  const label = group.group_label;
  const focusAsset = cols[0];
  const clickable = mode === "done" && onFocus;

  const expanded = mode === "judging" || mode === "review";
  const step = live ? live.step : "verdict";
  const showThinking = expanded && (mode === "review" || step === "thinking" || step === "verdict");
  const showVerdict = mode === "done" || mode === "review" || (mode === "judging" && step === "verdict");
  const reasoning = live ? live.reasoning : (concept && concept.reasoning);
  const driving = live ? live.driving_signal : (concept && concept.driving_signal);
  const name = live ? live.name : (concept && concept.name);
  const decision = live ? live.decision : (concept && concept.decision);
  const confidence = live ? live.confidence : (concept && concept.confidence);
  const confColor = (showVerdict && confidence) ? U.CONF_COLOR[confidence] : "var(--border)";
  // 신뢰도는 스파인 대신 타이틀 앞 점으로 — 카탈로그 행·연결 카드와 통일.
  const titleDot = (showVerdict && confidence) ? U.CONF_COLOR[confidence] : (mode === "forming" ? "var(--sig)" : mode === "judging" ? "var(--med)" : "var(--dim)");

  // 외곽: 펼친 카드는 sig 강조, 그 외 절제.
  const frameCol = expanded ? "var(--sig)" : "var(--border)";
  const dim = mode === "waiting";
  const decLabel = decision ? (LD_DECISION[decision] || decision) : null;
  const titleName = name || label || `군집 ${gi + 1}`;
  const titleProvisional = !name; // 개념 확정 전仔 임시 라벨을 타이틀로(흐리게)

  // 펼쳐진 카드(review)를 패널 안에서 부드럽게 보이게 — 목록이 길 때 선택한 게 화면 밖이면 이동.
  React.useEffect(() => {
    if (mode !== "review" || !cardRef.current) return;
    const el = cardRef.current;
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      const oy = getComputedStyle(sc).overflowY;
      if (oy === "auto" || oy === "scroll") break;
      sc = sc.parentElement;
    }
    if (!sc || sc === document.body) return;
    const r = el.getBoundingClientRect(), cr = sc.getBoundingClientRect();
    if (r.top < cr.top + 4 || r.top > cr.bottom - 60) {
      sc.scrollTo({ top: sc.scrollTop + (r.top - cr.top) - 10, behavior: "smooth" });
    }
  }, [mode]);

  return (
    <div ref={cardRef} className={clickable ? "discCard" : undefined} onClick={clickable ? () => onFocus(focusAsset) : undefined} style={{
      border: `1px solid ${frameCol}`,
      borderRadius: 6, background: "rgba(0,0,0,0.18)", overflow: "hidden",
      opacity: dim ? 0.6 : 1, transition: "opacity .3s, border-color .3s",
      cursor: clickable ? "pointer" : "default",
    }}>
      {/* 헤더 — 연결 카드와 동일한 헤더 바: 타이틀=개념(또는 임시 라벨), 서브=군집N·컬럼N·결정·신뢰도 */}
      <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <U.Dot color={titleDot} size={9} pulsing={mode === "judging" && step !== "verdict"} />
          <span style={{ ...mono, fontSize: 17, color: titleProvisional ? "var(--muted)" : "var(--text)", fontStyle: titleProvisional ? "italic" : "normal", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titleName}</span>
          <span style={{ flex: 1 }} />
          {mode === "done" && <span style={{ ...mono, fontSize: 13, color: "var(--dim)" }}>▾</span>}
          {mode === "review" && onFocus && <span onClick={(e) => { e.stopPropagation(); onFocus(focusAsset); }} style={{ ...mono, fontSize: 12.5, color: "var(--muted)", cursor: "pointer", border: "1px solid var(--border)", borderRadius: 3, padding: "0 7px", lineHeight: "18px" }}>접기 ▴</span>}
        </div>
        <div style={{ ...mono, fontSize: 13, color: "var(--muted)", marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span>군집 {gi + 1}</span>
          <span style={{ color: "var(--dim)" }}>·</span>
          <span>컬럼 {cols.length}</span>
          {mode === "forming" && <React.Fragment><span style={{ color: "var(--dim)" }}>·</span><span style={{ color: "var(--sig)" }}>묶는 중</span></React.Fragment>}
          {mode === "waiting" && <React.Fragment><span style={{ color: "var(--dim)" }}>·</span><span>판단 대기</span></React.Fragment>}
          {mode === "judging" && step !== "verdict" && <React.Fragment><span style={{ color: "var(--dim)" }}>·</span><span style={{ color: "var(--med)", animation: "pulse 1s infinite" }}>판단 중…</span></React.Fragment>}
          {showVerdict && decLabel && <React.Fragment><span style={{ color: "var(--dim)" }}>·</span><span>{decLabel}</span><U.ConfBadge c={confidence} /></React.Fragment>}
        </div>
      </div>

      {/* 칩 — forming에서만 pop(이주 연출) */}
      <div style={{ padding: "12px 15px 11px" }}>
        <Chips U={U} L={L} cols={cols} pop={mode === "forming"} />
      </div>

      {/* 묶은 근거 — forming은 스트리밍, 그 외(전제) */}
      {(mode === "forming" || mode === "waiting" || expanded) && (
        <div style={{ padding: "0 15px 12px" }}>
          <BasisBox basis={basis} streaming={mode === "forming" && live == null && group._streaming} premise={mode !== "forming"} />
        </div>
      )}

      {/* 검증 신호 — 판단 단계에서만(전제와 공간적으로 분리) */}
      {(mode === "judging" || mode === "review") && (
        <div style={{ padding: "13px 15px", borderTop: "1px solid var(--border-soft)" }}>
          <Verification U={U} L={L} cols={cols} revealed={live ? (live.revealed || 0) : null} residue={residue} />
        </div>
      )}

      {/* 생각 — 라벨 없이: '생각 중…' → 추론 스트림으로 전환(Render 참조) */}
      {showThinking && (
        <div style={{ padding: "13px 15px", borderTop: "1px solid var(--border-soft)" }}>
          {reasoning
            ? <span style={{ fontSize: 16, lineHeight: 1.68, color: "#aab1bd", fontFamily: "var(--sans)" }}>{reasoning}{live && step === "thinking" && <span className="caret">▍</span>}</span>
            : <span style={{ fontSize: 15.5, color: "var(--muted)", fontStyle: "italic", fontFamily: "var(--sans)", animation: "pulse 1.1s infinite" }}>생각 중…</span>}
        </div>
      )}

      {/* 결과 상세 — 개념명·결정·신뢰도는 헤더에. 본문엔 '판단을 가른 신호'·매칭 Term만. */}
      {showVerdict && (driving || (expanded && concept && concept.matched_term)) && (
        <div style={{ padding: "12px 15px 13px", borderTop: "1px solid var(--border-soft)" }}>
          {expanded && concept && concept.matched_term && <div style={{ ...mono, fontSize: 14.5, color: "var(--muted)", marginBottom: driving ? 6 : 0 }}>매칭 Term: "{concept.matched_term}"</div>}
          {driving && (
            <div>
              <div style={{ ...mono, fontSize: 12.5, color: "var(--muted)", letterSpacing: "0.04em", marginBottom: 4 }}>제안 근거</div>
              <div style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--text)", fontFamily: "var(--sans)" }}>{driving}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 두 단계 스테퍼 ──
function Stepper({ stage }) {
  const mono = ldMono();
  // stage: 1 = 군집화, 2 = 판단, 0 = done(둘 다 완료)
  const Step = ({ n, label, state }) => {
    const on = state === "active";
    const done = state === "done";
    const c = on ? "var(--accent)" : done ? "var(--high)" : "var(--dim)";
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ ...mono, fontSize: 12, width: 16, height: 16, lineHeight: "15px", textAlign: "center", borderRadius: 8, border: `1px solid ${c}`, color: on ? "#0c0e11" : c, background: on ? "var(--accent)" : "transparent" }}>{done ? "✓" : n}</span>
        <span style={{ ...mono, fontSize: 13, color: c, letterSpacing: "0.03em" }}>{label}</span>
      </span>
    );
  };
  const s1 = stage === 1 ? "active" : "done";
  const s2 = stage === 2 ? "active" : stage === 0 ? "done" : "idle";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Step n="1" label="군집화" state={s1} />
      <span style={{ width: 18, height: 1, background: "var(--border)" }} />
      <Step n="2" label="군집별 판단" state={s2} />
    </div>
  );
}

// 보드 — ① 군집화(clusterLive) + ② 판단(liveJudge) + 사후 리뷰(focusConcept) + payoff
function DiscoveryWorkspace({ U, L, phase, groups, concepts, judgingIdx, liveJudge, clusterLive, focusConcept, residue, residueCount, onCardFocus }) {
  const mono = ldMono();
  const gl = groups || [];
  const cl = concepts || [];
  const single = focusConcept != null;
  const grouping = phase === "discovering" && gl.length === 0 && !clusterLive;
  const clustering = !!clusterLive;

  // 헤더 단계/카피 — 한 클러스터를 펼쳐도(focusConcept) 목록 전체·맥락은 그대로 유지
  let stage = 0, title = "발견 — 잔여에서 새 개념", sub = `잔여${residueCount != null ? ` ${residueCount}개` : ""}를 사용·계보 신호로 묶어 흩어진 컬럼을 하나의 개념으로 수렴`;
  if (grouping || clustering) { stage = 1; title = "발견 · 1단계 — 군집화"; sub = "잔여를 사용·계보 신호로 묶고, 군집마다 '묶은 근거'를 제시합니다"; }
  else if (phase === "discovering") { stage = 2; title = "발견 · 2단계 — 군집별 개념 판단"; sub = "군집을 하나씩 펼쳐 신호를 종합 → 개념을 제안합니다"; }

  const conceptFor = (g) => cl.find((c) => {
    const a = (c.columns || g.columns || [])[0];
    return (g.columns || []).includes(a);
  });

  return (
    <div>
      {/* 가벼운 캐션 — 카드 헤더가 아니다(군집 카드가 곀 단일 카드). 제목 + 스테퍼. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 16px 0" }}>
        <div style={{ ...mono, fontSize: 14.5, letterSpacing: "0.06em", color: "var(--muted)" }}>{title}</div>
        <span style={{ flex: 1 }} />
        <Stepper stage={stage} />
      </div>

      <div style={{ padding: "15px 16px 12px" }}>
        {grouping && <div style={{ ...mono, fontSize: 15, color: "var(--accent)", animation: "pulse 1s infinite" }}>잔여를 usage·lineage 신호로 군집화 중…</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, alignItems: "start" }}>
          {gl.map((g, i) => {
            const cpt = conceptFor(g);
            const live = liveJudge && liveJudge.gi === i ? liveJudge : null;

            // mode 결정 — focusConcept가 있으면 그 카드만 펼침(review), 나머지는 접힌 채로 목록에 남는다.
            let mode;
            if (clustering) mode = "forming";
            else if (live) mode = "judging";
            else if (single && cpt === focusConcept) mode = "review";
            else if (cpt) mode = "done";
            else if (phase === "discovering") mode = "waiting";
            else mode = "done";

            // forming 중 현재 스트리밍 카드 표시
            const streamingThis = clustering && clusterLive.gi === i && clusterLive.streaming;
            const groupForCard = streamingThis ? { ...g, _streaming: true } : g;

            return (
              <div key={i}>
                <ConvergeNode U={U} L={L} group={groupForCard} gi={i} concept={live ? null : cpt} live={live} mode={mode} residue={residue} onFocus={onCardFocus} />
              </div>
            );
          })}
        </div>

        {!grouping && !clustering && gl.length === 0 && phase === "done" && (
          <div style={{ fontSize: 15.5, color: "var(--muted)", fontFamily: "var(--sans)" }}>잔여 컬럼이 없습니다 — 1막에서 모두 기존 Term에 연결되었습니다.</div>
        )}
      </div>
    </div>
  );
}

window.LinkDiscMod = { DiscoveryWorkspace };
