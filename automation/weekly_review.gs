/**
 * 검수 자동 수집 (Google Apps Script) — 매일 실행
 * - 본인 구글 계정 권한으로 실행 (서비스 계정/GitHub 불필요)
 * - 매일 오전 10시 시간 트리거로 dailyReview() 실행
 *
 * 동작:
 *  1) 검수 추적 시트 읽기 (열은 "헤더 이름"으로 자동 매핑 → 열 순서가 바뀌어도 안 깨짐)
 *  2) AI 답변이 비어 있는 행 제외 (매크로/문의 미비 직접답변 등 → 학습할 초안 없음)
 *  3) 수정이 들어간 행만 추림
 *  4) 변경유형(RULE/FACT) 제안
 *  5) 변경이력 시트에 "검토 대기"로 추가 (중복 방지)
 *
 * ※ policy.md 자동 수정/배포는 하지 않음. 사람이 검토 후 직접 반영.
 * ※ 열을 "이름"으로 찾으므로 시트 열 순서가 또 바뀌어도 수정 불필요.
 *    단, 헤더 "이름"이 바뀌면 아래 HEADER_MATCHERS의 키워드만 수정.
 *    필수 열(티켓번호/AI답변/수정/수정근거)을 못 찾으면 잘못 수집 방지를 위해 중단하고 로그를 남김.
 */

// ----- 설정 -----
const TRACKING_ID = "1lNJr_75ncoYtpPH_akwNEqWWu6byT-wdgS7CssjVyk4";   // 검수 추적 시트
const CHANGELOG_ID = "1j_qaGMf5tvcHVIdc06zetZT66syjMRAKvMNfaPPx8ic";  // 변경이력 시트

// 헤더 이름으로 열을 찾는 규칙 (헤더 텍스트를 소문자화 + 공백/개행 제거 후 검사)
// 2026-07-09 추적 시트 헤더 기준. 열 순서가 바뀌어도 헤더 이름만 유지되면 자동으로 맞춰짐.
const HEADER_MATCHERS = {
  ticket: function (h) { return h.indexOf("티켓") !== -1; },                                  // "티켓번호"
  ai:     function (h) { return h.indexOf("agent답변") !== -1 || h.indexOf("aiagent") !== -1; }, // "Ai agent 답변 내용 / 매크로"
  fix:    function (h) { return h === "수정"; },                                               // 정확히 "수정" (수정근거/보완과 구분)
  reason: function (h) { return h.indexOf("수정근거") !== -1; },                               // "수정 근거 및 사유"
};

const FACT_HINTS = ["url", "http", "링크", "주소", "txid", "네트워크", "지원", "미지원", "익스플로러", "토큰", "컨트랙트"];
const RULE_HINTS = ["톤", "표현", "안내 방식", "순서", "제3자", "정책", "규칙", "저자세", "안심", "핑퐁", "플랫폼"];

function normalizeHeader(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, "");
}

// 헤더 행에서 각 필수 열의 인덱스를 찾아 { ticket, ai, fix, reason } 반환
function resolveColumns(headerRow) {
  const cols = {};
  for (let c = 0; c < headerRow.length; c++) {
    const h = normalizeHeader(headerRow[c]);
    if (!h) continue;
    for (const key in HEADER_MATCHERS) {
      if (cols[key] === undefined && HEADER_MATCHERS[key](h)) {
        cols[key] = c;
      }
    }
  }
  return cols;
}

function dailyReview() {
  const tracking = SpreadsheetApp.openById(TRACKING_ID).getSheets()[0];
  const changelog = SpreadsheetApp.openById(CHANGELOG_ID).getSheets()[0];

  const rows = tracking.getDataRange().getValues();       // 헤더 포함 (헤더 = 1행)
  if (rows.length < 2) { Logger.log("추적 시트에 데이터 없음"); return; }

  // 헤더 이름으로 열 자동 매핑
  const cols = resolveColumns(rows[0]);
  const required = ["ticket", "ai", "fix", "reason"];
  const missing = required.filter(function (k) { return cols[k] === undefined; });
  if (missing.length) {
    Logger.log("필수 헤더를 못 찾음: " + missing.join(", ") +
               " → 시트 헤더명 확인 또는 HEADER_MATCHERS 수정 필요. (잘못 수집 방지를 위해 중단)");
    return;
  }

  const existing = changelog.getDataRange().getValues();

  // 변경이력에 이미 있는 (근거시트행 | 티켓번호) → 중복 방지
  const seen = {};
  for (let i = 1; i < existing.length; i++) {
    const r = existing[i];
    seen[String(r[1]).trim() + "|" + String(r[2]).trim()] = true; // B 근거시트행, C 티켓번호
  }

  const today = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  const out = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1; // 시트 실제 행번호 (헤더=1행)
    const ticket = String(row[cols.ticket] || "").trim();
    const ai = String(row[cols.ai] || "").trim();
    const fix = String(row[cols.fix] || "").trim();
    const reason = String(row[cols.reason] || "").trim();

    if (!fix) continue;  // 수정 없음 → 학습 대상 아님
    if (!ai) continue;   // AI 답변 비어 있으면 제외 (매크로/직접답변 등 학습할 초안 없음)
    const key = rowNum + "|" + ticket;
    if (seen[key]) continue;               // 중복 → 제외

    out.push([
      today,                 // 변경일자
      rowNum,                // 근거 시트행
      ticket,                // 티켓번호
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
