import { useState } from "react";

// ============================================================
// Link 실행 하니스 — 검증용 (신호 기반). 컬럼-우선 2-에이전트.
//   국면0  기술 컬럼 규칙 필터
//   국면1  Matcher — 컬럼 단위. 구조+Description으로 매칭, 애매하면 증거 보강
//          (term_detail → fk → usage). usage는 '경계를 만드는' 게 아니라 '확정을 굳히는' 보강.
//   국면2  Discoverer — 잔여를 사용·계보로 그룹핑 → 신호를 종합한 '제안'을 검토로.
//          신규 Term은 조직이 합의하는 것 → 에이전트는 제안만, 자동 확정 안 함.
//          (구조로 묶던 시절의 re-partition 사후 교정은 없음 — 올바른 신호로 묶으면 불필요.)
// 출력은 스크립트하지 않는다. fixture(입력 신호)만 공급한다.
// ※ render와 섞이지 않는 독립 파일. 데이터는 link/ fixture의 사본을 내장(아티팩트 제약).
// ============================================================

// ---- 입력 클러스터 (cluster.json) — Description + 계보(lineage). 사용(BI) 신호는 별도 BI_ASSETS ----
const CLUSTER = [
  { asset: "LOAN_APPL_HIST.TAX_EXMP_FLG",   type: "CHAR(1)",       domain: "LOAN",     desc: "대출 신청 건의 세금 면제 여부 플래그. Y=면세 대상, N=과세 대상.", lineage: { upstream: "TAX_CALC_MODULE", derived_with: ["LOAN_APPL_HIST.TAX_EXMP_RSN_CD"] } },
  { asset: "LOAN_APPL_HIST.TAX_EXMP_RSN_CD",type: "CHAR(2)",       domain: "LOAN",     desc: "세금 면제가 적용된 사유 코드. 면제 근거(국가유공자·장애인·기초생활수급 등)를 분류한다.", lineage: { upstream: "TAX_CALC_MODULE", derived_with: ["LOAN_APPL_HIST.TAX_EXMP_FLG"] } },
  { asset: "LOAN_APPL_HIST.LOAN_STAT_CD",   type: "CHAR(2)",       domain: "LOAN",     desc: "대출 신청 건의 현재 처리 상태 코드. 01=접수, 02=심사중, 03=승인, 04=거절.", lineage: { upstream: "LOAN_WORKFLOW", derived_with: [] } },
  { asset: "LOAN_APPL_HIST.LOAN_AMT",       type: "DECIMAL(15,2)", domain: "LOAN",     desc: "고객이 신청한 대출 원금 금액(원).", lineage: { upstream: "LOAN_APPL_FORM", derived_with: [] } },
  { asset: "LOAN_APPL_HIST.INT_RATE",       type: "DECIMAL(5,3)",  domain: "LOAN",     desc: "대출에 적용되는 연 이자율(%).", lineage: { upstream: "RATE_ENGINE", derived_with: ["LOAN_APPL_HIST.APLD_RATE"] } },
  { asset: "LOAN_APPL_HIST.APLD_RATE",      type: "DECIMAL(5,3)",  domain: "LOAN",     desc: "적용 비율(%). 무엇에 대한 비율인지는 소스만으로 명확하지 않다.", lineage: { upstream: "RATE_ENGINE", derived_with: ["LOAN_APPL_HIST.INT_RATE"] } },
  { asset: "LOAN_APPL_HIST.LOAN_EXP_DT",    type: "DATE",          domain: "LOAN",     desc: "대출 만기 관련 일자. 어느 만기 기준인지는 소스만으로 명확하지 않다.", lineage: { upstream: "LOAN_APPL_FORM", derived_with: [] } },
  { asset: "LOAN_APPL_HIST.CRDT_GRD_CD",    type: "CHAR(1)",       domain: "LOAN",     desc: "대출 심사 시점의 고객 신용도를 나타내는 신용 등급 코드.", lineage: { upstream: "CREDIT_EVAL_ENGINE", derived_with: ["LOAN_APPL_HIST.CRDT_SCR", "LOAN_APPL_HIST.CRDT_EVAL_DT"] } },
  { asset: "CUST_BASE_INFO.CUST_NO",        type: "VARCHAR(15)",   domain: "CUSTOMER", pk: true, desc: "고객을 식별하는 고유 번호.", lineage: { upstream: "CUST_MASTER", derived_with: [] } },
  { asset: "LOAN_APPL_HIST.CUST_NO",        type: "VARCHAR(15)",   domain: "LOAN",     fk: "CUST_BASE_INFO.CUST_NO", desc: "대출을 신청한 고객의 식별 번호.", lineage: { upstream: "CUST_BASE_INFO.CUST_NO", derived_with: [] } },
  { asset: "LOAN_APPL_HIST.RPYMT_MTHD_CD",  type: "CHAR(2)",       domain: "LOAN",     desc: "대출 상환 방식 코드. 구체적 방식 분류는 소스에서 확인되지 않았다.", lineage: { upstream: "LOAN_APPL_FORM", derived_with: [] } },
  { asset: "LOAN_APPL_HIST.CRDT_SCR",       type: "SMALLINT",      domain: "LOAN",     desc: "신용평가 모델이 산출한 고객 신용 점수(수치).", lineage: { upstream: "CREDIT_EVAL_ENGINE", derived_with: ["LOAN_APPL_HIST.CRDT_GRD_CD", "LOAN_APPL_HIST.CRDT_EVAL_DT"] } },
  { asset: "LOAN_APPL_HIST.CRDT_EVAL_DT",   type: "DATE",          domain: "LOAN",     desc: "고객 신용평가를 수행한 일자.", lineage: { upstream: "CREDIT_EVAL_ENGINE", derived_with: ["LOAN_APPL_HIST.CRDT_SCR", "LOAN_APPL_HIST.CRDT_GRD_CD"] } },
  { asset: "LOAN_APPL_HIST.BNS_CD",         type: "CHAR(1)",       domain: "LOAN",     desc: "방카슈랑스(은행 창구 보험) 권유에 대한 고객 동의 여부. Y=동의, N=비동의, X=권유 대상 아님.", lineage: { upstream: "BANCASSURANCE_CONSENT", derived_with: [] } },
  { asset: "LOAN_APPL_HIST.DLNQ_FLG",       type: "CHAR(1)",       domain: "LOAN",     desc: "대출 건의 현재 연체 여부 플래그. Y=연체 중, N=정상.", lineage: { upstream: "DELINQUENCY_BATCH", derived_with: ["LOAN_APPL_HIST.DLNQ_DAYS"] } },
  { asset: "LOAN_APPL_HIST.DLNQ_DAYS",      type: "SMALLINT",      domain: "LOAN",     desc: "현재 연체가 지속된 일수.", lineage: { upstream: "DELINQUENCY_BATCH", derived_with: ["LOAN_APPL_HIST.DLNQ_FLG"] } },
  { asset: "LOAN_APPL_HIST.CLTRL_TYPE_CD",  type: "CHAR(2)",       domain: "LOAN",     desc: "담보 유형 코드. 부동산·예금·보증 등 담보의 종류를 분류한다.", lineage: { upstream: "COLLATERAL_EVAL_BATCH", derived_with: ["LOAN_APPL_HIST.CLTRL_VAL_AMT"] } },
  { asset: "LOAN_APPL_HIST.CLTRL_VAL_AMT",  type: "DECIMAL(15,2)", domain: "LOAN",     desc: "담보 평가 금액(원). 담보물의 감정 평가액.", lineage: { upstream: "COLLATERAL_EVAL_BATCH", derived_with: ["LOAN_APPL_HIST.CLTRL_TYPE_CD"] } },
  { asset: "CUST_BASE_INFO.CUST_CLF_CD",    type: "CHAR(2)",       domain: "CUSTOMER", desc: "고객을 분류하는 2자리 코드. (Render LOW — 분류 기준·코드값 의미가 소스에서 확인되지 않아 미확정)", lineage: { upstream: null, derived_with: [] } },
  { asset: "LOAN_APPL_HIST.CREATED_AT",     type: "TIMESTAMP",     domain: "LOAN",     desc: "레코드 생성 시각.", lineage: { upstream: null, derived_with: [] } },
  { asset: "LOAN_APPL_HIST.UPDATED_BY",     type: "VARCHAR(30)",   domain: "LOAN",     desc: "레코드를 최종 수정한 사용자 ID.", lineage: { upstream: null, derived_with: [] } },
  { asset: "LOAN_APPL_HIST.RECORD_UUID",    type: "CHAR(36)",      domain: "LOAN",     desc: "레코드의 고유 식별 UUID.", lineage: { upstream: null, derived_with: [] } },
];

// ---- BI 자산 카탈로그 (BI 도구 메타데이터 API 조회분) ----
// 실제 Looker/Tableau/PowerBI가 주는 모양: 필드/지표가 label과 sql을 갖고 물리 컬럼을 참조(metric은 N:1 집계),
// 대시보드가 여러 필드를 묶음. Link는 이 references를 역방향으로 읽어 컬럼의 사용 신호를 얻는다.
const BI_ASSETS = [
  { id: "field.tax_exempt", type: "field", tool: "Looker", label: "세금면제 여부", references: ["LOAN_APPL_HIST.TAX_EXMP_FLG"], expr: "${TABLE}.TAX_EXMP_FLG" },
  { id: "dashboard.tax_report", type: "dashboard", tool: "Tableau", label: "세금 리포트", references: ["LOAN_APPL_HIST.TAX_EXMP_FLG", "LOAN_APPL_HIST.TAX_EXMP_RSN_CD"] },
  { id: "field.loan_status", type: "field", tool: "Looker", label: "대출상태", references: ["LOAN_APPL_HIST.LOAN_STAT_CD"], expr: "${TABLE}.LOAN_STAT_CD" },
  { id: "field.loan_amount", type: "field", tool: "Looker", label: "대출금액", references: ["LOAN_APPL_HIST.LOAN_AMT"], expr: "${TABLE}.LOAN_AMT" },
  { id: "field.interest_rate", type: "field", tool: "Looker", label: "금리", references: ["LOAN_APPL_HIST.INT_RATE"], expr: "${TABLE}.INT_RATE" },
  { id: "dashboard.loan_terms", type: "dashboard", tool: "Looker", label: "대출 약정 조건", references: ["LOAN_APPL_HIST.LOAN_AMT", "LOAN_APPL_HIST.INT_RATE", "LOAN_APPL_HIST.LOAN_EXP_DT"] },
  { id: "field.credit_grade", type: "field", tool: "Looker", label: "신용등급", references: ["LOAN_APPL_HIST.CRDT_GRD_CD"], expr: "${TABLE}.CRDT_GRD_CD" },
  { id: "field.credit_score", type: "field", tool: "Looker", label: "신용점수", references: ["LOAN_APPL_HIST.CRDT_SCR"], expr: "${TABLE}.CRDT_SCR" },
  { id: "dashboard.credit_overview", type: "dashboard", tool: "Looker", label: "신용 개요", references: ["LOAN_APPL_HIST.CRDT_GRD_CD", "LOAN_APPL_HIST.CRDT_SCR"] },
  { id: "field.customer_no", type: "field", tool: "Looker", label: "고객번호", references: ["CUST_BASE_INFO.CUST_NO", "LOAN_APPL_HIST.CUST_NO"], expr: "CUST_NO" },
  { id: "metric.bancassurance_consent_rate", type: "metric", tool: "Tableau", label: "방카슈랑스 동의율", references: ["LOAN_APPL_HIST.BNS_CD"], expr: "COUNT(CASE WHEN BNS_CD='Y' THEN 1 END)/COUNT(CASE WHEN BNS_CD<>'X' THEN 1 END)" },
  { id: "metric.delinquency_rate", type: "metric", tool: "Looker", label: "연체율", references: ["LOAN_APPL_HIST.DLNQ_FLG"], expr: "COUNT(CASE WHEN DLNQ_FLG='Y' THEN 1 END)/COUNT(*)" },
  { id: "dashboard.delinquency_monitor", type: "dashboard", tool: "Looker", label: "연체 현황 모니터", references: ["LOAN_APPL_HIST.DLNQ_FLG", "LOAN_APPL_HIST.DLNQ_DAYS"] },
  { id: "field.dim_07", type: "field", tool: "Tableau", label: "dim_07", references: ["LOAN_APPL_HIST.CLTRL_TYPE_CD"], expr: "[Calculation_07]" },
  { id: "field.measure_11", type: "field", tool: "Tableau", label: "측정값11", references: ["LOAN_APPL_HIST.CLTRL_VAL_AMT"], expr: "[Calculation_11]" },
  { id: "dashboard.collateral_status", type: "dashboard", tool: "Tableau", label: "담보 현황", references: ["LOAN_APPL_HIST.CLTRL_TYPE_CD", "LOAN_APPL_HIST.CLTRL_VAL_AMT"] },
];
const col = (a) => a.split(".")[1];
const tbl = (a) => a.split(".")[0];
const byAsset = Object.fromEntries(CLUSTER.map((c) => [c.asset, c]));

// BI 신호 역방향 조회: 이 컬럼을 참조하는 BI 자산들 → 라벨·공동참조 컬럼·지표여부를 도출.
// (실제로는 BI API 응답을 인덱싱해 컬럼→자산 역인덱스를 만든 것에 해당.)
function biSignals(asset) {
  const assets = BI_ASSETS.filter((b) => b.references.includes(asset));
  const labels = assets.filter((b) => b.type === "field").map((b) => b.label);
  const metrics = assets.filter((b) => b.type === "metric").map((b) => b.label);
  const dashboards = assets.filter((b) => b.type === "dashboard").map((b) => b.label);
  const cooccur = new Set();
  for (const b of assets) for (const r of b.references) if (r !== asset) cooccur.add(r);
  return { assets, labels, metrics, dashboards, cooccur: [...cooccur] };
}

// ---- 기존 Term 라이브러리 (term_library.json) ----
const LIBRARY = [
  { name: "세금면제", domain: "LOAN",     def: "대출 신청 건의 세금 면제 관련 개념. 면제 여부·사유 등 속성을 포괄한다.", values: null, linked: [] },
  { name: "대출상태", domain: "LOAN",     def: "대출 신청 건의 현재 처리 상태", values: { "01": "접수", "02": "심사중", "03": "승인", "04": "거절" }, linked: [] },
  { name: "신용등급", domain: "LOAN",     def: "대출 심사 시 산정되는 고객의 신용 등급", values: null, linked: [] },
  { name: "신용평가", domain: "LOAN",     def: "고객의 신용 위험을 평가하는 행위 및 그 결과 지표(등급·점수 등을 포괄)", values: null, linked: [] },
  { name: "고객번호", domain: "CUSTOMER", def: "고객을 식별하는 고유 번호", values: null, linked: ["CUST_BASE_INFO.CUST_NO"] },
  { name: "대출금액", domain: "LOAN",     def: "대출 신청·실행 원금 금액", values: null, linked: [] },
  { name: "금리",     domain: "LOAN",     def: "대출에 적용되는 연 이자율", values: null, linked: [] },
  { name: "상환방식", domain: "CARD",     def: "여신성(카드) 상품의 대금 상환 방식", values: { "1": "일시불", "2": "할부", "3": "리볼빙" }, linked: [] },
  { name: "고객등급", domain: "CUSTOMER", def: "거래 실적에 따른 고객 관계 등급(VIP 등)", values: null, linked: [] },
  { name: "여신한도", domain: "LOAN",     def: "고객에게 부여된 여신(대출) 한도 금액", values: null, linked: [] },
  { name: "연체이자", domain: "LOAN",     def: "연체 발생 시 부과되는 가산 이자", values: null, linked: [] },
];
const NAMING = { priority: ["BI 지표명이 있으면 우선(사람이 부르는 이름)", "없으면 도메인 표준 한국어명"], language: "ko" };

// ---- 국면0: 기술 컬럼 규칙 필터 ----
function isTechnical(name) {
  const n = name.toUpperCase();
  if (["CREATED_AT", "UPDATED_AT", "CREATED_BY", "UPDATED_BY"].includes(n)) return true;
  if (/_UUID$/.test(n) || n === "VERSION" || /^LOCK/.test(n)) return true;
  return false;
}

// ---- 라이브러리 검색: 근접오답 포함 후보군 (BI 라벨도 검색 신호로) ----
function grams(s) { s = (s || "").toLowerCase().replace(/[^가-힣a-z0-9]/g, ""); const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; }
function searchLibrary(c, k = 4) {
  const sig = biSignals(c.asset);
  const cg = grams(c.desc + " " + col(c.asset).replace(/_/g, " ") + " " + [...sig.labels, ...sig.metrics].join(" "));
  return LIBRARY.map((t) => { const tg = grams(t.name + " " + t.def); let s = 0; for (const x of cg) if (tg.has(x)) s++; return { name: t.name, domain: t.domain, def: t.def, s }; })
    .sort((a, b) => b.s - a.s).slice(0, k).filter((x) => x.s > 0);
}
const termDetail = (name) => LIBRARY.find((t) => t.name === name);

// BI 사용 신호 텍스트화 (Matcher 보강 / Discoverer 그룹핑·판단 재료)
function usageText(c) {
  const s = biSignals(c.asset);
  if (!s.assets.length) return "BI 자산에서 참조되지 않음(사용 신호 없음 — 신규/미사용 추정)";
  const parts = [];
  if (s.labels.length) parts.push(`필드 표시명: ${s.labels.map((x) => `"${x}"`).join(", ")}`);
  if (s.metrics.length) parts.push(`지표: ${s.metrics.map((x) => `"${x}"`).join(", ")}`);
  if (s.dashboards.length) parts.push(`대시보드: ${s.dashboards.map((x) => `"${x}"`).join(", ")}`);
  if (s.cooccur.length) parts.push(`같은 BI 자산에서 함께 참조: ${s.cooccur.map(col).join(", ")}`);
  return parts.join(" · ");
}
function lineageText(c) {
  const l = c.lineage || {};
  return `상류: ${l.upstream || "미상"} · 같은 변환에서 파생: ${l.derived_with && l.derived_with.length ? l.derived_with.map(col).join(", ") : "없음"}`;
}

function parseJSON(text) {
  let t = (text || "").trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(t); } catch (e) {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}
const _wait = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE = new Set([408, 409, 425, 429, 500, 502, 503, 529]);

async function callAPI(system, user, opts = {}) {
  // 아티팩트 API 가이드: max_tokens 1000으로 보내고 한도는 프록시가 관리. 관측상 ~1000에서 잘리므로 호출당 출력을 작게 유지.
  // 일시 오류(529 Overloaded 등)·네트워크·파싱 실패는 지수 backoff로 재시도한다 — 한 번 실패로 전체가 멈추지 않게.
  const maxAttempts = opts.maxAttempts ?? 5;
  let lastErr = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(800 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 300); // 0.8s,1.6s,3.2s,6.4s(+지터)
      if (opts.onRetry) opts.onRetry(attempt, delay, lastErr);
      await _wait(delay);
    }
    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
      });
    } catch (e) { lastErr = new Error("네트워크 오류: " + (e.message || e)); continue; } // fetch 자체 실패 → 재시도
    if (!res.ok) {
      let d = ""; try { d = await res.text(); } catch (e) {}
      lastErr = new Error(`API ${res.status} ${d.slice(0, 120)}`);
      if (RETRYABLE.has(res.status)) continue;      // 일시 오류 → 재시도
      throw lastErr;                                 // 그 외(4xx 등)는 즉시 실패
    }
    let data; try { data = await res.json(); } catch (e) { lastErr = new Error("응답 JSON 아님"); continue; }
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const json = parseJSON(text);
    if (!json) { lastErr = new Error("JSON 파싱 실패: " + text.slice(0, 80)); continue; } // 파싱 실패 → 재시도
    return json;
  }
  throw lastErr || new Error("재시도 한도 초과");
}

// ---- 국면1 Matcher ----
const MATCHER_SYS = `너는 Link 파이프라인의 "Matcher"다. 컬럼 하나를 받아 기존 Term 라이브러리에서 매칭한다.

[신호] 검증된 Description이 의미 판단의 핵심. 컬럼명·도메인·FK는 보강. 후보 Term은 근접오답을 포함한다(이름 비슷해도 다른 개념일 수 있음).

[판단]
- Description 의미가 어떤 기존 Term에 분명히 부합하면 match.
- 이름은 같/비슷한데 도메인·허용값·의미가 다르면 match 금지 → reject(reason: collision).
- 부합 Term 없으면 reject(reason: no_match).
- 결정이 불확실하면 need로 증거 하나 요청(비용 낮은 것부터):
  · "term_detail:<Term>"  그 Term의 허용값·도메인·연결자산
  · "fk"                  이 컬럼의 FK 대상 정체
  · "usage"               이 컬럼의 BI 사용 신호(지표명·공동 사용) — 매칭이 애매할 때 확정을 굳히는 용도
  (usage는 경계를 새로 만드는 게 아니라, 주어진 Term에 이 컬럼이 드는지 확신을 높이는 보강이다.)
- 각 증거(term_detail·fk·usage)는 **한 번만 요청**할 수 있다. 이미 제공된 증거는 다시 요청하지 말고, 받은 것으로 match/reject를 확정하라. 같은 증거를 또 달라고 하면 무시된다.

[신뢰도] HIGH=확신, MEDIUM=그럴듯하나 검증 권장, LOW=추측.

JSON 하나만. 마크다운/펜스 금지.
{"decision":"match"|"reject"|"need","term":"매칭 Term 또는 null","need":"term_detail:X | fk | usage | null","reason":"collision|no_match|null","confidence":"HIGH"|"MEDIUM"|"LOW"|null,"reasoning":"근거 1문장"}`;

function matcherUser(c, gathered, exhausted) {
  const parts = [
    `[대상 컬럼] ${c.asset}`,
    `타입: ${c.type} · 도메인: ${c.domain}${c.fk ? ` · FK→${c.fk}` : ""}${c.pk ? " · PK" : ""}`,
    `검증된 Description: "${c.desc}"`, ``,
    `[검색된 후보 Term]`,
    ...gathered.candidates.map((x) => `- ${x.name} (${x.domain}): ${x.def}`),
  ];
  if (gathered.detail) { const d = gathered.detail; parts.push(``, `[요청한 Term 상세] ${d.name} (${d.domain}) · 정의: ${d.def} · 허용값: ${d.values ? JSON.stringify(d.values) : "없음"} · 연결자산: ${d.linked.length ? d.linked.join(", ") : "없음"}`); }
  if (gathered.fk) parts.push(``, `[FK 대상] ${gathered.fk.target} — "${gathered.fk.desc}" (도메인 ${gathered.fk.domain}${gathered.fk.pk ? ", PK" : ""})`);
  if (gathered.usage) parts.push(``, `[사용 신호] ${usageText(c)}`);
  if (exhausted) parts.push(``, `[안내] 위 증거가 제공 가능한 전부다. 더 이상 need로 요청하지 말고, 지금 신호만으로 match 또는 reject를 확정하라.`);
  parts.push(``, `판단해서 JSON 하나로 답하라.`);
  return parts.join("\n");
}

// ---- 국면2 Discoverer 1단계: 사용·계보 기반 그룹핑 ----
const DISC_GROUP_SYS = `너는 Link "Discoverer"의 1단계(그룹핑)다. Matcher가 기존 Term에 못 붙인 잔여 컬럼들을 받아, 같은 비즈니스 개념끼리 묶는다.

[묶는 기준 — 중요]
- 컬럼명·타입의 형태 유사도가 아니라, 사람이 이것들을 "한 개념으로 다루는가"로 묶어라.
- 강한 신호: 같은 BI 지표명으로 불린다 / 같은 대시보드·쿼리에서 함께 쓰인다(공동 사용) / 같은 변환에서 함께 파생됐다(계보).
- 타입이 달라도(플래그 vs 일수) 함께 쓰이면 한 개념이다. 반대로 형태가 비슷해도 함께 안 쓰이면 별개다.
- 신호가 약/부재한 컬럼은 단독 군집으로 둔다(억지로 묶지 마라).

JSON 하나만. 마크다운/펜스 금지.
{"groups":[{"group_label":"임시라벨","columns":["테이블.컬럼",...],"basis":"왜 묶었나 — 사용/계보 신호 짧게"}]}`;

function discGroupUser(residue) {
  return [
    `[잔여 컬럼 — 각 컬럼의 사용·계보 신호]`,
    ...residue.map((r) => {
      const c = byAsset[r.asset];
      return `- ${r.asset} (${c.domain}): "${c.desc}"\n    사용: ${usageText(c)}\n    계보: ${lineageText(c)}`;
    }),
    ``,
    `사용·계보로 같은 개념끼리 묶어 JSON 하나로 답하라.`,
  ].join("\n");
}

// ---- 국면2 Discoverer 2단계: 신호 종합 → 제안 ----
const DISC_JUDGE_SYS = `너는 Link "Discoverer"의 2단계(판단)다. 잔여에서 묶인 군집 하나를 받아, 신호를 종합해 비즈니스 개념(Term)을 '제안'한다. 신규 Term은 최종적으로 사람이 검토·확정한다 — 너는 근거 있는 제안을 만든다.

[신호 종합 — 서열 없이 겹쳐 본다]
- 사용(BI): 필드 표시명·지표명은 사람이 이걸 뭐라 부르는지(이름 후보), 같은 대시보드/지표의 공동 참조는 무엇과 함께 쓰는지(경계). 표시명이 모호하거나 의미 없으면(예: dim_07, 측정값11) 그 이름은 버리고, 공동 참조·계보 같은 관계 신호로 경계를 잡아라 — 이름이 약해도 함께 쓰이면 한 개념이다. 개념 이름은 의미 있는 지표/대시보드명이나 컬럼 의미에서 짓는다.
- 계보: 같은 변환에서 파생됐는지 → 개념적 친연성(단, '같은 데서 왔다'가 '한 개념'을 확정하진 않음).
- 구조·Description: 형태와 개별 의미.
- 신호가 일치하면 확신↑. 엇갈리면(예: 계보는 기존 Term과 엮이나 사용은 독자 지표) 그 긴장을 근거에 드러내고 신뢰도를 낮춰라. 신호가 부재하면 보수적으로.

[기존 Term 확인]
- 신규 만들기 전 [기존 Term 목록]을 재확인(중복 방지). 사실 기존 개념이면 decision="link_existing"+matched_term.
- 단, Matcher가 충돌로 거부한 Term엔 되돌려 link 금지.

[결정/신뢰도] — 모든 발굴은 사람 검토를 거친다. 신뢰도는 '제안의 확신도'다.
- new_term + HIGH: 사용·계보가 일치해 경계가 또렷하고 기존과 안 겹침.
- new_term + MEDIUM: 사용 신호는 있으나 단독이거나, 신호 일부만 뒷받침.
- candidate + MEDIUM: 신호가 엇갈리거나(신규 vs 기존확장 모호) 기존 Term과 범위 중첩 → 관계 정리는 Orion 몫.
- candidate + LOW: 사용·계보 신호가 부재/빈약 → 경계를 못 그음 → 사람 검토.
- link_existing + (HIGH/MEDIUM): 실은 기존 Term.

JSON 하나만. 마크다운/펜스 금지. reasoning·driving_signal 각각 한 문장.
{"name":"개념명 또는 null","columns":["테이블.컬럼",...],"decision":"new_term"|"link_existing"|"candidate","matched_term":"기존 Term 또는 null","confidence":"HIGH"|"MEDIUM"|"LOW","driving_signal":"판단을 가른 신호 짧게","reasoning":"근거 1문장"}`;

function discJudgeUser(group, residue) {
  const cols = group.columns.map((a) => {
    const c = byAsset[a]; const r = residue.find((x) => x.asset === a);
    const why = r && r.reasoning ? `\n    Matcher 사유: ${r.reason}${r.reasoning ? ` — ${r.reasoning}` : ""}` : "";
    return `- ${a} (${c.domain}): "${c.desc}"\n    사용: ${usageText(c)}\n    계보: ${lineageText(c)}${why}`;
  });
  return [
    `[군집] 임시라벨: ${group.group_label}${group.basis ? ` (묶은 근거: ${group.basis})` : ""}`,
    ...cols,
    ``,
    `[기존 Term 목록 — 중복 방지 재확인. 도메인 다르면 같은 이름도 별개]`,
    ...LIBRARY.map((t) => `- ${t.name} (${t.domain}): ${t.def}`),
    ``,
    `[작명 정책] ${NAMING.priority.join(" → ")} (언어: ${NAMING.language})`,
    ``,
    `신호를 종합해 이 군집을 판단하고 JSON 하나로 답하라.`,
  ].join("\n");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CONF_COLOR = { HIGH: "var(--high)", MEDIUM: "var(--med)", LOW: "var(--low)" };
const DEC = {
  match: { label: "기존 연결", c: "var(--high)" },
  new_term: { label: "신규 제안", c: "var(--accent)" },
  link_existing: { label: "기존 연결", c: "var(--high)" },
  candidate: { label: "검토 요청", c: "var(--low)" },
};

export default function LinkHarness() {
  const [phase, setPhase] = useState("idle");
  const [skips, setSkips] = useState([]);
  const [mlog, setMlog] = useState([]);
  const [assign, setAssign] = useState({});
  const [groups, setGroups] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [err, setErr] = useState(null);
  const [retryNote, setRetryNote] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setErr(null); setRetryNote(null); setSkips([]); setMlog([]); setAssign({}); setGroups([]); setConcepts([]);
    const onRetry = (attempt, delay, e) => setRetryNote(`일시 오류로 재시도 중… (${attempt}회, ${Math.round(delay / 100) / 10}s 대기) ${e ? String(e.message || e).slice(0, 40) : ""}`);
    const RETRY = { onRetry };

    setPhase("filter");
    const survivors = [], techs = [];
    for (const c of CLUSTER) (isTechnical(col(c.asset)) ? techs : survivors).push(c);
    for (const t of techs) { await sleep(160); setSkips((s) => [...s, t.asset]); }
    await sleep(220);

    setPhase("matching");
    const residue = [];
    try {
      for (const c of survivors) {
        const gathered = { candidates: searchLibrary(c) };
        const provided = new Set();        // 이미 제공한 증거(각 1회만)
        const steps = []; let decided = null;
        for (let i = 0; i < 5; i++) {
          const exhausted = i > 0 && provided.size > 0; // 직전 라운드까지 줄 수 있는 건 줬는지
          const r = await callAPI(MATCHER_SYS, matcherUser(c, gathered, exhausted), RETRY);
          setRetryNote(null);
          if (r.decision === "need" && r.need) {
            // 이미 제공한 증거를 또 요청하면 무시하고, 더 줄 게 없으면 최종 판단 강제
            if (provided.has(r.need)) {
              decided = await callAPI(MATCHER_SYS, matcherUser(c, gathered, true), RETRY);
              setRetryNote(null);
              if (decided.decision === "need") decided = { decision: "reject", reason: "no_match", reasoning: "추가 증거로도 확정 불가", confidence: "LOW" };
              break;
            }
            provided.add(r.need); steps.push(r.need);
            if (r.need === "fk") { const t = byAsset[c.fk]; gathered.fk = t ? { target: c.fk, desc: t.desc, domain: t.domain, pk: t.pk } : { target: c.fk || "(없음)", desc: "(클러스터 밖)", domain: "?" }; }
            else if (r.need === "usage") { gathered.usage = true; }
            else if (r.need.startsWith("term_detail:")) { gathered.detail = termDetail(r.need.split(":")[1]); }
            continue;
          }
          decided = r; break;
        }
        if (!decided) decided = { decision: "reject", reason: "no_match", reasoning: "추가 증거로도 확정 불가", confidence: "LOW" };
        setMlog((m) => [...m, { asset: c.asset, steps, ...decided }]);
        if (decided.decision === "match") setAssign((p) => ({ ...p, [c.asset]: { kind: "match", term: decided.term, confidence: decided.confidence } }));
        else residue.push({ asset: c.asset, reason: decided.reason || "no_match", reasoning: decided.reasoning || "" });
        await sleep(110);
      }

      setPhase("discovering");
      if (residue.length) {
        const gResp = await callAPI(DISC_GROUP_SYS, discGroupUser(residue), RETRY);
        setRetryNote(null);
        let gs = (gResp && gResp.groups) || [];
        if (!gs.length) gs = residue.map((r) => ({ group_label: col(r.asset), columns: [r.asset] }));
        setGroups(gs);
        await sleep(400);
        for (const g of gs) {
          await sleep(550);
          const cpt = await callAPI(DISC_JUDGE_SYS, discJudgeUser(g, residue), RETRY);
          setRetryNote(null);
          if (!cpt.columns) cpt.columns = g.columns;
          setConcepts((p) => [...p, cpt]);
          setAssign((p) => { const n = { ...p }; (cpt.columns || []).forEach((a) => { n[a] = { kind: "disc", concept: cpt.name, decision: cpt.decision, confidence: cpt.confidence }; }); return n; });
        }
      }
      setPhase("done");
    } catch (e) { setErr(`재시도 후에도 실패: ${String(e.message || e)} — 잠시 후 다시 실행해 주세요.`); setRetryNote(null); setPhase("done"); }
    setBusy(false);
  }

  const counts = { match: 0, propose: 0, review: 0, skip: skips.length };
  for (const v of Object.values(assign)) {
    if (v.kind === "match") counts.match++;
    else if (v.decision === "new_term" || v.decision === "link_existing") counts.propose++;
    else counts.review++;
  }

  const S = {
    page: { background: "var(--bg)", color: "var(--text)", minHeight: "100%", fontFamily: "'IBM Plex Sans', sans-serif", padding: 18, boxSizing: "border-box" },
    title: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, letterSpacing: "0.18em", color: "var(--muted)", textTransform: "uppercase" },
    h1: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, margin: "2px 0 14px" },
    bar: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 14 },
    btn: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, padding: "6px 14px", borderRadius: 2, cursor: "pointer", border: "1px solid var(--high)", background: "transparent", color: "var(--high)" },
    grid: { display: "grid", gridTemplateColumns: "minmax(300px, 1fr) minmax(360px, 1.3fr)", gap: 14, alignItems: "start" },
    panel: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 3 },
    row: (color, dim) => ({ display: "flex", alignItems: "center", gap: 9, padding: "6px 11px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, opacity: dim ? 0.5 : 1, borderLeft: color ? `2px solid ${color}` : "2px solid transparent" }),
    chip: (c) => ({ width: 8, height: 8, borderRadius: 8, background: c, flexShrink: 0 }),
    sub: { color: "var(--muted)", fontSize: 10.5 },
    sect: { borderTop: "1px solid var(--border)", padding: "9px 12px" },
    tag: (bg, fg) => ({ display: "inline-block", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, padding: "1px 6px", borderRadius: 2, background: bg, color: fg, letterSpacing: "0.03em" }),
    cc: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: "var(--muted)", padding: "1px 6px", border: "1px solid var(--border)", borderRadius: 2 },
  };
  const phaseLabel = { idle: "대기", filter: "국면0 · 필터", matching: "국면1 · Matcher", discovering: "국면2 · Discoverer", done: "완료" }[phase];
  const NEED_LABEL = { fk: "fk", usage: "usage" };
  const needTag = (s) => s.startsWith("term_detail:") ? s.replace("term_detail:", "term·") : (NEED_LABEL[s] || s);

  let lastTable = null;
  return (
    <div style={S.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        :root{--bg:#0d0f12;--panel:#16191e;--border:#2a2f37;--text:#d7dbe0;--muted:#8a929e;--accent:#e8b341;--high:#4ec98a;--med:#e8b341;--low:#e06b5e;--sig:#6aa9e0;}
        *{box-sizing:border-box;} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>

      <div style={S.title}>Link · 실행 하니스 (검증용)</div>
      <div style={S.h1}>LOAN 클러스터 · 신호 기반 <span style={{ fontSize: 13, color: "var(--muted)" }}>— Matcher → Discoverer</span></div>

      <div style={S.bar}>
        <span style={{ ...S.sub, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{phaseLabel}</span>
        {retryNote && <span style={{ ...S.sub, color: "var(--med)", animation: "pulse 1s infinite" }}>↻ {retryNote}</span>}
        <span style={{ flex: 1 }} />
        <span style={S.sub}>
          <span style={{ color: "var(--high)" }}>연결 {counts.match}</span> ·{" "}
          <span style={{ color: "var(--accent)" }}>신규제안 {counts.propose}</span> ·{" "}
          <span style={{ color: "var(--low)" }}>검토 {counts.review}</span> ·{" "}
          <span style={{ color: "var(--muted)" }}>SKIP {counts.skip}</span>
        </span>
        <button style={S.btn} disabled={busy} onClick={run}>{busy ? "실행 중…" : "▷ 클러스터 실행"}</button>
      </div>

      <div style={S.grid}>
        {/* 좌: 클러스터 */}
        <div style={S.panel}>
          {CLUSTER.map((c) => {
            const a = c.asset, v = assign[a], skipped = skips.includes(a);
            const color = skipped ? "var(--border)" : v ? CONF_COLOR[v.confidence] : null;
            const head = tbl(a) !== lastTable; lastTable = tbl(a);
            const pulsing = (phase === "matching" || phase === "discovering") && !skipped && !v;
            return (
              <div key={a}>
                {head && <div style={{ ...S.sub, fontFamily: "'IBM Plex Mono', monospace", padding: "8px 11px 4px", borderTop: "1px solid var(--border)", letterSpacing: "0.08em" }}>{tbl(a)} <span style={{ opacity: 0.6 }}>· {c.domain}</span></div>}
                <div style={S.row(color, skipped)}>
                  <span style={{ ...S.chip(color || "var(--border)"), animation: pulsing ? "pulse 1s infinite" : "none" }} />
                  <span style={{ flex: 1 }}>{col(a)}</span>
                  {skipped && <span style={S.tag("transparent", "var(--muted)")}>SKIP</span>}
                  {v && <><span style={{ ...S.sub, color: "var(--text)" }}>{v.kind === "match" ? v.term : v.concept}</span><span style={S.tag("transparent", CONF_COLOR[v.confidence])}>{v.confidence}</span></>}
                  {!skipped && !v && <span style={S.sub}>{c.type}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 우: 로그 */}
        <div style={S.panel}>
          {phase === "idle" && (
            <div style={{ padding: 18, color: "var(--muted)", fontSize: 13 }}>
              <b>클러스터 실행</b>: 국면1 Matcher가 컬럼을 기존 Term에 매칭(애매하면 term·fk·<span style={{ color: "var(--sig)" }}>usage</span> 보강). 못 붙인 잔여는 국면2 Discoverer가 <span style={{ color: "var(--sig)" }}>사용·계보 신호</span>로 묶어 개념을 <i>제안</i>합니다(확정은 사람 검토).
            </div>
          )}
          {phase !== "idle" && (
            <div>
              <div style={S.sect}>
                <div style={{ marginBottom: 6 }}><span style={S.tag("rgba(255,255,255,0.06)", "var(--muted)")}>국면0 · 기술 컬럼 필터</span></div>
                {skips.length === 0 ? <div style={S.sub}>스캔 중…</div> : <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{skips.map((s) => <span key={s} style={S.cc}>{col(s)} → SKIP</span>)}</div>}
              </div>

              <div style={S.sect}>
                <div style={{ marginBottom: 8 }}><span style={S.tag("rgba(78,201,138,0.12)", "var(--high)")}>국면1 · Matcher (컬럼 단위)</span></div>
                {mlog.map((m, i) => {
                  const matched = m.decision === "match";
                  const showWhy = (m.steps && m.steps.length > 0) || !matched || (m.confidence && m.confidence !== "HIGH");
                  return (
                    <div key={i} style={{ padding: "5px 0", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, flexWrap: "wrap" }}>
                        <span style={{ color: matched ? "var(--high)" : "var(--low)" }}>{col(m.asset)}</span>
                        {m.steps && m.steps.map((s, k) => <span key={k} style={S.tag(s === "usage" ? "rgba(106,169,224,0.14)" : "rgba(232,179,65,0.12)", s === "usage" ? "var(--sig)" : "var(--med)")}>⟳ {needTag(s)}</span>)}
                        <span style={{ color: "var(--muted)" }}>→</span>
                        {matched ? <><span style={{ color: "var(--text)" }}>{m.term}</span><span style={S.tag("transparent", CONF_COLOR[m.confidence])}>{m.confidence}</span></>
                          : <span style={{ color: "var(--low)" }}>{m.reason === "collision" ? "이름충돌 → 잔여" : "무매칭 → 잔여"}</span>}
                      </div>
                      {showWhy && m.reasoning && <div style={{ ...S.sub, marginTop: 2, paddingLeft: 2 }}>{m.reasoning}</div>}
                    </div>
                  );
                })}
                {phase === "matching" && <div style={{ color: "var(--high)", fontSize: 12, animation: "pulse 1s infinite", marginTop: 6 }}>컬럼 매칭 중…</div>}
              </div>

              <div style={S.sect}>
                <div style={{ marginBottom: 8 }}><span style={S.tag("rgba(232,179,65,0.12)", "var(--accent)")}>국면2 · Discoverer (사용·계보로 발굴)</span></div>
                {phase === "discovering" && groups.length === 0 && <div style={{ color: "var(--accent)", fontSize: 12, animation: "pulse 1s infinite" }}>1단계 · 사용·계보로 군집화 중…</div>}
                {groups.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ ...S.sub, marginBottom: 4 }}>1단계 · 군집 {groups.length}개 (사용·계보 기준)</div>
                    {groups.map((g, i) => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        <span style={S.cc}>{g.group_label} [{g.columns.length}]</span>
                        {g.basis && <span style={{ ...S.sub, marginLeft: 6, color: "var(--sig)" }}>{g.basis}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {groups.length > 0 && phase === "discovering" && <div style={{ color: "var(--accent)", fontSize: 12, animation: "pulse 1s infinite" }}>2단계 · 신호 종합 판단 중…</div>}
                {err && <div style={{ color: "var(--low)", fontSize: 12 }}>오류: {err}</div>}
                {concepts.map((cpt, i) => {
                  const d = DEC[cpt.decision] || { label: cpt.decision, c: "var(--muted)" };
                  return (
                    <div key={i} style={{ padding: "9px 0", borderTop: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
                        <span style={S.chip(CONF_COLOR[cpt.confidence])} />
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5 }}>{cpt.name || "(미정)"}</span>
                        <span style={S.tag("transparent", d.c)}>{d.label}</span>
                        <span style={S.tag(CONF_COLOR[cpt.confidence], "#10130f")}>{cpt.confidence}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 5 }}>{(cpt.columns || []).map((a) => <span key={a} style={S.cc}>{col(a)}</span>)}</div>
                      {cpt.matched_term && <div style={{ ...S.sub, marginBottom: 2 }}>매칭 Term: "{cpt.matched_term}"</div>}
                      {cpt.driving_signal && <div style={{ ...S.sub, marginBottom: 2, color: "var(--sig)" }}>핵심 신호: {cpt.driving_signal}</div>}
                      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text)" }}>{cpt.reasoning}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...S.sub, marginTop: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
        매칭·발굴·신뢰도는 실제 모델이 정합니다. 우리는 fixture(구조·Description·사용·계보 신호)만 공급합니다.
      </div>
    </div>
  );
}
