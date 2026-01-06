import { useReadContracts } from 'wagmi';
import { READER_ABI, ERC20_ABI } from '../constants/abis';
import { CONTRACTS } from '../constants';
import { useMemo } from 'react';

export function useMetadata(marketAddresses: string[], tokenAddresses: string[]) {
  const uniqueTokens = Array.from(new Set(tokenAddresses)).filter(a => !!a && a !== '0x0000000000000000000000000000000000000000');
  const uniqueMarkets = Array.from(new Set(marketAddresses)).filter(a => !!a && a !== '0x0000000000000000000000000000000000000000');

  // Fetch Market Info (to get index token)
  const marketContracts = uniqueMarkets.map(addr => ({
    address: CONTRACTS.reader as `0x${string}`,
    abi: READER_ABI,
    functionName: 'getMarket',
    args: [CONTRACTS.dataStore as `0x${string}`, addr as `0x${string}`],
  }));

  const { data: marketsData } = useReadContracts({
    contracts: marketContracts as any,
  }) as { data: any[] };

  // Extract all relevant tokens from markets
  const marketTokens = useMemo(() => {
    if (!marketsData) return [];
    return marketsData.map((res: any) => res.result?.indexToken).filter(a => !!a);
  }, [marketsData]);

  const allTokens = Array.from(new Set([...uniqueTokens, ...marketTokens])).filter(a => !!a);

  // Fetch Token Symbols
  const tokenContracts = allTokens.map(addr => ({
    address: addr as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'symbol',
  }));

  const { data: tokensData } = useReadContracts({
    contracts: tokenContracts as any,
  }) as { data: any[] };

  // Map results
  const metadata = useMemo(() => {
    const tokenSymbols: Record<string, string> = {
      [CONTRACTS.usdc.toLowerCase()]: 'USDC',
      [CONTRACTS.wnt.toLowerCase()]: 'HNC',
    };
    const marketIndexTokens: Record<string, string> = {
      [CONTRACTS.market.toLowerCase()]: CONTRACTS.wnt.toLowerCase(),
    };

    if (tokensData && Array.isArray(tokensData)) {
      allTokens.forEach((addr, i) => {
        const symbol = tokensData[i]?.result as string;
        if (symbol) {
          tokenSymbols[addr.toLowerCase()] = symbol === 'WNT' ? 'HNC' : symbol;
        }
      });
    }

    if (marketsData && Array.isArray(marketsData)) {
      uniqueMarkets.forEach((addr, i) => {
        const indexToken = marketsData[i]?.result?.indexToken as string;
        if (indexToken) {
          marketIndexTokens[addr.toLowerCase()] = indexToken.toLowerCase();
        }
      });
    }

    console.log('Resolved Metadata:', { tokenSymbols, marketIndexTokens });
    return { tokenSymbols, marketIndexTokens };
  }, [tokensData, marketsData, allTokens, uniqueMarkets]);

  const getMarketName = (marketAddr: string, collateralAddr: string) => {
    const marketLower = marketAddr.toLowerCase();
    const collateralLower = collateralAddr.toLowerCase();
    
    const indexToken = metadata.marketIndexTokens[marketLower];
    const indexSymbol = indexToken ? metadata.tokenSymbols[indexToken] : '???';
    const collateralSymbol = metadata.tokenSymbols[collateralLower] || '???';

    return `${indexSymbol}-USD (${collateralSymbol})`;
  };

  return {
    ...metadata,
    getMarketName,
    getTokenSymbol: (addr: string) => metadata.tokenSymbols[addr.toLowerCase()] || '???',
  };
}
