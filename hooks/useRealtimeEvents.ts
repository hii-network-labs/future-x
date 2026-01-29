/**
 * Real-Time Events Hook
 * 
 * Connects to keeper-service WebSocket and listens for execution events.
 * Automatically invalidates React Query caches when events are received.
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

// WebSocket URL - uses same base as API but /events namespace
const WS_URL = (import.meta.env.VITE_KEEPER_API_URL || 'http://localhost:3000') + '/events';

// ============================================================================
// TYPES
// ============================================================================

type ExecutionEventType = 
  | 'ORDER_EXECUTED' 
  | 'ORDER_CANCELLED' 
  | 'ORDER_FAILED'
  | 'DEPOSIT_EXECUTED'
  | 'DEPOSIT_FAILED'
  | 'WITHDRAWAL_EXECUTED'
  | 'WITHDRAWAL_FAILED';

interface ExecutionEvent {
  type: ExecutionEventType;
  wallet: string;
  data: {
    key: string;
    market?: string;
    status: 'success' | 'failed' | 'cancelled';
    txHash?: string;
    message?: string;
  };
  timestamp: number;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRealtimeEvents(walletAddress: string | undefined) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Handle incoming execution events
  const handleExecutionEvent = useCallback((event: ExecutionEvent) => {
    console.log('📡 Received real-time event:', event);

    // Invalidate relevant caches based on event type
    switch (event.type) {
      case 'ORDER_EXECUTED':
        queryClient.invalidateQueries({ queryKey: ['apiPositions'] });
        queryClient.invalidateQueries({ queryKey: ['positions'] });
        queryClient.invalidateQueries({ queryKey: ['positionHistory'] });
        toast.success('Order executed successfully!', { id: `order-${event.data.key.slice(0, 10)}` });
        break;

      case 'ORDER_CANCELLED':
      case 'ORDER_FAILED':
        queryClient.invalidateQueries({ queryKey: ['apiPositions'] });
        queryClient.invalidateQueries({ queryKey: ['positions'] });
        toast.error(`Order ${event.type === 'ORDER_CANCELLED' ? 'cancelled' : 'failed'}: ${event.data.message || 'Unknown error'}`, 
          { id: `order-${event.data.key.slice(0, 10)}` });
        break;

      case 'DEPOSIT_EXECUTED':
        queryClient.invalidateQueries({ queryKey: ['balances'] });
        queryClient.invalidateQueries({ queryKey: ['markets'] }); // Pool values change
        toast.success('Deposit completed!', { id: `deposit-${event.data.key.slice(0, 10)}` });
        break;

      case 'DEPOSIT_FAILED':
        queryClient.invalidateQueries({ queryKey: ['balances'] });
        toast.error(`Deposit failed: ${event.data.message || 'Unknown error'}`,
          { id: `deposit-${event.data.key.slice(0, 10)}` });
        break;

      case 'WITHDRAWAL_EXECUTED':
        queryClient.invalidateQueries({ queryKey: ['balances'] });
        queryClient.invalidateQueries({ queryKey: ['markets'] });
        toast.success('Withdrawal completed!', { id: `withdraw-${event.data.key.slice(0, 10)}` });
        break;

      case 'WITHDRAWAL_FAILED':
        queryClient.invalidateQueries({ queryKey: ['balances'] });
        toast.error(`Withdrawal failed: ${event.data.message || 'Unknown error'}`,
          { id: `withdraw-${event.data.key.slice(0, 10)}` });
        break;
    }
  }, [queryClient]);

  useEffect(() => {
    if (!walletAddress) {
      // Disconnect if no wallet
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Create socket connection
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      console.log('🔌 WebSocket connected, subscribing to wallet:', walletAddress);
      reconnectAttempts.current = 0;
      
      // Subscribe to wallet events
      socket.emit('subscribe', { wallet: walletAddress });
    });

    socket.on('subscribed', (data: { wallet: string; room: string }) => {
      console.log('✅ Subscribed to:', data.room);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.warn('WebSocket connection error:', error.message);
      reconnectAttempts.current++;
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    // Listen for execution events
    socket.on('execution', handleExecutionEvent);

    // Cleanup on unmount or wallet change
    return () => {
      if (socket.connected) {
        socket.emit('unsubscribe', { wallet: walletAddress });
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [walletAddress, handleExecutionEvent]);

  // Return connection status for UI (optional)
  return {
    isConnected: socketRef.current?.connected ?? false,
  };
}
