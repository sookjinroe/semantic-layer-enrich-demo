// ============================================================
// Link 우측 무대 라우터 — 무엇을 보여줄지 한 곳에서 결정.
//   · idle             → 두 트리거 안내
//   · 1막(라이브)      → 현재 컬럼의 조사 스레드(activeEvents)
//   · connected(대기)  → 연결 요약 + ② 발견 실행 핸드오프 프롬프트
//   · 2막(라이브)      → 수렴 보드(군집화→단계별 판단)
//   · 사후 + 행 선택   → match/reject 스레드 / 발견 개념(포커스)
//   · 사후 + 무선택    → 발견 보드(그리드 개요) = payoff
// window.LinkPanelMod 로 노출.
// ============================================================

function StageRouter({ U, L, phase, busy, skips, mlog, assign, residue, groups, concepts, judgingIdx, liveJudge, clusterLive, err, activeAsset, activeEvents, filter, onDiscover, canDiscover, onCardFocus }) {
  const { col, byAsset } = L;
  const { MatcherThread } = window.LinkThreadMod;
  const { DiscoveryWorkspace } = window.LinkDiscMod;
  const mono = { fontFamily: "var(--mono)" };
  const pad = { padding: 20, color: "var(--muted)", fontSize: 15.5, fontFamily: "var(--sans)", lineHeight: 1.75 };
  const residueCount = residue ? residue.length : 0;

  if (phase === "idle") {
    return (
      <div style={pad}>
        <b style={{ color: "var(--text)" }}>두 단계로 실행합니다.</b>
        <div style={{ marginTop: 10 }}><b style={{ color: "var(--high)" }}>① 연결</b>: 컬럼 하나를 기존 Term에 잇습니다. 애매하면 <span style={{ color: "var(--sig)" }}>BI 사용</span>·<span style={{ color: "var(--lin)" }}>FK</span>·<span style={{ color: "var(--sig)" }}>Term 상세</span> 증거를 스스로 더 가져와 확정합니다. 못 붙인 건 <b style={{ color: "var(--muted)" }}>잔여</b>로 모입니다.</div>
        <div style={{ marginTop: 8 }}><b style={{ color: "var(--accent)" }}>② 발견</b>: 잔여를 <span style={{ color: "var(--sig)" }}>사용</span>·<span style={{ color: "var(--lin)" }}>계보</span> 신호로 묶어, 흩어진 컬럼을 하나의 개념으로 수렴시켜 <i>제안</i>합니다(확정은 사람 검토).</div>
      </div>
    );
  }

  // 행이 선택돼 있으면 그 행의 추론을 보여준다 (라이브 추적 또는 사후 리뷰)
  if (activeAsset) {
    if (skips.includes(activeAsset)) {
      const c = byAsset[activeAsset];
      return (
        <div style={pad}>
          <div style={{ ...mono, fontSize: 17, color: "var(--text)" }}>{activeAsset}</div>
          <div style={{ marginTop: 10 }}>기술/운영 컬럼으로 판단되어 <b style={{ color: "var(--text)" }}>국면0에서 필터</b>되었습니다 — 의미 매칭 대상이 아닙니다. {c ? `(${c.type})` : ""}</div>
        </div>
      );
    }
    const dv = assign[activeAsset];
    if (dv && dv.kind === "disc") {
      const cpt = concepts.find((cp) => (cp.columns || []).includes(activeAsset));
      return <DiscoveryWorkspace U={U} L={L} phase={phase} groups={groups} concepts={concepts} judgingIdx={judgingIdx} liveJudge={liveJudge} focusConcept={cpt} residue={residue} residueCount={residueCount} onCardFocus={onCardFocus} />;
    }
    const entry = mlog.find((m) => m.asset === activeAsset);
    const events = entry ? entry.events : activeEvents;
    if (events && events.length) {
      const title = entry && entry.decision === "reject" ? "잔여 → 2막 발견 입력" : null;
      return <MatcherThread U={U} L={L} asset={activeAsset} events={events} title={title} />;
    }
    return <div style={pad}><div style={{ ...mono, fontSize: 17, color: "var(--text)" }}>{activeAsset}</div><div style={{ marginTop: 10 }}>아직 처리 전입니다.</div></div>;
  }

  // 활성 행 없음 — 막에 따라
  if (phase === "filtering") {
    return <div style={pad}><span style={{ animation: "pulse 1s infinite" }}>기술 컬럼 스캔 중…</span> 운영 컬럼(생성시각·UUID·수정자 등)을 매칭 대상에서 제외합니다.</div>;
  }
  if (phase === "matching") {
    return <div style={pad}><span style={{ animation: "pulse 1s infinite" }}>연결 시작 중…</span></div>;
  }
  if (phase === "connected") {
    // 핸드오프 프롬프트 — 1막 완료, 잔여를 2막 입력으로
    return (
      <div style={{ padding: "22px 20px", fontFamily: "var(--sans)" }}>
        <div style={{ ...mono, fontSize: 14.5, color: "var(--high)", letterSpacing: "0.08em", marginBottom: 8 }}>① 연결 완료</div>
        <div style={{ fontSize: 17.5, color: "var(--text)", lineHeight: 1.6, marginBottom: 6 }}>
          기존 Term에 못 붙인 <b style={{ color: "var(--text)" }}>잔여 {residueCount}개</b>가 트레이에 모였습니다.
        </div>
        <div style={{ fontSize: 15.5, color: "var(--muted)", lineHeight: 1.65, marginBottom: 16 }}>
          이들은 카탈로그에 이름이 없던 컬럼입니다. <b style={{ color: "var(--accent)" }}>② 발견</b>은 이 잔여를 사용·계보 신호로 묶어, 흩어진 컬럼을 하나의 새 개념으로 수렴시켜 제안합니다.
        </div>
        {residueCount > 0
          ? <button onClick={onDiscover} disabled={!canDiscover} style={{ ...mono, fontSize: 15.5, padding: "9px 18px", borderRadius: 5, cursor: canDiscover ? "pointer" : "default", border: "1px solid var(--accent)", background: "rgba(232,179,65,0.14)", color: "var(--accent)", opacity: canDiscover ? 1 : 0.6 }}>② 발견 실행 ▷</button>
          : <div style={{ fontSize: 15.5, color: "var(--muted)" }}>잔여가 없습니다 — 모든 컬럼이 기존 Term에 연결되었습니다.</div>}
      </div>
    );
  }
  if (phase === "discovering") {
    return <DiscoveryWorkspace U={U} L={L} phase={phase} groups={groups} concepts={concepts} judgingIdx={judgingIdx} liveJudge={liveJudge} clusterLive={clusterLive} residue={residue} residueCount={residueCount} onCardFocus={onCardFocus} />;
  }
  // done, 무선택 — 필터에 따라 기본 화면. 연결은 컴럼별 스레드라 보드가 없음 → 선택 안내.
  if (filter === "match") {
    return (
      <div style={pad}>
        <div style={{ ...mono, fontSize: 14.5, color: "var(--high)", letterSpacing: "0.08em", marginBottom: 8 }}>보기 · 연결</div>
        <div style={{ color: "var(--text)", fontSize: 16, lineHeight: 1.6 }}>왼쪽에서 <b style={{ color: "var(--high)" }}>연결</b>된 컬럼을 선택하면 그 컬럼이 어떻게 기존 Term에 연결됐는지 추론을 다시 펼칩니다.</div>
        <div style={{ marginTop: 10, fontSize: 15, color: "var(--dim)" }}>발견 개념은 ‘발견’ 또는 ‘전체’ 보기에서 확인합니다.</div>
      </div>
    );
  }
  return (
    <div>
      {err && <div style={{ color: "var(--low)", fontSize: 15, ...mono, padding: "12px 16px" }}>오류: {err}</div>}
      <DiscoveryWorkspace U={U} L={L} phase={phase} groups={groups} concepts={concepts} judgingIdx={-1} liveJudge={null} residue={residue} residueCount={residueCount} onCardFocus={onCardFocus} />
    </div>
  );
}

window.LinkPanelMod = { StageRouter };
