# D'CENT 온체인 익스플로러 매핑 (policy.md 하위 · 온체인 분석 전용)

> 온체인 트랜잭션 분석 시에만 쓰는 "네트워크 → 익스플로러" 매핑 표입니다.
> policy.md(답변 정책)와 분리해 관리 — 네트워크가 추가/변경되면 "이 파일만" 수정하면 됩니다.
> 온체인 분석 단계에서 이 파일을 읽어 URL을 구성하고 Glean Document Reader(또는 Brave)로 조회합니다.
> 변경 시 "D'CENT Glean Agent 변경 이력 (Changelog)" 시트에 기록.

## 사용 방법
1. 네트워크를 확인(이미지/양식필드/본문)하고 아래 표에서 티어를 찾습니다.
2. **Tier 1**: URL을 직접 구성 → Glean Document Reader로 읽어 상태/From·To/금액/컨펌을 추출.
3. **Tier 2**: 먼저 Document Reader 시도, 데이터 부족하면 Brave Web Search 폴백.
4. **Tier 3**: Brave Web Search로 `{TXID} site:{explorer}` 또는 `{TXID}` 검색. 익스플로러 URL은 내부노트에 첨부.
5. 표에 없는 네트워크: Brave Web Search로 `{TXID}` 검색해 올바른 익스플로러를 찾습니다.
- 추출 항목: 상태(Success/Failed/Pending), From/To 주소, 금액·토큰, 블록 컨펌 수, 가스/수수료.
- "페이지 못 읽음"으로 넘기지 말고 위 폴백을 반드시 사용합니다.

## ✅ Tier 1 — Glean Document Reader로 직접 읽기 가능 (URL 구성 → 직접 읽기)
- Bitcoin: https://mempool.space/tx/{TXID}
- Ethereum: https://etherscan.io/tx/{TXID}
- BSC: https://bscscan.com/tx/{TXID}
- Polygon: https://polygonscan.com/tx/{TXID}
- Avalanche: https://snowtrace.io/tx/{TXID}
- Arbitrum: https://arbiscan.io/tx/{TXID}
- Optimism: https://optimistic.etherscan.io/tx/{TXID}
- Base: https://basescan.org/tx/{TXID}
- Sonic: https://sonicscan.org/tx/{TXID}
- Solana: https://solscan.io/tx/{TXID}
- Stellar: https://stellar.expert/explorer/public/tx/{TXID}
- TRON: https://tronscan.org/#/transaction/{TXID}
- Hedera: https://mainnet-public.mirrornode.hedera.com/api/v1/transactions/{TXID}  (JSON API, GET)
- Stacks: https://explorer.stacks.co/txid/{TXID}

## ⚠️ Tier 2 — 부분 읽기(JS 렌더링, 제한적) → 시도 후 부족하면 Brave 폴백
- Kaia: https://kaiascan.io/tx/{TXID}
- opBNB: https://opbnbscan.com/tx/{TXID}

## ❌ Tier 3 — Document Reader 불가 → Brave Web Search(`{TXID} site:{explorer}` 또는 `{TXID}`)
- 네트워크: XRP, XRPL EVM, XDC, Flare, Gnosis, Cronos, Chiliz, VeChain, Conflux, Celo, HyperEVM, Scroll, Injective, Fantom Opera, HYPE Mainnet(Hyperliquid)
- HYPE Mainnet 예외: 익스플로러가 JS SPA + 공식 API가 POST 전용이라 자동 조회 불가.
  내부노트에 https://hypurrscan.io/address/{ADDRESS} 를 첨부하고 "⚠️ CS팀 직접 확인 필요"를 추가.

---
※ 이 표는 기존 Email Drafter 지침에서 옮긴 것입니다. 네트워크 추가/익스플로러 변경 시 이 파일만 갱신하세요.
