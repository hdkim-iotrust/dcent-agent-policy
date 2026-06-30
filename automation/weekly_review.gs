/**
 * 주간 검수 자동 수집 (Google Apps Script 버전)
 * - 본인 구글 계정 권한으로 실행 (서비스 계정/GitHub 불필요)
 * - 매주 금요일 시간 트리거로 weeklyReview() 실행
 *
 * 동작:
 *  1) 검수 추적 시트 읽기
 *  2) 매크로 처리 행 제외 (AI답변 E 비어있음 AND 수정근거 G에 '매크로' 포함)
 *  3) 수정(F) 들어간 행만 추림
 *  4) 변경유형(RULE/FACT) 제안
 *  5) 변경이력 시트에 "검토 대기"로 추가 (중복 방지)
 *
 * ※ policy.md 자동 수정/배포는 하지 않음. 사람이 금요일에 검토 후 직접 반영.
 */

// ----- 설정 -----
const TRACKING_ID = "1lNJr_75ncoYtpPH_akwNEqWWu6byT-wdgS7CssjVyk4";   // 검수 추적 시트
const CHANGELOG_ID = "1j_qaGMf5tvcHVIdc06zetZT66syjMRAKvMNfaPPx8ic";  // 변경이력 시트

const MACRO_KEYWORDS = ["매크로", "macro"];

// 추적 시트 열 인덱스 (0-based): A=0 티켓번호, E=4 AI답변, F=5 수정, G=6 수정근거
const COL_TICKET = 0, COL_AI = 4, COL_FIX = 5, COL_REASON = 6;

const FACT_HINTS = ["url", "http", "링크", "주소", "txid", "네트워크", "지원", "미지원", "익스플로러", "토큰", "컨트랙트"];
const RULE_HINTS = ["톤", "표현", "안내 방식", "순서", "제3자", "정책", "규칙", "저자세", "안심", "핑퐁", "플랫폼"];

function weeklyReview() {
  const tracking = SpreadsheetApp.openById(TRACKING_ID).getSheets()[0];
  const changelog = SpreadsheetApp.openById(CHANGELOG_ID).getSheets()[0];

  const rows = tracking.getDataRange().getValues();       // 헤더 포함
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
    const ticket = String(row[COL_TICKET] || "").trim();
    const ai = String(row[COL_AI] || "").trim();
    const fix = String(row[COL_FIX] || "").trim();
    const reason = String(row[COL_REASON] || "").trim();

    if (!fix) continue;                    // 수정 없음 → 학습 대상 아님
    if (!ai && hasMacro(reason)) continue; // 매크로 처리 → 제외
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
      "주간 자동 수집",        // 비고
    ]);
    seen[key] = true;
  }

  if (out.length) {
    changelog.getRange(changelog.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
  }
  Logger.log(out.length ? (out.length + "건 변경이력에 '검토 대기' 추가") : "추가할 수정 건 없음");
}

function hasMacro(reason) {
  const t = reason.toLowerCase();
  return MACRO_KEYWORDS.some(function (k) { return t.indexOf(k.toLowerCase()) !== -1; });
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
