import { createAsyncMiddleware, JRPCMiddleware, JRPCRequest, mergeMiddleware } from "@toruslabs/openlogin-jrpc";
import type { AddTransactionResponse, Signature, Transaction, typedData } from "starknet";

export interface IProviderHandlers {
  requestAccounts: (req: JRPCRequest<unknown>) => Promise<string[]>;
  getPrivateKey: (req: JRPCRequest<unknown>) => Promise<string>;
  invokeFunction: (req: JRPCRequest<{ message: Transaction }>) => Promise<AddTransactionResponse>;
  signMessage: (req: JRPCRequest<{ message: typedData.TypedData }>) => Promise<Signature>;
  hashMessage: (req: JRPCRequest<{ message: typedData.TypedData }>) => Promise<string>;
}

export function createRequestAccountsMiddleware({
  requestAccounts,
}: {
  requestAccounts: IProviderHandlers["requestAccounts"];
}): JRPCMiddleware<unknown, unknown> {
  return createAsyncMiddleware(async (request, response, next) => {
    const { method } = request;
    if (method !== "solana_requestAccounts") return next();

    if (!requestAccounts) throw new Error("WalletMiddleware - opts.requestAccounts not provided");
    // This calls the UI login function
    const accounts = await requestAccounts(request);
    response.result = accounts;
    return undefined;
  });
}

export function createGenericJRPCMiddleware<T, U>(
  targetMethod: string,
  handler: (req: JRPCRequest<T>) => Promise<U>
): JRPCMiddleware<unknown, unknown> {
  return createAsyncMiddleware<T, unknown>(async (request, response, next) => {
    const { method } = request;
    if (method !== targetMethod) return next();

    if (!handler) throw new Error(`WalletMiddleware - ${targetMethod} not provided`);

    const result = await handler(request);

    response.result = result;
    return undefined;
  });
}

export function createSolanaMiddleware(providerHandlers: IProviderHandlers): JRPCMiddleware<unknown, unknown> {
  const { requestAccounts, getPrivateKey, invokeFunction, signMessage, hashMessage } = providerHandlers;

  return mergeMiddleware([
    createRequestAccountsMiddleware({ requestAccounts }),
    createGenericJRPCMiddleware<{ message: Transaction }, AddTransactionResponse>("starknet_invoke_function", invokeFunction),
    createGenericJRPCMiddleware<unknown, string[]>("starknet_request_accounts", requestAccounts),
    createGenericJRPCMiddleware<{ message: typedData.TypedData }, Signature>("starknet_sign_message", signMessage),
    createGenericJRPCMiddleware<{ message: typedData.TypedData }, string>("starknet_hash_message", hashMessage),
    createGenericJRPCMiddleware<void, string>("starknet_private_key", getPrivateKey),
  ]);
}
