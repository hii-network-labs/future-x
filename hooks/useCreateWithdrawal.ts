import { useState } from 'react';
import { useWalletClient, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { encodeFunctionData, parseUnits, type Hex } from 'viem';
import { MULTICALL_ABI, WETH_ABI, ERC20_ABI } from '../constants/abis';
import { CONTRACTS, FEES } from '../constants';
import toast from 'react-hot-toast';

interface CreateWithdrawalParams {
  marketAddress: `0x${string}`;
  marketTokenAddress: `0x${string}`; // The GM Token itself
  amount: string; // User input string "100.5" GM
  decimals: number; // Usually 18 for GM tokens
}

/**
 * Hook to create GMX withdrawals (remove liquidity) via creating a Withdrawal Order
 */
export function useCreateWithdrawal(address: `0x${string}` | undefined) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [txHash, setTxHash] = useState<Hex | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const createWithdrawal = async (params: CreateWithdrawalParams) => {
    if (!walletClient || !address || !publicClient) {
      toast.error('Wallet or Network not connected');
      throw new Error('Wallet/Network issue');
    }

    setIsCreating(true);
    let toastId;

    try {
      // 1. Parse amounts
      const amountBigInt = parseUnits(params.amount, params.decimals);
      const executionFee = parseUnits(FEES.minExecutionFee, 18); // ETH decimals

      // Helper to check receipt status
      const checkReceipt = (receipt: any, stepName: string) => {
        if (receipt.status !== 'success') {
          throw new Error(`${stepName} failed on-chain`);
        }
      };

      // 1. Check WNT Balance & Wrap if needed (User needs WNT for fee transfer)
      toastId = toast.loading('Checking WNT Balance...');
      try {
          const wntBalance = await publicClient.readContract({
              address: CONTRACTS.wnt as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address]
          }) as bigint;

          if (wntBalance < executionFee) {
              const needed = executionFee - wntBalance;
              toast.loading(`Wrapping ${Number(needed)/1e18} ETH for Fee...`, { id: toastId });
              console.log('🔄 Wrapping ETH for WNT Fee...');
              const hashWrap = await walletClient.writeContract({
                  address: CONTRACTS.wnt as `0x${string}`,
                  abi: WETH_ABI,
                  functionName: 'deposit',
                  value: needed,
                  gas: 500000n,
                  chain: undefined,
                  account: address
              });
              const receiptWrap = await publicClient.waitForTransactionReceipt({ hash: hashWrap });
              checkReceipt(receiptWrap, 'Wrap ETH');
              toast.success('Wrapped ETH successfully', { id: toastId });
          }
      } catch(e) {
          console.error("Auto-wrap failed", e);
          toast.error("Auto-wrap check failed. Proceeding...", { id: toastId });
          // Fallback: If wrap failed, subsequent transfer might fail if balance low, but we try.
      }

      // 2. Transfer WNT (Execution Fee) to Vault
      toast.loading('Transferring Fee...', { id: toastId });
      console.log('📤 Transferring WNT Fee...');
      const txFee = await walletClient.writeContract({
          address: CONTRACTS.wnt as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [CONTRACTS.withdrawalVault as `0x${string}`, executionFee],
          gas: 200000n,
          chain: undefined,
          account: address
      });
      const receiptFee = await publicClient.waitForTransactionReceipt({ hash: txFee });
      checkReceipt(receiptFee, 'Transfer Fee');

      // 3. Transfer GM to Vault
      toast.loading('Transferring GM...', { id: toastId });
      console.log('📤 Transferring GM...');
      const txGm = await walletClient.writeContract({
          address: params.marketTokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [CONTRACTS.withdrawalVault as `0x${string}`, amountBigInt],
          gas: 200000n,
          chain: undefined,
          account: address
      });
      const receiptGm = await publicClient.waitForTransactionReceipt({ hash: txGm });
      checkReceipt(receiptGm, 'Transfer GM');

      // 4. Create Withdrawal
      toast.loading('Finalizing Withdrawal...', { id: toastId });
      console.log('📝 Creating Withdrawal Call...');
      
      const withdrawalParams = {
        addresses: {
          receiver: address,
          callbackContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          uiFeeReceiver: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          market: params.marketAddress,
          longTokenSwapPath: [] as `0x${string}`[],
          shortTokenSwapPath: [] as `0x${string}`[],
        },
        minLongTokenAmount: 0n,
        minShortTokenAmount: 0n,
        shouldUnwrapNativeToken: true,
        executionFee,
        callbackGasLimit: 200000n,
        dataList: [] as `0x${string}`[],
      };

      const hash = await walletClient.writeContract({
        address: CONTRACTS.exchangeRouter as `0x${string}`,
        abi: MULTICALL_ABI, // Contains createWithdrawal
        functionName: 'createWithdrawal',
        args: [withdrawalParams],
        value: 0n, // Fee already sent in WNT
        gas: 3000000n,
        chain: undefined,
        account: address
      });

      console.log('✅ Withdrawal Submitted:', hash);
      setTxHash(hash);
      toast.success('Withdrawal submitted successfully!', { id: toastId });
      return hash;

    } catch (error: any) {
      console.error('❌ Withdrawal failed:', error);
      if (error.message?.includes('User rejected')) {
        toast.error('Transaction cancelled', { id: toastId });
      } else {
        toast.error('Withdrawal failed: ' + (error.shortMessage || error.message), { id: toastId });
      }
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createWithdrawal,
    isCreating,
    isConfirming,
    isConfirmed,
    txHash,
  };
}
