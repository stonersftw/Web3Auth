import { Wallet } from "@web3auth/base";
import { CustomauthAdapter, CustomauthAdapterOptions } from "@web3auth/customauth-adapter";
import { MetamaskAdapter } from "@web3auth/metamask-wallet-adapter";
import { OpenloginAdapter, OpenloginAdapterOptions } from "@web3auth/openlogin-adapter";
import { PhantomAdapter } from "@web3auth/phantom-wallet-adapter";
import { SolanaWalletAdapter, SolanaWalletOptions } from "@web3auth/solana-wallet-adapter";
import { TorusWalletAdapter } from "@web3auth/torus-wallet-adapter";

import { WALLET_ADAPTERS } from "../constants";
import { TorusWalletOptions } from "../interface";

const getTorusEvmWallet = (params: TorusWalletOptions): Wallet => {
  return {
    name: WALLET_ADAPTERS.TORUS_EVM_WALLET,
    adapter: () => {
      const torusAdapter = new TorusWalletAdapter({ ...params });
      return torusAdapter;
    },
  };
};

const getTorusSolanaWallet = (params: SolanaWalletOptions): Wallet => {
  return {
    name: WALLET_ADAPTERS.TORUS_SOLANA_WALLET,
    adapter: () => {
      const torusAdapter = new SolanaWalletAdapter({ ...params });
      return torusAdapter;
    },
  };
};

const getOpenloginWallet = (params: OpenloginAdapterOptions): Wallet => {
  return {
    name: WALLET_ADAPTERS.OPENLOGIN_WALLET,
    adapter: () => {
      const torusAdapter = new OpenloginAdapter({ ...params });
      return torusAdapter;
    },
  };
};

const getCustomauthWallet = (params: CustomauthAdapterOptions): Wallet => {
  return {
    name: WALLET_ADAPTERS.CUSTOM_AUTH,
    adapter: () => {
      const torusAdapter = new CustomauthAdapter({ ...params });
      return torusAdapter;
    },
  };
};

const getMetamaskWallet = (): Wallet => {
  return {
    name: WALLET_ADAPTERS.METAMASK_WALLET,
    adapter: () => {
      const adapter = new MetamaskAdapter();
      return adapter;
    },
  };
};

const getPhantomWallet = (): Wallet => {
  return {
    name: WALLET_ADAPTERS.PHANTOM_WALLET,
    adapter: () => {
      const adapter = new PhantomAdapter();
      return adapter;
    },
  };
};

export { getCustomauthWallet, getMetamaskWallet, getOpenloginWallet, getPhantomWallet, getTorusEvmWallet, getTorusSolanaWallet };
