// ============================================================
// API 레이어 — window.claude.complete (프록시, 키 불필요).
// 출력은 스크립트하지 않음. fixture(입력)만 공급. JSON 강제 + backoff 재시도.
// window.LiveAPI 로 노출.
// ============================================================

function apiParseJSON(text) {
  let t = (text || "").trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(t); } catch (e) {}
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

const apiWait = (ms) => new Promise((r) => setTimeout(r, ms));

// system + user 를 합쳐 한 프롬프트로 보낸다 (complete 는 system 파라미터 미지원).
async function apiComplete(system, user, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 5;
  let lastErr = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(800 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 300);
      if (opts.onRetry) opts.onRetry(attempt, delay, lastErr);
      await apiWait(delay);
    }
    try {
      if (!window.claude || typeof window.claude.complete !== "function") {
        throw new Error("실행 환경에 Claude 호출 핸들이 없습니다 (window.claude.complete 부재)");
      }
      const prompt = `${system}\n\n=====\n\n${user}`;
      const text = await window.claude.complete(prompt);
      const json = apiParseJSON(text);
      if (!json) { lastErr = new Error("JSON 파싱 실패: " + String(text || "").slice(0, 80)); continue; }
      return json;
    } catch (e) {
      lastErr = new Error(String((e && e.message) || e));
      continue;
    }
  }
  throw lastErr || new Error("재시도 한도 초과");
}

window.LiveAPI = { complete: apiComplete, parseJSON: apiParseJSON, wait: apiWait };
