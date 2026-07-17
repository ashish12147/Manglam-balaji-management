import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface ConnectivityValue {
  isOnline: boolean;
  isResolved: boolean;
}

const ConnectivityContext = createContext<ConnectivityValue>({ isOnline: true, isResolved: false });

export function ConnectivityProvider({ children }: PropsWithChildren) {
  const [value, setValue] = useState<ConnectivityValue>({ isOnline: true, isResolved: false });

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setValue({
          isOnline: Boolean(state.isConnected && state.isInternetReachable !== false),
          isResolved: true,
        });
      }),
    [],
  );

  const contextValue = useMemo(() => value, [value]);
  return (
    <ConnectivityContext.Provider value={contextValue}>{children}</ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityValue {
  return useContext(ConnectivityContext);
}
