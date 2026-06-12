// ============================================================
// API 레이어 — 이중 환경 지원:
//   ① claude.ai 아티팩트: window.claude.complete (프록시, 키 불필요) — 기존 동작 유지
//   ② GitHub Pages / 로컬: api.anthropic.com 직접 호출 (키 필요)
//      키 해석: window.ANTHROPIC_KEY(local-config.js, gitignore) → localStorage('anthropic_key')
//      부트스트랩: '#k=sk-ant-...'로 접속 시 localStorage 저장 후 주소에서 즉시 제거.
//      키는 리포에 절대 커밋하지 않는다 (public 키는 시크릿 스캐닝 자동 비활성화).
// 출력은 스크립트하지 않음. fixture(입력)만 공급. JSON 강제 + backoff 재시도.
// window.LiveAPI 로 노출 — contract(complete/parseJSON/wait)는 기존과 동일.
// ============================================================

// 해시 키 부트스트랩 (해시는 서버로 전송되지 않음)
(function () {
  const m = location.hash.match(/^#k=(sk-ant-[A-Za-z0-9_\-]+)/);
  if (m) {
    localStorage.setItem("anthropic_key", m[1]);
    history.replaceState(null, "", location.pathname + location.search);
  }
})();

const API_MODEL = "claude-sonnet-4-6"; // 구 sonnet-4-20250514는 2026-06-15 retire

function apiGetKey() {
  return (typeof window !== "undefined" && window.ANTHROPIC_KEY) ||
         localStorage.getItem("anthropic_key") || null;
}

function apiParseJSON(text) {
  let t = (text || "").trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(t); } catch (e) {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

const apiWait = (ms) => new Promise((r) => setTimeout(r, ms));

// 직접 호출 (Pages/로컬) — system 파라미터를 정식으로 사용
async function apiDirectCall(system, user) {
  const key = apiGetKey();
  if (!key) {
    throw new Error(
      "Claude 호출 수단이 없습니다 — claude.ai 안이 아니면 키가 필요합니다. " +
      "주소 뒤에 #k=sk-ant-... 를 붙여 한 번 접속하거나, local-config.js를 두세요.");
  }
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: API_MODEL, max_tokens: 1200,
      system, messages: [{ role: "user", content: user }] }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

async function apiComplete(system, user, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 5;
  let lastErr = null;
  const hasProxy = !!(window.claude && typeof window.claude.complete === "function");
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(800 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 300);
      if (opts.onRetry) opts.onRetry(attempt, delay, lastErr);
      await apiWait(delay);
    }
    try {
      let text;
      if (hasProxy) {
        // claude.ai 아티팩트 — complete는 system 파라미터 미지원이라 합쳐서 전달 (기존 방식)
        text = await window.claude.complete(`${system}\n\n=====\n\n${user}`);
      } else {
        text = await apiDirectCall(system, user);
      }
      const json = apiParseJSON(text);
      if (!json) { lastErr = new Error("JSON 파싱 실패: " + String(text || "").slice(0, 80)); continue; }
      return json;
    } catch (e) {
      lastErr = new Error(String((e && e.message) || e));
      // 키 부재는 재시도 무의미 — 즉시 표면화
      if (/키가 필요/.test(lastErr.message)) throw lastErr;
      continue;
    }
  }
  throw lastErr || new Error("재시도 한도 초과");
}

window.LiveAPI = { complete: apiComplete, parseJSON: apiParseJSON, wait: apiWait, hasKey: apiGetKey };
