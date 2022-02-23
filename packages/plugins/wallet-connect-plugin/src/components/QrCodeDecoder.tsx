import { SafeEventEmitter } from "@toruslabs/openlogin-jrpc";
import log from "loglevel";
import { useEffect, useState } from "react";
import { QrReader } from "react-qr-reader";

import { WalletConnectPluginState } from "../interfaces";

interface QrCodeDecoderProps {
  onScanResult: (options: { uri: string }) => void;
  stateListener: SafeEventEmitter;
}

export default function QrCodeScanner(props: QrCodeDecoderProps) {
  const { onScanResult, stateListener } = props;

  const [pluginState, setPluginState] = useState<WalletConnectPluginState>({
    status: "",
    showScanner: true,
  });

  useEffect(() => {
    stateListener.emit("MOUNTED");
    stateListener.on("STATE_UPDATED", (newModalState: Partial<WalletConnectPluginState>) => {
      log.debug("state updated", newModalState);

      setPluginState((prevState) => {
        const mergedState = { ...prevState, ...newModalState };
        return mergedState;
      });
    });
  }, [stateListener]);

  return (
    pluginState.showScanner && (
      <QrReader
        constraints={{ facingMode: "user" }}
        onResult={(result, error) => {
          if (result) {
            onScanResult({ uri: result.getText() });
          }

          if (error) {
            log.error("error while scanning qr code", error);
          }
        }}
      />
    )
  );
}
