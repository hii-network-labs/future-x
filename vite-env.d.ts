/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID: string
  readonly VITE_CHAIN_NAME: string
  readonly VITE_RPC_URL: string
  readonly VITE_KEEPER_API_URL: string
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string
  readonly VITE_MARKET_ADDRESS: string
  readonly VITE_WNT_ADDRESS: string
  readonly VITE_USDC_ADDRESS: string
  readonly VITE_EXCHANGE_ROUTER: string
  readonly VITE_ORDER_VAULT: string
  readonly VITE_READER_ADDRESS: string
  readonly VITE_DATASTORE_ADDRESS: string
  readonly VITE_DEPOSIT_VAULT: string
  readonly VITE_WITHDRAWAL_VAULT: string
  readonly VITE_MIN_EXECUTION_FEE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
