# Debug Logs Guide - Entry Price Investigation

## Logs Added

### 1. `useGmxProtocol.ts` - Price Polling
**Location:** Every 2 seconds when keeper API returns prices

```
[useGmxProtocol] Price Update from Keeper:
{
  timestamp: "2026-01-09T...",
  activeIndexToken: "0xd020d6D...",
  prices: { ... },        // Raw 30-decimal prices
  formattedPrices: { ... } // Formatted USD prices
}
```

**Purpose:** Verify keeper is returning correct prices

---

### 2. `useGmxProtocol.ts` - Current Price Calculation
**Location:** When `currentPrice` state updates

```
[useGmxProtocol] Current Price Calculation:
{
  activeIndexToken: "0xd020d6D...",
  raw: "2839278219000000000000000000000000",
  formatted: 2839.28,
  fallback: 2855.40
}
```

**Purpose:** Check if price formatting is correct

---

### 3. `usePositions.ts` - Entry Price Calculation
**Location:** For each position when contract data is parsed

```
[Position #0] Entry Price Calculation:
{
  side: "LONG" | "SHORT",
  market: "0x68dE25139...",
  rawData: {
    sizeInUsd_raw: "...",
    sizeInTokens_raw: "...",
    collateralAmount_raw: "..."
  },
  parsed: {
    sizeInUsd: "1000.00",
    sizeInTokens: "0.352113",
    indexDecimals: 18,
    collateralAmount: "100.000000",
    collateralDecimals: 6
  },
  prices: {
    entryPrice: "2839.28",
    currentPrice: "2850.00",
    collateralPrice: "0.91"
  },
  calculation: {
    formula: "sizeInUsd / sizeInTokens",
    numerator: 1000,
    denominator: 0.352113,
    result: 2839.28
  }
}
```

**Purpose:** Trace entry price calculation step-by-step

---

### 4. `usePositions.ts` - Final Position Object
**Location:** After all calculations complete

```
[Position #0] Final Position Object:
{
  id: "pos-0",
  market: "ETH-USDC",
  side: "LONG",
  size: 1000,
  collateral: 100,
  entryPrice: 2839.28,  ← THIS IS THE VALUE SHOWN IN UI
  markPrice: 2850,
  leverage: 10,
  liqPrice: 2555.35,
  pnl: 3.79
}
```

**Purpose:** See exactly what's passed to UI components

---

## How to Debug

### Step 1: Open Browser Console
```
Right-click → Inspect → Console Tab
```

### Step 2: Filter Logs
```
# See only position logs
Filter: [Position

# See only price logs  
Filter: [useGmxProtocol]
```

### Step 3: Create Test Position
1. Open a new Long or Short position
2. Wait for position to appear
3. Check console logs

### Step 4: Identify Issue

**If entryPrice shows 50000 or 100:**

Check `[Position #0] Entry Price Calculation` log:

- **Case 1: `sizeInTokens` is wrong**
  ```
  sizeInTokens: "0.000002"  ← TOO SMALL
  ```
  → Problem: Index decimals wrong or contract saved wrong value

- **Case 2: `sizeInUsd` is wrong**
  ```
  sizeInUsd: "100.00"
  sizeInTokens: "1.000000"
  result: 100  ← MATCHES SYMPTOM
  ```
  → Problem: Contract saved wrong sizeInUsd

- **Case 3: Division is correct but display is wrong**
  ```
  result: 2839.28  ← CORRECT
  entryPrice in Final Object: 50000  ← UI BUG
  ```
  → Problem: UI component formatting issue

---

## Expected vs Current

**Expected behavior:**
```
Entry Long @ $2850
→ sizeInUsd: 1000
→ sizeInTokens: 0.350877 (= 1000 / 2850)
→ entryPrice: 2850 (= 1000 / 0.350877)
```

**If seeing 50000:**
```
? → entryPrice: 50000
```

Check logs to find where the 50000 comes from.

---

## Next Steps

1. **Open position** in UI
2. **Check console** for logs
3. **Share screenshot** of the relevant log entries
4. We'll identify exact issue from the data
