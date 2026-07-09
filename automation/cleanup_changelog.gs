/**
 * 변경이력(Changelog) 1회 정리
 * - 티켓칸(C열)이 "비어 있거나 / 날짜 / 이메일 등 티켓이 아닌" 쓰레기·중복 행을 삭제.
 * - 옛 스크립트가 열이 어긋난 상태에서 수집해 생긴 깨진 행(빈 티켓·날짜 티켓)을 청소하는 용도.
 *
 * 정상 티켓 판별: C열이 "…/tickets/숫자" URL 이거나 6자리 이상 숫자면 정상(유지),
 *                그 외(빈칸/Date/이메일/날짜문자열)는 삭제.
 *
 * 사용법 (안전):
 *  1) (권장) 변경이력 시트를 먼저 백업 — 파일 > 사본 만들기.
 *  2) 이 함수를 Apps Script에 추가 후 그대로 실행 → 실행 로그에서 "[DRY RUN] 삭제 예정 N행: ..." 확인.
 *  3) 목록이 맞으면 함수 안의 DRY_RUN 을 false 로 바꿔 다시 실행 → 실제 삭제.
 */
function cleanupChangelog() {
  const CHANGELOG_ID = "1j_qaGMf5tvcHVIdc06zetZT66syjMRAKvMNfaPPx8ic";
  const DRY_RUN = true;   // ★먼저 true로 실행해 로그 확인 → 문제없으면 false로 바꿔 재실행하면 실제 삭제

  const sh = SpreadsheetApp.openById(CHANGELOG_ID).getSheets()[0];
  const values = sh.getDataRange().getValues();

  // 헤더: 1행 = URL, 2행 = 열 이름 → 데이터는 3행부터(0-based 인덱스 2)
  // 열: A(0)변경일자 B(1)근거시트행 C(2)티켓
  const toDelete = [];
  for (let i = 2; i < values.length; i++) {
    const rowNum = i + 1;                 // 실제 시트 행번호
    const a = values[i][0];               // 변경일자
    const c = values[i][2];               // 티켓
    if (a === '' || a === null) continue; // 완전 빈 행 스킵
    if (!isValidTicketCell(c)) toDelete.push(rowNum);
  }

  Logger.log((DRY_RUN ? "[DRY RUN] 삭제 예정 " : "삭제 ") + toDelete.length + "행: " + toDelete.join(", "));

  if (!DRY_RUN) {
    toDelete.sort(function (a, b) { return b - a; }); // 아래→위로 삭제(인덱스 밀림 방지)
    toDelete.forEach(function (r) { sh.deleteRow(r); });
    Logger.log("삭제 완료: " + toDelete.length + "행");
  }
}

function isValidTicketCell(v) {
  if (v instanceof Date) return false;            // 날짜 → 쓰레기(옛 스크립트가 답변날짜를 티켓칸에 잘못 기입)
  const s = String(v == null ? '' : v).trim();
  if (s === '') return false;                      // 빈칸 → 쓰레기
  if (s.indexOf('/tickets/') !== -1) return true;  // 티켓 URL → 정상
  if (/^\d{6,}$/.test(s)) return true;             // 티켓번호(6자리+) → 정상
  return false;                                    // 이메일/날짜문자열 등 → 쓰레기
}
