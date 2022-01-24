import {
  ADAPTER_CATEGORY,
  ADAPTER_CATEGORY_TYPE,
  ADAPTER_NAMESPACES,
  ADAPTER_STATUS,
  ADAPTER_STATUS_TYPE,
  AdapterInitOptions,
  AdapterNamespaceType,
  BaseAdapter,
  CHAIN_NAMESPACES,
  ChainNamespaceType,
  CONNECTED_EVENT_DATA,
  SafeEventEmitterProvider,
  UserInfo,
  WALLET_ADAPTERS,
  WalletInitializationError,
  WalletLoginError,
} from "@web3auth/base";
import { ArgentInjectedProvider } from "@web3auth/starknet-provider";

import { StarknetWindowObject } from "./interface";
import { detectProvider } from "./utils";

export class ArgentXAdapter extends BaseAdapter<void> {
  readonly adapterNamespace: AdapterNamespaceType = ADAPTER_NAMESPACES.EIP155;

  readonly currentChainNamespace: ChainNamespaceType = CHAIN_NAMESPACES.EIP155;

  readonly type: ADAPTER_CATEGORY_TYPE = ADAPTER_CATEGORY.EXTERNAL;

  readonly name: string = WALLET_ADAPTERS.METAMASK;

  public status: ADAPTER_STATUS_TYPE = ADAPTER_STATUS.NOT_READY;

  public argentProvider: StarknetWindowObject | null = null;

  // added after connecting
  public provider: SafeEventEmitterProvider | null = null;

  private rehydrated = false;

  async init(options: AdapterInitOptions): Promise<void> {
    super.checkInitializationRequirements();
    this.argentProvider = await detectProvider();
    if (!this.argentProvider) throw WalletInitializationError.notInstalled("Argent X extension is not installed");
    this.status = ADAPTER_STATUS.READY;
    this.emit(ADAPTER_STATUS.READY, WALLET_ADAPTERS.METAMASK);
    try {
      if (options.autoConnect) {
        this.rehydrated = true;
        await this.connect();
      }
    } catch (error) {
      this.emit(ADAPTER_STATUS.ERRORED, error);
    }
  }

  setAdapterSettings(_: unknown): void {}

  async connect(): Promise<void> {
    super.checkConnectionRequirements();
    this.status = ADAPTER_STATUS.CONNECTING;
    this.emit(ADAPTER_STATUS.CONNECTING, { adapter: WALLET_ADAPTERS.METAMASK });
    if (!this.argentProvider) throw WalletLoginError.notConnectedError("Not able to connect with metamask");
    try {
      await this.argentProvider.enable();
      this.status = ADAPTER_STATUS.CONNECTED;
      // todo: chain id for starknet
      const providerProxy = new ArgentInjectedProvider({ config: {}, state: {} });
      this.provider = await providerProxy.setupProvider(this.argentProvider);
      this.emit(ADAPTER_STATUS.CONNECTED, {
        adapter: WALLET_ADAPTERS.METAMASK,
        reconnected: this.rehydrated,
      } as CONNECTED_EVENT_DATA);
    } catch (error) {
      // ready again to be connected
      this.status = ADAPTER_STATUS.READY;
      this.rehydrated = false;
      this.emit(ADAPTER_STATUS.ERRORED, error);
      throw WalletLoginError.connectionError("Failed to login with argent x wallet");
    }
  }

  async disconnect(): Promise<void> {
    if (this.status !== ADAPTER_STATUS.CONNECTED) throw WalletLoginError.disconnectionError("Not connected with wallet");
    this.provider?.removeAllListeners();
    this.provider = null;
    // ready to be connected again
    this.status = ADAPTER_STATUS.READY;
    this.rehydrated = false;
    this.emit(ADAPTER_STATUS.DISCONNECTED);
  }

  async getUserInfo(): Promise<Partial<UserInfo>> {
    if (this.status !== ADAPTER_STATUS.CONNECTED) throw WalletLoginError.notConnectedError("Not connected with wallet, Please login/connect first");
    return {};
  }
}
