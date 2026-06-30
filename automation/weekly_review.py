#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
주간 검수 자동 수집 스크립트 (자동 제안 + 사람 승인 방식)

매주 금요일 GitHub Actions가 실행:
  1) 추적 시트(검수 추적)를 읽는다
  2) "기본 매크로 답변"으로 처리한 행은 제외한다
  3) "수정"이 실제로 들어간(=수정 필요) 행만 추린다
  4) 변경유형(RULE/FACT/ONE-OFF)을 가볍게 '제안'한다 (사람이 최종 확인)
  5) 변경이력 시트에 "검토 대기"로 추가한다 (이미 있는 건 중복 추가 안 함)

※ policy.md 자동 수정/배포는 하지 않는다. 사람이 금요일에 검토 후 직접 반영.
"""

import os
import json
import datetime
import gspread
from google.oauth2.service_account import Credentials

# ---------- 설정 ----------
# 추적 시트(검수 추적) / 변경이력 시트 ID
TRACKING_SHEET_ID = "1lNJr_75ncoYtpPH_akwNEqWWu6byT-wdgS7CssjVyk4"
CHANGELOG_SHEET_ID = "1j_qaGMf5tvcHVIdc06zetZT66syjMRAKvMNfaPPx8ic"

# "기본 매크로 답변"으로 간주해 제외할 키워드 (수정 근거 및 사유 / 수정 칸에서 탐지)
MACRO_KEYWORDS = ["매크로", "macro", "기본 답변", "기본답변", "기본 매크로"]

# 추적 시트 열 인덱스 (0-based): A=티켓번호 ... F=수정, G=수정 근거 및 사유
COL_TICKET = 0   # A 티켓번호
COL_FIX = 5      # F 수정
COL_REASON = 6   # G 수정 근거 및 사유

# 변경유형 제안용 키워드
FACT_HINTS = ["url", "http", "링크", "주소", "txid", "네트워크", "지원", "미지원", "익스플로러", "토큰", "컨트랙트"]
RULE_HINTS = ["톤", "표현", "안내 방식", "순서", "제3자", "정책", "규칙", "저자세", "안심", "핑퐁", "플랫폼"]

KST = datetime.timezone(datetime.timedelta(hours=9))
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def get_client():
    raw = os.environ["GOOGLE_SA_KEY"]  # GitHub Secret (서비스 계정 JSON 문자열)
    info = json.loads(raw)
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return gspread.authorize(creds)


def suggest_change_type(text: str) -> str:
    t = (text or "").lower()
    is_fact = any(h in t for h in FACT_HINTS)
    is_rule = any(h in t for h in RULE_HINTS)
    if is_fact and is_rule:
        return "RULE+FACT(검토)"
    if is_fact:
        return "FACT(검토)"
    if is_rule:
        return "RULE(검토)"
    return "검토 필요"


def is_macro(reason: str, fix: str) -> bool:
    blob = f"{reason} {fix}".lower()
    return any(kw.lower() in blob for kw in MACRO_KEYWORDS)


def main():
    gc = get_client()
    tracking = gc.open_by_key(TRACKING_SHEET_ID).sheet1
    changelog = gc.open_by_key(CHANGELOG_SHEET_ID).sheet1

    rows = tracking.get_all_values()  # 헤더 포함 전체
    existing = changelog.get_all_values()

    # 이미 변경이력에 있는 (근거시트행, 티켓번호) 조합 → 중복 방지
    seen = set()
    for r in existing[1:]:
        if len(r) >= 3:
            seen.add((str(r[1]).strip(), str(r[2]).strip()))  # B 근거시트행, C 티켓번호

    today = datetime.datetime.now(KST).strftime("%Y-%m-%d")
    new_rows = []

    # 데이터는 2행부터 (1행은 헤더). 시트 실제 행번호 = idx (1-based)
    for idx, row in enumerate(rows[1:], start=2):
        def cell(i):
            return row[i].strip() if len(row) > i and row[i] else ""

        ticket = cell(COL_TICKET)
        fix = cell(COL_FIX)
        reason = cell(COL_REASON)

        # 1) 수정이 없으면(=초안 그대로 나감) 제외
        if not fix:
            continue
        # 2) 기본 매크로 답변 처리 건 제외
        if is_macro(reason, fix):
            continue
        # 3) 중복 제외
        key = (str(idx), str(ticket))
        if key in seen:
            continue

        change_type = suggest_change_type(f"{reason} {fix}")
        # 변경이력 열 순서: 변경일자, 근거시트행, 티켓번호, 변경유형, 수정이유, agent수정내용, 적용여부, 비고
        new_rows.append([
            today,
            str(idx),
            ticket,
            change_type,
            reason or "(수정 근거 미기재)",
            "(검토 후 작성 — policy.md 반영 내용)",
            "검토 대기",
            "주간 자동 수집",
        ])
        seen.add(key)

    if new_rows:
        changelog.append_rows(new_rows, value_input_option="USER_ENTERED")
        print(f"[OK] {len(new_rows)}건 변경이력에 '검토 대기'로 추가")
    else:
        print("[OK] 새로 추가할 수정 건 없음")


if __name__ == "__main__":
    main()
