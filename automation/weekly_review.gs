/**
 * 검수 자동 수집 (Google Apps Script) — 매일 실행 (헤더 이름 기반 자동 매핑 + 티켓 ID 기준 중복방지)
 * - 열 순서가 바뀌어도 헤더 이름만 유지되면 자동으로 맞춰짐. 필수 열 미발견 시 중단+로그.
 * - 중복방지는 "행 번호"가 아니라 "티켓 ID" 기준 → 추적 시트 행이 밀려도, 티켓이 숫자/URL 어떤 표기여도 중복 안 생김.
 * - 변경이력에 저장하는 티켓은 항상 클릭 가능한 전체 URL로 통일.
 *
 * ※ policy.md 자동 수정/배포는 하지 않음. 사람이 검토 후 직접 반영.
 */

// ----- 설정 -----
const TRACKING_ID = "1lNJr_75ncoYtpPH_akwNEqWWu6byT-wdgS7CssjVyk4";   // 검수 추적 시트
const CHANGELOG_ID = "1j_qaGMf5tvcHVIdc06zetZT66syjMRAKvMNfaPPx8ic";  // 변경이력 시트
const TICKET_BASE = "https://dcentwallet.zendesk.com/agent/tickets/"; // 티켓 URL 접두

// 헤더 이름으로 열을 찾는 규칙 (헤더 텍스트를 소문자화 + 공백/개행 제거 후 검사)
const HEADER_MATCHERS = {
  ticket: function (h) { return h.indexOf("티켓") !== -1; },
  ai:     function (h) { return h.indexOf("agent답변") !== -1 || h.indexOf("aiagent") !== -1; },
  fix:    function (h) { return h === "수정"; },
  reason: function (h) { return h.indexOf("수정근거") !== -1; },
};

const FACT_HINTS = ["url", "http", "링크", "주소", "txid", "네트워크", "지원", "미지원", "익스플로러", "토큰", "컨트랙트"];
const RULE_HINTS = ["톤", "표현", "안내 방식", "순서", "제3자", "정책", "규칙", "저자세", "안심", "핑퐁", "플랫폼"];

function normalizeHeader(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "");
}

// 티켓 값(숫자/URL/하이퍼링크 표시텍스트)에서 "티켓 ID(숫자)"만 추출
function ticketId(v) {
  if (v instanceof Date) return "";
  const s = String(v == null ? "" : v).trim();
  const m = /tickets\/(\d+)/.exec(s);        // URL 형식
  if (m) return m[1];
  if (/^\d{6,}$/.test(s)) return s;          // 순수 숫자
  const m2 = /(\d{6,})/.exec(s);             // 그 외 문자열 내 6자리+ 숫자
  return m2 ? m2[1] : "";
}

function resolveColumns(headerRow) {
  const cols = {};
  for (let c = 0; c < headerRow.length; c++) {
    const h = normalizeHeader(headerRow[c]);
    if (!h) continue;
    for (const key in HEADER_MATCHERS) {
      if (cols[key] === undefined && HEADER_MATCHERS[key](h)) cols[key] = c;
    }
  }
  return cols;
}

function dailyReview() {
  const tracking = SpreadsheetApp.openById(TRACKING_ID).getSheets()[0];
  const changelog = SpreadsheetApp.openById(CHANGELOG_ID).getSheets()[0];

  const rows = tracking.getDataRange().getValues();
  if (rows.length < 2) { Logger.log("추적 시트에 데이터 없음"); return; }

  const cols = resolveColumns(rows[0]);
  const required = ["ticket", "ai", "fix", "reason"];
  const missing = required.filter(function (k) { return cols[k] === undefined; });
  if (missing.length) {
    Logger.log("필수 헤더를 못 찾음: " + missing.join(", ") + " → 헤더명 확인/HEADER_MATCHERS 수정 필요. 수집 중단.");
    return;
  }

  const existing = changelog.getDataRange().getValues();

  // 변경이력에 이미 있는 "티켓 ID" → 중복 방지 (행 위치·티켓 표기 무관)
  const seen = {};
  for (let i = 1; i < existing.length; i++) {
    const id = ticketId(existing[i][2]); // C 티켓
    if (id) seen[id] = true;
  }

  const today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  const out = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1; // 시트 실제 행번호 (헤더=1행)
    const ai = String(row[cols.ai] || "").trim();
    const fix = String(row[cols.fix] || "").trim();
    const reason = String(row[cols.reason] || "").trim();
    const id = ticketId(row[cols.ticket]);

    if (!fix) continue;  // 수정 없음 → 학습 대상 아님
    if (!ai) continue;   // AI 답변 비어 있으면 제외
    const key = id || ("row" + rowNum);      // 티켓 ID 기준(없으면 행번호 폴백)
    if (seen[key]) continue;                  // 이미 있음 → 제외

    const ticketStored = id ? (TICKET_BASE + id) : String(row[cols.ticket] || "").trim();
    out.push([
      today,                 // 변경일자
      rowNum,                // 근거 시트행
      ticketStored,          // 티켓번호(전체 URL로 통일)
      suggestType(reason + " " + fix),  // 변경유형(제안)
      reason || "(수정 근거 미기재)",    // 수정 이유
      "(검토 후 작성 — policy.md 반영 내용)", // agent 수정 내용
      "검토 대기",            // 적용여부
      "자동 수집",            // 비고
    ]);
    seen[key] = true;
  }

  if (out.length) {
    changelog.getRange(changelog.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
  }
  Logger.log(out.length
    ? (out.length + "건 변경이력에 '검토 대기' 추가 (매핑: " + JSON.stringify(cols) + ")")
    : "추가할 수정 건 없음 (매핑: " + JSON.stringify(cols) + ")");
}

function suggestType(text) {
  const t = text.toLowerCase();
  const f = FACT_HINTS.some(function (h) { return t.indexOf(h) !== -1; });
  const r = RULE_HINTS.some(function (h) { return t.indexOf(h) !== -1; });
  if (f && r) return "RULE+FACT(검토)";
  if (f) return "FACT(검토)";
  if (r) return "RULE(검토)";
  return "검토 필요";
}
