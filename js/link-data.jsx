// ============================================================
// Link fixture + 신호 함수 + 프롬프트 — 로직 동결, 표현만 분리.
// 원본 link_harness.jsx에서 그대로 옮김. window.LinkData 로 노출.
// ============================================================

// ---- 입력 클러스터 (cluster.json) — Description + 계보(lineage) ----
const LINK_CLUSTER = [
  { asset: "LOAN_APPL_HIST.TAX_EXMP_FLG",   type: "CHAR(1)",       domain: "LOAN",     desc: "대출 신청 건의 세금 면제 여부 플래그. Y=면세 대상, N=과세 대상.", lineage: { upstream: "TAX_CALC_MODULE", derived_with: ["LOAN_APPL_HIST.TAX_EXMP_RSN_CD"] } },
  { asset: "LOAN_APPL_HIST.TAX_EXMP_RSN_CD",type: "CHAR(2)",       domain: "LOAN",     desc: "세금 면제가 적용된 사유 코드. 면제 근거(국가유공자·장애인·기초생활수급 등)를 분류한다.", lineage: { upstream: "TAX_CALC_MODULE", derived_with: ["LOAN_APPL_HIST.TAX_EXMP_FLG"] } },
  { asset: "LOAN_APPL_HIST.LOAN_STAT_CD",   type: "CHAR(2)",       domain: "LOAN",     desc: "대출 신청 건의 처리 상태를 나타내는 코드. 구체적 코드값 체계는 소스만으로 명확하지 않다.", lineage: { upstream: "LOAN_WORKFLOW", derived_with: [] } },
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
const LINK_BI_ASSETS = [
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

const lcol = (a) => a.split(".")[1];
const ltbl = (a) => a.split(".")[0];
const linkByAsset = Object.fromEntries(LINK_CLUSTER.map((c) => [c.asset, c]));

function linkBiSignals(asset) {
  const assets = LINK_BI_ASSETS.filter((b) => b.references.includes(asset));
  const labels = assets.filter((b) => b.type === "field").map((b) => b.label);
  const metrics = assets.filter((b) => b.type === "metric").map((b) => b.label);
  const dashboards = assets.filter((b) => b.type === "dashboard").map((b) => b.label);
  const cooccur = new Set();
  for (const b of assets) for (const r of b.references) if (r !== asset) cooccur.add(r);
  return { assets, labels, metrics, dashboards, cooccur: [...cooccur] };
}

// ---- 기존 Term 라이브러리 (term_library.json) ----
const LINK_LIBRARY = [
  { name: "세금면제", domain: "LOAN",     def: "대출 신청 건의 세금 면제 관련 개념. 면제 여부·사유 등 속성을 포괄한다.", values: null, linked: [], note: null },
  { name: "대출상태", domain: "LOAN",     def: "대출 신청 건의 현재 처리 상태", values: { "01": "접수", "02": "심사중", "03": "승인", "04": "거절" }, linked: [], note: null },
  { name: "신용등급", domain: "LOAN",     def: "대출 심사 시 산정되는 고객의 신용 등급", values: null, linked: [], note: "'등급'만 가리킨다. 점수·평가일은 이 Term의 범위가 아니다." },
  { name: "신용평가", domain: "LOAN",     def: "고객의 신용 위험을 평가하는 행위 및 그 결과 지표(등급·점수 등을 포괄)", values: null, linked: [], note: "정의가 넓어 점수·평가일이 확장인지 신규인지 모호." },
  { name: "고객번호", domain: "CUSTOMER", def: "고객을 식별하는 고유 번호", values: null, linked: ["CUST_BASE_INFO.CUST_NO"], note: "고객 마스터 PK에 연결 — FK 매칭 근거." },
  { name: "대출금액", domain: "LOAN",     def: "대출 신청·실행 원금 금액", values: null, linked: [], note: null },
  { name: "금리",     domain: "LOAN",     def: "대출에 적용되는 연 이자율", values: null, linked: [], note: null },
  { name: "상환방식", domain: "CARD",     def: "여신성(카드) 상품의 대금 상환 방식", values: { "1": "일시불", "2": "할부", "3": "리볼빙" }, linked: [], note: "CARD 도메인. 이름은 같으나 의미·값 다름 — 이름 충돌." },
  { name: "고객등급", domain: "CUSTOMER", def: "거래 실적에 따른 고객 관계 등급(VIP 등)", values: null, linked: [], note: "신용등급과 '등급' 겹치는 근접오답." },
  { name: "여신한도", domain: "LOAN",     def: "고객에게 부여된 여신(대출) 한도 금액", values: null, linked: [], note: "신용·금액류 근접오답." },
  { name: "연체이자", domain: "LOAN",     def: "연체 발생 시 부과되는 가산 이자", values: null, linked: [], note: "연체 여부·일수와 '연체' 겹치는 근접오답." },
];
const LINK_NAMING = { priority: ["BI 지표명이 있으면 우선(사람이 부르는 이름)", "없으면 도메인 표준 한국어명"], language: "ko" };

function linkIsTechnical(name) {
  const n = name.toUpperCase();
  if (["CREATED_AT", "UPDATED_AT", "CREATED_BY", "UPDATED_BY"].includes(n)) return true;
  if (/_UUID$/.test(n) || n === "VERSION" || /^LOCK/.test(n)) return true;
  return false;
}

function linkGrams(s) { s = (s || "").toLowerCase().replace(/[^가-힣a-z0-9]/g, ""); const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; }
function linkSearchLibrary(c, k = 4) {
  const sig = linkBiSignals(c.asset);
  const cg = linkGrams(c.desc + " " + lcol(c.asset).replace(/_/g, " ") + " " + [...sig.labels, ...sig.metrics].join(" "));
  return LINK_LIBRARY.map((t) => { const tg = linkGrams(t.name + " " + t.def); let s = 0; for (const x of cg) if (tg.has(x)) s++; return { name: t.name, domain: t.domain, def: t.def, s }; })
    .sort((a, b) => b.s - a.s).slice(0, k).filter((x) => x.s > 0);
}
const linkTermDetail = (name) => LINK_LIBRARY.find((t) => t.name === name);

function linkUsageText(c) {
  const s = linkBiSignals(c.asset);
  if (!s.assets.length) return "BI 자산에서 참조되지 않음(사용 신호 없음 — 신규/미사용 추정)";
  const parts = [];
  if (s.labels.length) parts.push(`필드 표시명: ${s.labels.map((x) => `"${x}"`).join(", ")}`);
  if (s.metrics.length) parts.push(`지표: ${s.metrics.map((x) => `"${x}"`).join(", ")}`);
  if (s.dashboards.length) parts.push(`대시보드: ${s.dashboards.map((x) => `"${x}"`).join(", ")}`);
  if (s.cooccur.length) parts.push(`같은 BI 자산에서 함께 참조: ${s.cooccur.map(lcol).join(", ")}`);
  return parts.join(" · ");
}
function linkLineageText(c) {
  const l = c.lineage || {};
  return `상류: ${l.upstream || "미상"} · 같은 변환에서 파생: ${l.derived_with && l.derived_with.length ? l.derived_with.map(lcol).join(", ") : "없음"}`;
}

// ---- 프롬프트 (동결) ----
const LINK_MATCHER_SYS = `너는 Link 파이프라인의 "Matcher"다. 컬럼 하나를 받아 기존 Term 라이브러리에서 매칭한다.

[신호] 검증된 Description이 의미 판단의 핵심. 컬럼명·도메인·FK는 보강. 후보 Term은 근접오답을 포함한다(이름 비슷해도 다른 개념일 수 있음).

[판단 — 결정 옵션]
- Description 의미가 어떤 기존 Term에 분명히 부합하면 match. 부합 Term 없으면 reject. 불확실하면 need로 증거 하나를 요청한 뒤 다시 판단한다.
- 결정이 불확실하면 need로 증거 하나 요청(비용 낮은 것부터):
  · "term_detail:<Term>"  그 Term의 허용값·도메인·연결자산
  · "fk"                  이 컬럼의 FK 대상 정체
  · "usage"               이 컬럼의 BI 사용 신호(지표명·공동 사용) — 매칭이 애매할 때 확정을 굳히는 용도
  (usage는 경계를 새로 만드는 게 아니라, 주어진 Term에 이 컬럼이 드는지 확신을 높이는 보강이다.)
- 각 증거(term_detail·fk·usage)는 **한 번만 요청**할 수 있다. 이미 제공된 증거는 다시 요청하지 말고, 받은 것으로 match/reject를 확정하라. 같은 증거를 또 달라고 하면 무시된다.
- term_detail:X 는 **실존하는 후보/라이브러리 Term**에만 요청할 수 있다. 라이브러리에 없는 이름(지어낸 Term)을 요청하면 무시되며, 그것은 '부합 Term 없음(no_match)' 신호다 — 없는 근거를 만들지 마라.

[근거 — 매칭은 '획득'하는 것이지 닮아서 통과되는 게 아니다]
- match를 결론내기 전에, 이 매칭을 틀리게 만들 수 있는 구조적 신호를 점검하고 reasoning에 명시하라:
  · 도메인: 컬럼 도메인과 후보 Term 도메인을 나란히 적어라. 다르면 — 개념이 도메인을 넘는 근거를 대거나 reject. 다른데 "일치"라고 적지 마라.
  · Term 정의 범위: 후보 정의가 넓거나 포괄적이면 이 컬럼이 그 범위에 정말 드는지 확인이 필요하다.
  · 값 체계: 값 의미가 후보를 가르는 코드 컬럼이면 허용값을 확인하라.
  · 이름 vs 의미: 이름은 닮았으나 Description 의미가 갈리면 닮음을 근거로 삼지 마라.
- 위 신호가 보이는데 해소되지 않았다면, 이름·Description 유사도만으로 HIGH를 주지 마라 — 보강 증거(term_detail/fk/usage)로 해소하거나, 신뢰도를 낮추거나, 거부하라. 무엇을 할지는 네 판단이되, 신호를 덮지는 마라.

[reject 사유]
- collision = 이름/의미는 닮았으나 도메인·정의가 본질적으로 다른 개념(진짜 충돌).
- scope     = 같은 개념군이나 입도가 안 맞음(이 컬럼이 Term의 하위 속성이거나, Term이 너무 넓음).
- no_match  = 부합 Term 없음.

[신뢰도] HIGH=확신, MEDIUM=그럴듯하나 검증 권장, LOW=추측.

JSON 하나만. 마크다운/펜스 금지.
{"decision":"match"|"reject"|"need","term":"매칭 Term 또는 null","need":"term_detail:X | fk | usage | null","reason":"collision|scope|no_match|null","confidence":"HIGH"|"MEDIUM"|"LOW"|null,"reasoning":"근거 1문장"}`;

function linkMatcherUser(c, gathered, exhausted) {
  const parts = [
    `[대상 컬럼] ${c.asset}`,
    `타입: ${c.type} · 도메인: ${c.domain}${c.fk ? ` · FK→${c.fk}` : ""}${c.pk ? " · PK" : ""}`,
    `검증된 Description: "${c.desc}"`, ``,
    `[검색된 후보 Term]`,
    ...gathered.candidates.map((x) => `- ${x.name} (${x.domain}): ${x.def}`),
  ];
  if (gathered.detail) { const d = gathered.detail; parts.push(``, `[요청한 Term 상세] ${d.name} (${d.domain}) · 정의: ${d.def} · 허용값: ${d.values ? JSON.stringify(d.values) : "없음"} · 연결자산: ${d.linked.length ? d.linked.join(", ") : "없음"}`); }
  if (gathered.detailMissing) parts.push(``, `[요청한 Term 상세] "${gathered.detailMissing}" — 라이브러리에 그런 Term 없음(지어낸 후보, 부합 Term 아님). 없는 근거로 매칭하지 말 것.`);
  if (gathered.fk) parts.push(``, `[FK 대상] ${gathered.fk.target} — "${gathered.fk.desc}" (도메인 ${gathered.fk.domain}${gathered.fk.pk ? ", PK" : ""})`);
  if (gathered.usage) parts.push(``, `[사용 신호] ${linkUsageText(c)}`);
  if (exhausted) parts.push(``, `[안내] 위 증거가 제공 가능한 전부다. 더 이상 need로 요청하지 말고, 지금 신호만으로 match 또는 reject를 확정하라.`);
  parts.push(``, `판단해서 JSON 하나로 답하라.`);
  return parts.join("\n");
}

const LINK_DISC_GROUP_SYS = `너는 Link "Discoverer"의 1단계(그룹핑)다. Matcher가 기존 Term에 못 붙인 잔여 컬럼들을 받아, 같은 비즈니스 개념끼리 묶는다.

[묶는 기준 — 중요]
- 컬럼명·타입의 형태 유사도가 아니라, 사람이 이것들을 "한 개념으로 다루는가"로 묶어라.
- 강한 신호: 같은 BI 지표명으로 불린다 / 같은 대시보드·쿼리에서 함께 쓰인다(공동 사용) / 같은 변환에서 함께 파생됐다(계보).
- 타입이 달라도(플래그 vs 일수) 함께 쓰이면 한 개념이다. 반대로 형태가 비슷해도 함께 안 쓰이면 별개다.
- 신호가 약/부재한 컬럼은 단독 군집으로 둔다(억지로 묶지 마라).

JSON 하나만. 마크다운/펜스 금지.
{"groups":[{"group_label":"임시라벨","columns":["테이블.컬럼",...],"basis":"왜 묶었나 — 사용/계보 신호 짧게"}]}`;

function linkDiscGroupUser(residue) {
  return [
    `[잔여 컬럼 — 각 컬럼의 사용·계보 신호]`,
    ...residue.map((r) => {
      const c = linkByAsset[r.asset];
      return `- ${r.asset} (${c.domain}): "${c.desc}"\n    사용: ${linkUsageText(c)}\n    계보: ${linkLineageText(c)}`;
    }),
    ``,
    `사용·계보로 같은 개념끼리 묶어 JSON 하나로 답하라.`,
  ].join("\n");
}

const LINK_DISC_JUDGE_SYS = `너는 Link "Discoverer"의 2단계(판단)다. 잔여에서 묶인 군집 하나를 받아, 신호를 종합해 비즈니스 개념(Term)을 '제안'한다. 신규 Term은 최종적으로 사람이 검토·확정한다 — 너는 근거 있는 제안을 만든다.

[신호 종합 — 서열 없이 겹쳐 본다]
- 사용(BI): 필드 표시명·지표명은 사람이 이걸 뭐라 부르는지(이름 후보), 같은 대시보드/지표의 공동 참조는 무엇과 함께 쓰는지(경계). 표시명이 모호하거나 의미 없으면(예: dim_07, 측정값11) 그 이름은 버리고, 공동 참조·계보 같은 관계 신호로 경계를 잡아라 — 이름이 약해도 함께 쓰이면 한 개념이다. 개념 이름은 의미 있는 지표/대시보드명이나 컬럼 의미에서 짓는다.
- 계보: 같은 변환에서 파생됐는지 → 개념적 친연성(단, '같은 데서 왔다'가 '한 개념'을 확정하진 않음).
- 구조·Description: 형태와 개별 의미.
- 신호가 일치하면 확신↑. 엇갈리면(예: 계보는 기존 Term과 엮이나 사용은 독자 지표) 그 긴장을 근거에 드러내고 신뢰도를 낮춰라. 신호가 부재하면 보수적으로.

[기존 Term 확인]
- 신규 만들기 전 [기존 Term 목록]을 재확인(중복 방지). 사실 기존 개념이면 decision="link_existing"+matched_term.
- [Matcher 거부 핸드오프] collision으로 거부된 Term에는 되돌려 link 금지(진짜 다른 개념). scope로 거부된 Term은 link_existing/하위 Term 제안이 가능하나, 입도 관계(속성·확장 여부)를 reasoning에 드러내고 candidate(검토)로 넘겨라.

[결정/신뢰도] — 모든 발견은 사람 검토를 거친다. 신뢰도는 '제안의 확신도'다.
- new_term + HIGH: 사용·계보가 일치해 경계가 또렷하고 기존과 안 겹침.
- new_term + MEDIUM: 사용 신호는 있으나 단독이거나, 신호 일부만 뒷받침.
- candidate + MEDIUM: 신호가 엇갈리거나(신규 vs 기존확장 모호) 기존 Term과 범위 중첩 → 관계 정리는 Orion 몫.
- candidate + LOW: 사용·계보 신호가 부재/빈약 → 경계를 못 그음 → 사람 검토.
- link_existing + (HIGH/MEDIUM): 실은 기존 Term.

[누락 금지] 입력 군집의 모든 컬럼을 결과 columns에 포함하라 — 일부만 담지 마라(빠진 컬럼은 하니스가 단독 검토로 보존한다).

JSON 하나만. 마크다운/펜스 금지. reasoning·driving_signal 각각 한 문장.
{"name":"개념명 또는 null","columns":["테이블.컬럼",...],"decision":"new_term"|"link_existing"|"candidate","matched_term":"기존 Term 또는 null","confidence":"HIGH"|"MEDIUM"|"LOW","driving_signal":"판단을 가른 신호 짧게","reasoning":"근거 1문장"}`;

function linkDiscJudgeUser(group, residue) {
  const cols = group.columns.map((a) => {
    const c = linkByAsset[a]; const r = residue.find((x) => x.asset === a);
    const why = r && r.reasoning ? `\n    Matcher 사유: ${r.reason}${r.reasoning ? ` — ${r.reasoning}` : ""}` : "";
    return `- ${a} (${c.domain}): "${c.desc}"\n    사용: ${linkUsageText(c)}\n    계보: ${linkLineageText(c)}${why}`;
  });
  return [
    `[군집] 임시라벨: ${group.group_label}${group.basis ? ` (묶은 근거: ${group.basis})` : ""}`,
    ...cols,
    ``,
    `[기존 Term 목록 — 중복 방지 재확인. 도메인 다르면 같은 이름도 별개]`,
    ...LINK_LIBRARY.map((t) => `- ${t.name} (${t.domain}): ${t.def}`),
    ``,
    `[작명 정책] ${LINK_NAMING.priority.join(" → ")} (언어: ${LINK_NAMING.language})`,
    ``,
    `신호를 종합해 이 군집을 판단하고 JSON 하나로 답하라.`,
  ].join("\n");
}

window.LinkData = {
  CLUSTER: LINK_CLUSTER,
  BI_ASSETS: LINK_BI_ASSETS,
  LIBRARY: LINK_LIBRARY,
  NAMING: LINK_NAMING,
  col: lcol, tbl: ltbl, byAsset: linkByAsset,
  biSignals: linkBiSignals,
  isTechnical: linkIsTechnical,
  searchLibrary: linkSearchLibrary,
  termDetail: linkTermDetail,
  usageText: linkUsageText,
  lineageText: linkLineageText,
  MATCHER_SYS: LINK_MATCHER_SYS,
  matcherUser: linkMatcherUser,
  DISC_GROUP_SYS: LINK_DISC_GROUP_SYS,
  discGroupUser: linkDiscGroupUser,
  DISC_JUDGE_SYS: LINK_DISC_JUDGE_SYS,
  discJudgeUser: linkDiscJudgeUser,
};
