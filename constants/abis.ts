// GMX V2 Contract ABIs
// Copied from working implementation in gmx-sdk/frontend

export const MULTICALL_ABI = [
  { 
    inputs: [{ name: 'data', type: 'bytes[]' }], 
    name: 'multicall', 
    outputs: [{ name: 'results', type: 'bytes[]' }], 
    stateMutability: 'payable', 
    type: 'function' 
  },
  { 
    inputs: [
      { name: 'receiver', type: 'address' }, 
      { name: 'amount', type: 'uint256' }
    ], 
    name: 'sendWnt', 
    outputs: [], 
    stateMutability: 'payable', 
    type: 'function' 
  },
  { 
    inputs: [
      { name: 'token', type: 'address' }, 
      { name: 'receiver', type: 'address' }, 
      { name: 'amount', type: 'uint256' }
    ], 
    name: 'sendTokens', 
    outputs: [], 
    stateMutability: 'payable', 
    type: 'function' 
  },
  {
    inputs: [{
      components: [
        {
          components: [
            { name: 'receiver', type: 'address' },
            { name: 'cancellationReceiver', type: 'address' },
            { name: 'callbackContract', type: 'address' },
            { name: 'uiFeeReceiver', type: 'address' },
            { name: 'market', type: 'address' },
            { name: 'initialCollateralToken', type: 'address' },
            { name: 'swapPath', type: 'address[]' }
          ],
          name: 'addresses',
          type: 'tuple'
        },
        {
          components: [
            { name: 'sizeDeltaUsd', type: 'uint256' },
            { name: 'initialCollateralDeltaAmount', type: 'uint256' },
            { name: 'triggerPrice', type: 'uint256' },
            { name: 'acceptablePrice', type: 'uint256' },
            { name: 'executionFee', type: 'uint256' },
            { name: 'callbackGasLimit', type: 'uint256' },
            { name: 'minOutputAmount', type: 'uint256' },
            { name: 'validFromTime', type: 'uint256' }
          ],
          name: 'numbers',
          type: 'tuple'
        },
        { name: 'orderType', type: 'uint8' },
        { name: 'decreasePositionSwapType', type: 'uint8' },
        { name: 'isLong', type: 'bool' },
        { name: 'shouldUnwrapNativeToken', type: 'bool' },
        { name: 'autoCancel', type: 'bool' },
        { name: 'referralCode', type: 'bytes32' },
        { name: 'dataList', type: 'bytes32[]' }
      ],
      name: 'params',
      type: 'tuple'
    }],
    name: 'createOrder',
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [{
      components: [
        {
          components: [
            { name: 'receiver', type: 'address' },
            { name: 'callbackContract', type: 'address' },
            { name: 'uiFeeReceiver', type: 'address' },
            { name: 'market', type: 'address' },
            { name: 'initialLongToken', type: 'address' },
            { name: 'initialShortToken', type: 'address' },
            { name: 'longTokenSwapPath', type: 'address[]' },
            { name: 'shortTokenSwapPath', type: 'address[]' }
          ],
          name: 'addresses',
          type: 'tuple'
        },
        { name: 'minMarketTokens', type: 'uint256' },
        { name: 'shouldUnwrapNativeToken', type: 'bool' },
        { name: 'executionFee', type: 'uint256' },
        { name: 'callbackGasLimit', type: 'uint256' },
        { name: 'dataList', type: 'bytes32[]' }
      ],
      name: 'params',
      type: 'tuple'
    }],
    name: 'createDeposit',
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [{
      components: [
        {
          components: [
            { name: 'receiver', type: 'address' },
            { name: 'callbackContract', type: 'address' },
            { name: 'uiFeeReceiver', type: 'address' },
            { name: 'market', type: 'address' },
            { name: 'longTokenSwapPath', type: 'address[]' },
            { name: 'shortTokenSwapPath', type: 'address[]' }
          ],
          name: 'addresses',
          type: 'tuple'
        },
        { name: 'minLongTokenAmount', type: 'uint256' },
        { name: 'minShortTokenAmount', type: 'uint256' },
        { name: 'shouldUnwrapNativeToken', type: 'bool' },
        { name: 'executionFee', type: 'uint256' },
        { name: 'callbackGasLimit', type: 'uint256' },
        { name: 'dataList', type: 'bytes32[]' }
      ],
      name: 'params',
      type: 'tuple'
    }],
    name: 'createWithdrawal',
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

export const READER_ABI = [
  {
    inputs: [
      { name: 'dataStore', type: 'address' },
      { name: 'account', type: 'address' },
      { name: 'start', type: 'uint256' },
      { name: 'end', type: 'uint256' },
    ],
    name: 'getAccountOrders',
    outputs: [
      {
        components: [
          { name: 'orderKey', type: 'bytes32' },
          {
            components: [
              {
                components: [
                  { name: 'account', type: 'address' },
                  { name: 'receiver', type: 'address' },
                  { name: 'cancellationReceiver', type: 'address' },
                  { name: 'callbackContract', type: 'address' },
                  { name: 'uiFeeReceiver', type: 'address' },
                  { name: 'market', type: 'address' },
                  { name: 'initialCollateralToken', type: 'address' },
                  { name: 'swapPath', type: 'address[]' },
                ],
                name: 'addresses',
                type: 'tuple',
              },
              {
                components: [
                  { name: 'orderType', type: 'uint8' },
                  { name: 'decreasePositionSwapType', type: 'uint8' },
                  { name: 'sizeDeltaUsd', type: 'uint256' },
                  { name: 'initialCollateralDeltaAmount', type: 'uint256' },
                  { name: 'triggerPrice', type: 'uint256' },
                  { name: 'acceptablePrice', type: 'uint256' },
                  { name: 'executionFee', type: 'uint256' },
                  { name: 'callbackGasLimit', type: 'uint256' },
                  { name: 'minOutputAmount', type: 'uint256' },
                  { name: 'updatedAtTime', type: 'uint256' },
                  { name: 'validFromTime', type: 'uint256' },
                  { name: 'srcChainId', type: 'uint256' },
                ],
                name: 'numbers',
                type: 'tuple',
              },
              {
                components: [
                  { name: 'isLong', type: 'bool' },
                  { name: 'shouldUnwrapNativeToken', type: 'bool' },
                  { name: 'isFrozen', type: 'bool' },
                  { name: 'autoCancel', type: 'bool' },
                ],
                name: 'flags',
                type: 'tuple',
              },
              { name: 'dataList', type: 'bytes32[]' },
            ],
            name: 'order',
            type: 'tuple',
          },
        ],
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    name: 'getAccountPositions',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'dataStore', type: 'address' },
      { name: 'account', type: 'address' },
      { name: 'start', type: 'uint256' },
      { name: 'end', type: 'uint256' },
    ],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          {
            name: 'addresses',
            type: 'tuple',
            components: [
              { name: 'account', type: 'address' },
              { name: 'market', type: 'address' },
              { name: 'collateralToken', type: 'address' },
            ],
          },
          {
            name: 'numbers',
            type: 'tuple',
            components: [
              { name: 'sizeInUsd', type: 'uint256' },
              { name: 'sizeInTokens', type: 'uint256' },
              { name: 'collateralAmount', type: 'uint256' },
              { name: 'pendingImpactAmount', type: 'int256' },
              { name: 'borrowingFactor', type: 'uint256' },
              { name: 'fundingFeeAmountPerSize', type: 'uint256' },
              { name: 'longTokenClaimableFundingAmountPerSize', type: 'uint256' },
              { name: 'shortTokenClaimableFundingAmountPerSize', type: 'uint256' },
              { name: 'increasedAtTime', type: 'uint256' },
              { name: 'decreasedAtTime', type: 'uint256' },
            ],
          },
          {
            name: 'flags',
            type: 'tuple',
            components: [{ name: 'isLong', type: 'bool' }],
          },
        ],
      },
    ],
  },
  {
    name: 'getMarket',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'dataStore', type: 'address' },
      { name: 'market', type: 'address' },
    ],
    outputs: [
      {
        components: [
          { name: 'marketToken', type: 'address' },
          { name: 'indexToken', type: 'address' },
          { name: 'longToken', type: 'address' },
          { name: 'shortToken', type: 'address' },
        ],
        type: 'tuple',
      },
    ],
  },
];

export const ERC20_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  }
] as const;

export const VAULT_ABI = [
  { inputs: [{ name: 'token', type: 'address' }], name: 'syncTokenBalance', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;

export const WETH_ABI = [
  {
    name: 'deposit',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    name: 'withdraw',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
] as const;
