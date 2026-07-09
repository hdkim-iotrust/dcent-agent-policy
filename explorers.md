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
- Flare: https://flare-explorer.flare.network/tx/{TXID}  (Blockscout 계열, 실제 조회 확인됨 — 티켓 2021092157)

## 🔌 EVM RPC 폴백 — 익스플로러가 JS 렌더로 안 읽힐 때 (주소의 잔액·사용 이력 판정)
> 익스플로러 페이지가 안 읽히면(특히 Tier 2 Kaia 등), 아래 public RPC에 JSON-RPC POST로 "주소가 비었는지/쓰인 적 있는지"를 결정론적으로 확인합니다.
> 용도: "고객이 준 주소에 자산이 실제로 있는가" 판정 → 없으면 '숨은 잔액'이 아니라 다른 주소(Legacy 파생경로)나 예치 컨트랙트를 봐야 함(policy.md I·G 참조).
- 확인 항목:
  - 네이티브 잔액: `eth_getBalance` [address,"latest"] → 0x0 이면 네이티브 코인 없음.
  - 사용 이력(보낸 tx 수): `eth_getTransactionCount` [address,"latest"] → 0x0 이면 이 체인에서 한 번도 안 쓰인 주소(수신도 없었을 가능성 높음).
  - 계정 유형: `eth_getCode` [address,"latest"] → 0x 이면 일반 지갑(EOA), 아니면 컨트랙트.
  - 특정 토큰 잔액: `eth_call` to=토큰컨트랙트, data=`0x70a08231` + 좌측 0패딩된 주소(balanceOf).
- 네트워크별 public RPC:
  - Kaia (chainId 8217): https://public-en.node.kaia.io
  - Ethereum: https://eth.llamarpc.com
  - BSC: https://bsc-dataseed.binance.org
  - Polygon: https://polygon-rpc.com
  - Base: https://mainnet.base.org
  - Arbitrum: https://arb1.arbitrum.io/rpc
  - Optimism: https://mainnet.optimism.io
  - Avalanche C: https://api.avax.network/ext/bc/C/rpc
  - (표에 없으면 Chainlist에서 해당 chainId의 public RPC 확인)
- 주의: RPC 조회 결과(잔액 0·nonce 0)는 내부 노트에만 근거로 남기고, 고객 주소·값은 policy.md/explorers.md 같은 공개 문서에 절대 기록하지 않습니다.

## ❌ Tier 3 — Document Reader 불가 → Brave Web Search(`{TXID} site:{explorer}` 또는 `{TXID}`)
- 네트워크: XRP, XRPL EVM, XDC, Gnosis, Cronos, Chiliz, VeChain, Conflux, Celo, HyperEVM, Scroll, Injective, Fantom Opera, HYPE Mainnet(Hyperliquid)
- HYPE Mainnet 예외: 익스플로러가 JS SPA + 공식 API가 POST 전용이라 자동 조회 불가.
  내부노트에 https://hypurrscan.io/address/{ADDRESS} 를 첨부하고 "⚠️ CS팀 직접 확인 필요"를 추가.

---
※ 이 표는 기존 Email Drafter 지침에서 옮긴 것입니다. 네트워크 추가/익스플로러 변경 시 이 파일만 갱신하세요.
