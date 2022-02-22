import { SafeEventEmitter } from "@toruslabs/openlogin-jrpc";
import log = require("loglevel");
import cloneDeep from "lodash.clonedeep";
import deepmerge from "lodash.merge";
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
    showScanner: false,
  });

  useEffect(() => {
    stateListener.emit("MOUNTED");
    stateListener.on("STATE_UPDATED", (newModalState: Partial<WalletConnectPluginState>) => {
      log.debug("state updated", newModalState);

      setPluginState((prevState) => {
        const mergedState = cloneDeep(deepmerge(prevState, newModalState));
        return mergedState;
      });
    });
  }, [stateListener]);

  return (
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
  );
}
