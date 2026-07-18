import * as Network from "expo-network";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface ConnectivityState {
  isConnected: boolean;
  isInternetReachable: boolean;
  isOnline: boolean;
  type: Network.NetworkStateType;
}

const initialState: ConnectivityState = {
  isConnected: false,
  isInternetReachable: false,
  isOnline: false,
  type: Network.NetworkStateType.UNKNOWN
};

const ConnectivityContext = createContext<ConnectivityState>(initialState);

function normalize(state: Network.NetworkState): ConnectivityState {
  const isConnected = state.isConnected === true;
  const isInternetReachable = state.isInternetReachable !== false && isConnected;
  return {
    isConnected,
    isInternetReachable,
    isOnline: isConnected && isInternetReachable,
    type: state.type ?? Network.NetworkStateType.UNKNOWN
  };
}

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let active = true;
    void Network.getNetworkStateAsync().then((result) => {
      if (active) setState(normalize(result));
    });
    const subscription = Network.addNetworkStateListener((result) => setState(normalize(result)));
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityState {
  return useContext(ConnectivityContext);
}
