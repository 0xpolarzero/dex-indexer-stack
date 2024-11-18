import { graphql } from "./init";

export const GetWalletTokenBalanceSubscription = graphql(`
  subscription SubWalletTokenBalance($wallet: String!, $token: String!, $start: timestamptz = "now()") {
    balance: wallet_token_balance_ignore_interval(
      args: { wallet: $wallet, interval: "0", start: $start, token: $token }
    ) {
      value: balance
    }
  }
`);

export const GetWalletTokenBalanceIgnoreIntervalSubscription = graphql(`
  subscription SubWalletTokenBalanceIgnoreInterval(
    $wallet: String!
    $start: timestamptz = "now()"
    $interval: interval = "0"
    $token: String!
  ) {
    balance: wallet_token_balance_ignore_interval(
      args: { wallet: $wallet, interval: $interval, start: $start, token: $token }
    ) {
      value: balance
    }
  }
`);

export const GetWalletBalanceSubscription = graphql(`
  subscription SubWalletBalance($wallet: String!, $start: timestamptz = "now()") {
    balance: wallet_balance_ignore_interval(args: { wallet: $wallet, interval: "0", start: $start }) {
      value: balance
    }
  }
`);

export const GetWalletBalanceIgnoreIntervalSubscription = graphql(`
  subscription SubWalletBalanceIgnoreInterval(
    $wallet: String!
    $start: timestamptz = "now()"
    $interval: interval = "0"
  ) {
    balance: wallet_balance_ignore_interval(args: { wallet: $wallet, interval: $interval, start: $start }) {
      value: balance
    }
  }
`);
