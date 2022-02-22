import { JRPCRequest, SafeEventEmitter } from "@toruslabs/openlogin-jrpc";
import Connector from "@walletconnect/core";
import * as cryptoLib from "@walletconnect/iso-crypto";
import { ADAPTER_EVENTS, SafeEventEmitterProvider } from "@web3auth/base";
import type { Web3AuthCore } from "@web3auth/core";
import log from "loglevel";
import { render } from "react-dom";

import { WALLET_CONNECT_PLUGIN_STATUS, WalletConnectPluginState } from "./interfaces";

function createWrapper(): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("id", "wcp-container");
  document.body.appendChild(wrapper);
  return wrapper;
}

export default class WalletConnectPlugin {
  private walletConnector: Connector | null;

  private provider: SafeEventEmitterProvider | null;

  private wrapper: HTMLDivElement;

  private stateEmitter: SafeEventEmitter;

  constructor(options: { provider?: SafeEventEmitterProvider; web3Auth?: Web3AuthCore } = {}) {
    const { provider, web3Auth } = options;
    if (!provider && !web3Auth) throw new Error("WalletConnectPlugin requires a provider or web3Auth instance");
    this.walletConnector = undefined;
    if (provider) this.provider = provider;
    else if (web3Auth) {
      if (web3Auth.provider) {
        this.provider = web3Auth.provider;
        this.subcribeToProviderEvents(this.provider);
      } else {
        this.subcribeToWeb3AuthCoreEvents(web3Auth);
      }
    }
    this.wrapper = createWrapper();
    this.stateEmitter = new SafeEventEmitter();
  }

  async connect(): Promise<void> {
    if (!this.provider) throw new Error("WalletConnectPlugin requires a provider instance or web3auth connected instance, before initializing");

    return new Promise((resolve) => {
      this.stateEmitter.once("MOUNTED", () => {
        log.info("rendered");
        this.setState({
          status: WALLET_CONNECT_PLUGIN_STATUS.INITIALIZED,
        });
        return resolve();
      });

      render(<div>helo</div>, this.wrapper);
    });
  }

  async disconnect(): Promise<void> {
    if (this.walletConnector) {
      await this.walletConnector.killSession();
      this.walletConnector = undefined;
    } else {
      throw new Error("WalletConnectPlugin not initialized");
    }
  }

  private async onScanResult(options: { uri: string }): Promise<void> {
    if (!this.provider) throw new Error("WalletConnectPlugin requires a provider instance or web3auth connected instance, before initializing");
    if (this.walletConnector?.uri !== options?.uri && this.walletConnector?.killSession) this.walletConnector.killSession();
    this.walletConnector = new Connector({
      cryptoLib,
      connectorOpts: {},
    });
    log.info(this.walletConnector);
    if (!this.walletConnector.connected) {
      await this.walletConnector.createSession();
    }
    this.setupListeners();
  }

  private subcribeToWeb3AuthCoreEvents(web3Auth: Web3AuthCore) {
    web3Auth.on(ADAPTER_EVENTS.CONNECTED, () => {
      this.provider = web3Auth.provider;
      this.subcribeToProviderEvents(this.provider);
    });
  }

  private subcribeToProviderEvents(provider: SafeEventEmitterProvider) {
    provider.on("accountsChanged", (data: { accounts: string[] }) => {
      this.setSelectedAddress(data.accounts[0]);
    });

    provider.on("chainChanged", (data: { chainId: string }) => {
      this.setChainID(parseInt(data.chainId, 16));
    });
  }

  private async setupListeners(): Promise<void> {
    this.walletConnector.on("session_request", async (err, payload) => {
      log.info("SESSION REQUEST", err, payload);
      const config = await this.sessionConfig();
      this.walletConnector.approveSession(config);
    });
    this.walletConnector.on("session_update", (err: Error, payload) => {
      log.info("SESSION UPDATE", err, payload);
    });
    this.walletConnector.on("call_request", async (err: Error, payload: JRPCRequest<unknown>) => {
      log.info("CALL REQUEST", err, payload);
      if (err) {
        log.info(`CALL REQUEST INTERNAL, ERROR ${err.message}`);
        this.walletConnector.rejectRequest({ id: payload.id as number, error: { message: `Failed or Rejected Request ${err.message}` } });
      }

      try {
        const result = await this.provider.sendAsync(payload);
        this.walletConnector.approveRequest({ id: payload.id as number, result });
      } catch (error: unknown) {
        this.walletConnector.rejectRequest({
          id: payload.id as number,
          error: { message: `Failed or Rejected Request ${(error as Error).message}` },
        });
      }
    });
    this.walletConnector.on("connect", (err, payload) => {
      log.info("SESSION UPDATE", err, payload);
    });
    this.walletConnector.on("disconnect", (err, payload) => {
      log.info("DISCONNECT", err, payload);
      this.walletConnector = undefined;
    });
  }

  private setState = (newState: Partial<WalletConnectPluginState>) => {
    this.stateEmitter.emit("STATE_UPDATED", newState);
  };

  private async sessionConfig(): Promise<{ chainId: number; accounts: string[] }> {
    const [accounts, chainId] = await Promise.all([
      this.provider.request<string[]>({ method: "eth_accounts" }),
      this.provider.request<string>({ method: "eth_chainId" }),
    ]);
    return {
      chainId: parseInt(chainId, 16),
      accounts,
    };
  }

  private async setSelectedAddress(address: string): Promise<void> {
    const sessionConfig = await this.sessionConfig();
    if (address !== sessionConfig.accounts?.[0]) {
      await this.updateSession();
    }
  }

  private async setChainID(chainId: number): Promise<void> {
    const sessionConfig = await this.sessionConfig();
    if (chainId !== sessionConfig.chainId) {
      await this.updateSession();
    }
  }

  private async updateSession() {
    const config = await this.sessionConfig();
    this.walletConnector?.updateSession(config);
  }
}
