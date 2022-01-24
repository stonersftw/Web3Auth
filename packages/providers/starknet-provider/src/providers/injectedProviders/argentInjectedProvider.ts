import { createSwappableProxy, providerFromEngine } from "@toruslabs/base-controllers";
import { JRPCEngine, JRPCRequest } from "@toruslabs/openlogin-jrpc";
import { RequestArguments, SafeEventEmitterProvider, WalletInitializationError } from "@web3auth/base";
import { BaseProvider, BaseProviderConfig, BaseProviderState } from "@web3auth/base-provider";
import { ethErrors } from "eth-rpc-errors";
import log from "loglevel";
import { AddTransactionResponse, Provider, Signature, SignerInterface, Transaction, typedData } from "starknet";

import { createSolanaMiddleware, IProviderHandlers } from "../../rpc/starknetRpcMiddlewares";
export type EventHandler = (accounts: string[]) => void;

interface IStarketWindowObject {
  enable: () => Promise<string[]>;
  on: (event: "accountsChanged", handleEvent: EventHandler) => void;
  off: (event: "accountsChanged", handleEvent: EventHandler) => void;
  signer?: SignerInterface;
  provider: Provider;
  selectedAddress?: string;
  version: string;
}

// TODO: Add support for changing chainId
export class ArgentInjectedProvider extends BaseProvider<BaseProviderConfig, BaseProviderState, IStarketWindowObject> {
  public _providerProxy!: SafeEventEmitterProvider;

  private readonlyProvider: Provider;

  constructor({ config, state }: { config?: BaseProviderConfig; state?: BaseProviderState }) {
    super({ config, state });
    if (!this.config.chainConfig.chainId) throw WalletInitializationError.invalidProviderConfigError("Please provide chainId in chain config");
  }

  public getReadonlyProvider(): Provider {
    if (!this.readonlyProvider) throw ethErrors.provider.custom({ message: "provider is not initialized", code: -32003 });
    return this.readonlyProvider;
  }

  public async setupProvider(injectedProvider: IStarketWindowObject): Promise<SafeEventEmitterProvider> {
    const providerHandlers: IProviderHandlers = {
      requestAccounts: async () => {
        return [injectedProvider.signer.address];
      },
      getPrivateKey: async () => {
        throw ethErrors.rpc.methodNotSupported();
      },
      invokeFunction: async (req: JRPCRequest<{ message: Transaction }>): Promise<AddTransactionResponse> => {
        if (!req.params?.message) {
          throw ethErrors.rpc.invalidParams("message");
        }
        return injectedProvider.signer.addTransaction(req.params.message);
      },
      signMessage: async (req: JRPCRequest<{ message: typedData.TypedData }>): Promise<Signature> => {
        if (!req.params?.message) {
          throw ethErrors.rpc.invalidParams("message");
        }
        const signedMsg = await injectedProvider.signer.signMessage(req.params.message);
        return signedMsg;
      },
      hashMessage: async (req: JRPCRequest<{ message: typedData.TypedData }>): Promise<string> => {
        if (!req.params?.message) {
          throw ethErrors.rpc.invalidParams("message");
        }
        const hashedMessage = await injectedProvider.signer.hashMessage(req.params.message);
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
    await this.lookupNetwork(injectedProvider);
    return this._providerProxy;
  }

  protected async lookupNetwork(injectedProvider: IStarketWindowObject): Promise<void> {
    try {
      await injectedProvider.signer.getBlock();
      this.readonlyProvider = injectedProvider.provider;
    } catch (error) {
      log.error("error while connecting to starknet sequencer", error);
      throw WalletInitializationError.rpcConnectionError(`Failed to lookup network for following rpc target: ${this.config.chainConfig.rpcTarget}`);
    }
  }
}
