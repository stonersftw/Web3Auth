import { BaseConfig, createSwappableProxy, providerFromEngine } from "@toruslabs/base-controllers";
import { JRPCEngine, JRPCRequest } from "@toruslabs/openlogin-jrpc";
import { CustomChainConfig, RequestArguments, SafeEventEmitterProvider, WalletInitializationError } from "@web3auth/base";
import { BaseProvider, BaseProviderState } from "@web3auth/base-provider";
import { ethErrors } from "eth-rpc-errors";
import log from "loglevel";
import { AddTransactionResponse, ec, Provider, Signature, Signer, Transaction, typedData } from "starknet";

import { createSolanaMiddleware, IProviderHandlers } from "../../rpc/starknetRpcMiddlewares";
import { createRandomId } from "../../rpc/utils";

export interface SolanaPrivKeyProviderConfig extends BaseConfig {
  chainConfig: Omit<CustomChainConfig, "chainNamespace">;
}
export class StarknetPrivateKeyProvider extends BaseProvider<SolanaPrivKeyProviderConfig, BaseProviderState, string> {
  public _providerProxy!: SafeEventEmitterProvider;

  constructor({ config, state }: { config: SolanaPrivKeyProviderConfig; state?: BaseProviderState }) {
    super({ config, state });
    if (!config.chainConfig.chainId) throw WalletInitializationError.invalidProviderConfigError("Please provide chainId in chainConfig");
    if (!config.chainConfig.rpcTarget) throw WalletInitializationError.invalidProviderConfigError("Please provide rpcTarget in chainConfig");
  }

  public static getProviderInstance = async (params: {
    privKey: string;
    chainConfig: Omit<CustomChainConfig, "chainNamespace">;
  }): Promise<SafeEventEmitterProvider> => {
    const providerFactory = new StarknetPrivateKeyProvider({ config: { chainConfig: params.chainConfig } });
    return providerFactory.setupProvider(params.privKey);
  };

  public getReadonlyProvider(): Provider {
    if (!this._providerProxy) throw ethErrors.provider.custom({ message: "provider is not initialized", code: -32003 });
    return new Provider({ baseUrl: this.config.chainConfig.rpcTarget });
  }

  public async setupProvider(privKey: string): Promise<SafeEventEmitterProvider> {
    if (typeof privKey !== "string") throw WalletInitializationError.invalidParams("privKey must be a string");

    const providerHandlers: IProviderHandlers = {
      requestAccounts: async () => {
        const signer = await this.getSigner();
        return [signer.address];
      },
      getPrivateKey: async () => privKey,
      invokeFunction: async (req: JRPCRequest<{ message: Transaction }>): Promise<AddTransactionResponse> => {
        if (!req.params?.message) {
          throw ethErrors.rpc.invalidParams("message");
        }
        const signer = await this.getSigner();
        return signer.addTransaction(req.params.message);
      },
      signMessage: async (req: JRPCRequest<{ message: typedData.TypedData }>): Promise<Signature> => {
        if (!req.params?.message) {
          throw ethErrors.rpc.invalidParams("message");
        }
        const signer = await this.getSigner();
        const signedMsg = await signer.signMessage(req.params.message);
        return signedMsg;
      },
      hashMessage: async (req: JRPCRequest<{ message: typedData.TypedData }>): Promise<string> => {
        if (!req.params?.message) {
          throw ethErrors.rpc.invalidParams("message");
        }
        const signer = await this.getSigner();
        const hashedMessage = await signer.hashMessage(req.params.message);
        return hashedMessage;
      },
    };
    const starknetMiddleware = createSolanaMiddleware(providerHandlers);
    const engine = new JRPCEngine();
    engine.push(starknetMiddleware);
    const provider = providerFromEngine(engine);
    const providerWithRequest = {
      ...provider,
      request: async (args: RequestArguments) => {
        return provider.sendAsync(args);
      },
    } as SafeEventEmitterProvider;
    this._providerProxy = createSwappableProxy<SafeEventEmitterProvider>(providerWithRequest);
    await this.lookupNetwork();
    return this._providerProxy;
  }

  protected async lookupNetwork(): Promise<void> {
    try {
      const readOnlyProvider = this.getReadonlyProvider();
      await readOnlyProvider.getBlock();
    } catch (error) {
      log.error("error while connecting to starknet sequencer", error);
      throw WalletInitializationError.rpcConnectionError(`Failed to lookup network for following rpc target: ${this.config.chainConfig.rpcTarget}`);
    }
  }

  private async getSigner(): Promise<Signer> {
    const provider = this.getReadonlyProvider();
    const accounts = await this._providerProxy.sendAsync({ method: "starknet_request_accounts", id: createRandomId(), jsonrpc: "2.0" });
    const privKey = await this._providerProxy.sendAsync<[], string>({ method: "starknet_private_key", id: createRandomId(), jsonrpc: "2.0" });
    const keyPair = ec.getKeyPair(privKey);
    return new Signer(provider, accounts[0], keyPair);
  }
}
