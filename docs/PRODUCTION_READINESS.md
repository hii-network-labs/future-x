# Production Readiness Checklist

## 🎯 Current Status Overview

This document tracks what's **REAL** vs **MOCK** in the Custom GMX Futures Console and provides a roadmap to production.

## ✅ Real (Production Ready)

### Authentication & Wallet
- ✅ **Wallet Connection** - Using Wagmi + RainbowKit
- ✅ **Chain Detection** - Real chain ID verification
- ✅ **Address Tracking** - Real user address from wallet

### Price Feeds
- ✅ **Real-time Prices** - Polling from Keeper Service (`/prices` endpoint)
- ✅ **ETH/USD Price** - Live oracle data (30 decimals)
- ✅ **USDC Price** - Live oracle data

### Configuration
- ✅ **Environment Variables** - All config from `.env.local`
- ✅ **Contract Addresses** - Configurable via env
- ✅ **RPC URL** - Configurable via env
- ✅ **Keeper API URL** - Configurable via env

---

## ❌ Mock (Needs Implementation)

### 1. Balance Display
**Location**: `components/OrderPanel.tsx:53`
```typescript
<span className="text-[10px] text-gray-400">Bal: 12,450.00 USDC</span>
```

**Fix Required**:
```typescript
// Add to useGmxProtocol.ts
import { useBalance } from 'wagmi';

const { data: usdcBalance } = useBalance({
  address: userAddress,
  token: CONTRACTS.usdc,
  watch: true
});

const formattedBalance = usdcBalance 
  ? Number(formatUnits(usdcBalance.value, 6)).toFixed(2)
  : '0.00';
```

**Priority**: 🔴 **CRITICAL** - Required for input validation

---

### 2. Portfolio Overview
**Location**: `components/Portfolio.tsx` (entire component)

**Mock Data**:
- Total PnL: `+$1,450.25` (line 20)
- Net Value: `$12,840.45` (line 26)
- Collateral Assets: `$10,000.00` (line 27)
- Open Interest: `$50,000.00` (line 28)
- Asset Allocation: Hardcoded percentages (lines 46-48)

**Fix Required**:
```typescript
// Fetch real balances
const { data: usdcBalance } = useBalance({ address, token: CONTRACTS.usdc });
const { data: wntBalance } = useBalance({ address, token: CONTRACTS.wnt });

// Fetch positions from Reader contract
const { data: positions } = useQuery({
  queryKey: ['positions', address],
  queryFn: async () => {
    const posInfos = await publicClient.readContract({
      address: CONTRACTS.reader,
      abi: READER_ABI,
      functionName: 'getAccountPositions',
      args: [CONTRACTS.dataStore, address, 0n, 50n]
    });
    return posInfos;
  }
});

// Calculate total PnL from positions
const totalPnL = positions?.reduce((sum, pos) => sum + calculatePnL(pos), 0) || 0;
```

**Priority**: 🟡 **HIGH** - Portfolio is a key feature

---

### 3. Position Fetching
**Location**: `hooks/useGmxProtocol.ts:42-54`

**Current**: Empty stub function
```typescript
const fetchPositions = useCallback(async () => {
  if (!address) return;
  setIsLoading(true);
  try {
    // TODO: Real implementation
    setIsLoading(false);
  } catch (e) {
    setIsLoading(false);
  }
}, [address]);
```

**Fix Required**:
```typescript
import { usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';

const publicClient = usePublicClient();

const { data: positions } = useQuery({
  queryKey: ['positions', address],
  queryFn: async () => {
    if (!publicClient || !address) return [];
    
    const posInfos = await publicClient.readContract({
      address: CONTRACTS.reader as `0x${string}`,
      abi: READER_ABI,
      functionName: 'getAccountPositions',
      args: [CONTRACTS.dataStore as `0x${string}`, address, 0n, 50n]
    });
    
    return posInfos.map(pos => ({
      id: `pos-${Date.now()}`,
      market: 'ETH-PERP',
      side: pos.flags.isLong ? MarketSide.LONG : MarketSide.SHORT,
      size: Number(formatUnits(pos.numbers.sizeInUsd, 30)),
      collateral: Number(formatUnits(pos.numbers.collateralAmount, 6)),
      entryPrice: calculateEntryPrice(pos),
      markPrice: currentEthPrice,
      leverage: calculateLeverage(pos),
      liqPrice: calculateLiqPrice(pos),
      pnl: calculatePnL(pos, currentEthPrice)
    }));
  },
  enabled: !!publicClient && !!address,
  refetchInterval: 3000
});
```

**Priority**: 🔴 **CRITICAL** - Core trading feature

---

### 4. Order Creation (Multicall)
**Location**: `hooks/useGmxProtocol.ts:60-91`

**Current**: Simulated with `setTimeout`
```typescript
// Simulate the async nature of keeper execution
return new Promise((resolve) => {
  setTimeout(() => resolve("0x" + Math.random().toString(16).slice(2)), 1000);
});
```

**Fix Required**:
```typescript
import { useWalletClient } from 'wagmi';
import { encodeFunctionData, parseUnits } from 'viem';

const { data: walletClient } = useWalletClient();

const createOrder = async (params) => {
  if (!walletClient || !address) {
    throw new Error('Wallet not connected');
  }

  const sizeDeltaUsd = parseUnits(params.sizeDeltaUsd.toString(), 30);
  const collateralAmount = parseUnits(params.collateralAmount.toString(), 6);
  const executionFee = parseUnits(FEES.minExecutionFee, 18);

  // Build multicall
  const calls = [
    encodeFunctionData({
      abi: MULTICALL_ABI,
      functionName: 'sendWnt',
      args: [CONTRACTS.orderVault, executionFee]
    }),
    encodeFunctionData({
      abi: MULTICALL_ABI,
      functionName: 'sendTokens',
      args: [CONTRACTS.usdc, CONTRACTS.orderVault, collateralAmount]
    }),
    encodeFunctionData({
      abi: MULTICALL_ABI,
      functionName: 'createOrder',
      args: [orderParams]
    })
  ];

  const txHash = await walletClient.writeContract({
    address: CONTRACTS.exchangeRouter as `0x${string}`,
    abi: MULTICALL_ABI,
    functionName: 'multicall',
    args: [calls],
    value: executionFee
  });

  return txHash;
};
```

**Priority**: 🔴 **CRITICAL** - Cannot trade without this

---

### 5. Input Validation
**Location**: `components/OrderPanel.tsx` (entire form)

**Missing**:
- ❌ Balance validation (collateral > balance)
- ❌ Minimum collateral check ($1 minimum)
- ❌ Token approval check
- ❌ Execution fee validation (wallet has enough ETH)

**Fix Required**:
```typescript
// Add validation hook
const useOrderValidation = (collateral: string, leverage: number) => {
  const { data: usdcBalance } = useBalance({ address, token: CONTRACTS.usdc });
  const { data: ethBalance } = useBalance({ address });
  
  const collateralNum = Number(collateral);
  const executionFeeEth = Number(FEES.minExecutionFee);
  
  const errors = {
    insufficientCollateral: collateralNum > Number(formatUnits(usdcBalance?.value || 0n, 6)),
    belowMinimum: collateralNum < 1,
    insufficientGas: Number(formatUnits(ethBalance?.value || 0n, 18)) < executionFeeEth,
    leverageTooHigh: leverage > 50
  };
  
  const isValid = !Object.values(errors).some(Boolean);
  
  return { errors, isValid };
};

// In OrderPanel component:
const { errors, isValid } = useOrderValidation(collateralAmount, leverage);

// Update submit button
<button
  onClick={handleSubmit}
  disabled={!isWalletConnected || !isValid || isSubmitting}
>
  {errors.insufficientCollateral && 'Insufficient Balance'}
  {errors.belowMinimum && 'Minimum $1 Collateral'}
  {errors.insufficientGas && 'Insufficient Gas'}
  {!errors && `Open ${side === MarketSide.LONG ? 'Long' : 'Short'}`}
</button>
```

**Priority**: 🔴 **CRITICAL** - Prevent failed transactions

---

### 6. Token Approvals
**Location**: Missing entirely

**Fix Required**:
```typescript
import { useBalance, useReadContract, useWriteContract } from 'wagmi';

// Check allowance
const { data: allowance } = useReadContract({
  address: CONTRACTS.usdc,
  abi: ERC20_ABI,
  functionName: 'allowance',
  args: [address, CONTRACTS.exchangeRouter]
});

// Approve if needed
const { writeContract: approve } = useWriteContract();

const handleApprove = async () => {
  await approve({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [CONTRACTS exchangeRouter, MAX_UINT256]
  });
};

// In OrderPanel: Show approve button if allowance insufficient
{allowance < collateralAmount && (
  <button onClick={handleApprove}>
    Approve USDC
  </button>
)}
```

**Priority**: 🔴 **CRITICAL** - Required before first trade

---

### 7. Order & Position Display
**Location**: `components/TradeConsole.tsx`

**Current**: Simulated orders stored in local state
```typescript
const [positions, setPositions] = useState<Position[]>([]);
const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(MOCK_ORDERS);
```

**Fix Required**:
Already partially implemented in working UI (`gmx-sdk/frontend`). Need to copy:
- `PositionsPanel` with real Reader integration
- `PendingOrdersPanel` with real order fetching

**Priority**: 🟡 **HIGH** - Users need to see their positions

---

### 8. Liquidity Operations (LP)
**Location**: `components/LiquidityConsole.tsx`

**Mock Data**: Entire component uses `MOCK_VAULTS` and `MOCK_LP_POSITIONS`

**Fix Required**:
```typescript
// Fetch GM token balance (LP shares)
const { data: gmBalance } = useBalance({
  address: userAddress,
  token: CONTRACTS.market // GM token is the market address
});

// Deposit implementation (similar to INTEGRATION_GUIDE.md Section 5)
const { writeContract: deposit } = useWriteContract();

const handleDeposit = async (usdcAmount: string) => {
  // 1. Transfer USDC to DepositVault
  // 2. Wrap ETH for execution fee
  // 3. Transfer WNT to DepositVault
  // 4. Call createDeposit
};
```

**Priority**: 🟢 **MEDIUM** - Feature exists but is optional

---

## 📋 Implementation Roadmap

### Phase 1: Critical Functionality (Required for Trading)
1. ✅ **Wallet Connection** - DONE
2. ✅ **Price Feeds** - DONE
3. 🔴 **Balance Display** - IN PROGRESS
4. 🔴 **Input Validation** - TO DO
5. 🔴 **Token Approvals** - TO DO
6. 🔴 **Order Creation (Real Multicall)** - TO DO
7. 🔴 **Position Fetching** - TO DO

**Estimated Time**: 4-6 hours

---

### Phase 2: User Experience
1. 🟡 **Order Display** - TO DO
2. 🟡 **Position Display with PnL** - TO DO
3. 🟡 **Portfolio Dashboard** - TO DO
4. 🟡 **Close Position** - TO DO

**Estimated Time**: 3-4 hours

---

### Phase 3: Advanced Features
1. 🟢 **Liquidity Deposit** - TO DO
2. 🟢 **Liquidity Withdraw** - TO DO
3. 🟢 **Historical Trade Data** - TO DO

**Estimated Time**: 4-5 hours

---

## 🔧 Quick Copy-Paste Aids

### Required ABIs (Create `constants/abis.ts`)
```typescript
export const MULTICALL_ABI = [ /* ... from working UI ... */ ];
export const READER_ABI = [ /* ... from working UI ... */ ];
export const ERC20_ABI = [ /* ... */ ];
```

### Reference Implementation
All real implementations exist in:
```
/Users/macbookairm1/Documents/backup/blockchain-ecos/future-trade-UI/gmx-sdk/frontend/
```

Copy these files:
- `hooks/usePositions.ts`
- `hooks/useCreateOrder.ts`
- `hooks/useDeposit.ts`
- `components/ClosePositionButton.tsx`
- `constants/abis.ts`

---

## 🚦 Testing Checklist

Before going to production:

### Wallet & Connection
- [ ] Connect wallet with MetaMask
- [ ] Verify correct chain detection
- [ ] Test wrong network warning
- [ ] Test disconnect/reconnect

### Trading Flow
- [ ] Display real USDC balance
- [ ] Validate: Collateral > Balance (should fail)
- [ ] Validate: Insufficient gas (should fail)
- [ ] Approve USDC for ExchangeRouter
- [ ] Create market long order
- [ ] Create market short order
- [ ] Verify order appears in pending
- [ ] Wait for keeper execution
- [ ] Verify position appears in list
- [ ] Calculate PnL correctly
- [ ] Close position

### Edge Cases
- [ ] Test with 0 balance
- [ ] Test with partial balance
- [ ] Test max leverage (50x)
- [ ] Test minimum collateral ($1)
- [ ] Test network interruption
- [ ] Test rejected transaction

---

## 📚 Documentation

- **Setup Guide**: `SETUP_GUIDE.md`
- **Integration Guide**: `INTEGRATION_GUIDE.md`
- **Working Reference**: `../gmx-sdk/frontend/`

---

**Last Updated**: 2026-01-05
**Status**: 🟡 Demo Ready (Mock Data), ⏳ Production Pending (Phase 1-3)
