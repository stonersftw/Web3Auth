export const WALLET_CONNECT_PLUGIN_STATUS = {
  INITIALIZED: "initialized",
  CONNECTED: "connected",
  CONNECTING: "connecting",
  ERRORED: "errored",
};
export type WalletConnectPluginStatusType = typeof WALLET_CONNECT_PLUGIN_STATUS[keyof typeof WALLET_CONNECT_PLUGIN_STATUS];

export interface WalletConnectPluginState {
  status: WalletConnectPluginStatusType;
  showScanner: boolean;
}
