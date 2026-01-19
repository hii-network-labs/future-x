import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

// Subgraph endpoint (update with your actual subgraph URL)
const SUBGRAPH_URL = process.env.VITE_SUBGRAPH_URL || 'http://localhost:8000/subgraphs/name/gmx-v2';

export const subgraphClient = new ApolloClient({
  uri: SUBGRAPH_URL,
  cache: new InMemoryCache(),
});

// GraphQL query for position PnL with fee breakdown
export const GET_POSITION_FEE_DETAILS = gql`
  query GetPositionFeeDetails($positionKey: String!) {
    positionFeesInfos(
      where: { orderKey: $positionKey }
      first: 1
      orderBy: transaction_timestamp
      orderDirection: desc
    ) {
      id
      orderKey
      eventName
      positionFeeAmount
      borrowingFeeAmount
      fundingFeeAmount
      feeUsdForPool
      transaction {
        timestamp
        hash
      }
    }
  }
`;

// Query for closed positions (PositionDecrease events)
export const GET_POSITION_DECREASE = gql`
  query GetPositionDecrease($account: String!, $marketAddress: String!) {
    positionDecreases(
      where: { account: $account, marketAddress: $marketAddress }
      first: 10
      orderBy: transaction_timestamp
      orderDirection: desc
    ) {
      id
      positionKey
      orderKey
      sizeDeltaUsd
      collateralDeltaAmount
      basePnlUsd
      priceImpactUsd
      executionPrice
      borrowingFeeAmount
      fundingFeeAmount
      isLong
      transaction {
        timestamp
        hash
      }
    }
  }
`;

// Query for TradeAction (comprehensive view)
export const GET_TRADE_ACTIONS = gql`
  query GetTradeActions($account: String!, $marketAddress: String) {
    tradeActions(
      where: { account: $account, marketAddress: $marketAddress, eventName_in: ["PositionIncrease", "PositionDecrease"] }
      first: 20
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      eventName
      orderKey
      account
      marketAddress
      sizeDeltaUsd
      executionPrice
      priceImpactUsd
      positionFeeAmount
      borrowingFeeAmount
      fundingFeeAmount
      pnlUsd
      basePnlUsd
      isLong
      timestamp
      transaction {
        hash
      }
    }
  }
`;
