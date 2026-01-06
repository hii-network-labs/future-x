import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { erc20Abi, maxUint256, formatUnits } from 'viem';
import toast from 'react-hot-toast';

interface UseTokenApprovalParams {
  tokenAddress: `0x${string}`;
  spenderAddress: `0x${string}`;
  amount: bigint; // Amount needed
}

export function useTokenApproval({ tokenAddress, spenderAddress, amount }: UseTokenApprovalParams) {
  const { address } = useAccount();
  const [isApproving, setIsApproving] = useState(false);

  // Read Allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, spenderAddress] : undefined,
    query: {
      enabled: !!address && !!tokenAddress && !!spenderAddress,
    }
  });

  // Write Contract (Approve)
  const { writeContractAsync, data: txHash } = useWriteContract();

  // Wait for Receipt
  const { isLoading: isWaitingForTx, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isApproved = allowance ? allowance >= amount : false;

  useEffect(() => {
    if (isConfirmed) {
      refetchAllowance();
      setIsApproving(false);
      toast.success('Token approval confirmed!');
    }
  }, [isConfirmed, refetchAllowance]);

  const approve = async () => {
    if (!address) return;
    try {
      setIsApproving(true);
      const hash = await writeContractAsync({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spenderAddress, maxUint256], // Approve max for convenience
      });
      toast.success('Approval submitted. Waiting for confirmation...');
      return hash;
    } catch (error: any) {
      console.error('Approval failed:', error);
      setIsApproving(false);
      if (!error.message?.includes('User rejected')) {
        toast.error('Approval failed: ' + (error.shortMessage || error.message));
      }
    }
  };

  return {
    isApproved,
    isApproving: isApproving || isWaitingForTx,
    approve,
    allowance,
    isConfirming: isWaitingForTx,
  };
}
