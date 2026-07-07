import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnectWallet } from "@workspace/api-client-react";

interface WalletRegistrationContextState {
  walletAddress: string | null;
  isRegistering: boolean;
  registrationError: string | null;
}

const WalletRegistrationContext = createContext<
  WalletRegistrationContextState | undefined
>(undefined);

export function WalletRegistrationProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected, disconnecting } = useWallet();
  const connectWalletMutation = useConnectWallet();
  const [walletAddress, setWalletAddress] = useState<string | null>(() => {
    return localStorage.getItem("proofgoal_wallet") || null;
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const lastRegisteredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!connected || !publicKey) {
      if (disconnecting || !connected) {
        setWalletAddress(null);
        localStorage.removeItem("proofgoal_wallet");
        lastRegisteredRef.current = null;
        setRegistrationError(null);
      }
      return;
    }

    const address = publicKey.toBase58();
    if (lastRegisteredRef.current === address) return;

    setIsRegistering(true);
    setRegistrationError(null);

    connectWalletMutation
      .mutateAsync({ data: { walletAddress: address } })
      .then((user) => {
        setWalletAddress(user.walletAddress);
        localStorage.setItem("proofgoal_wallet", user.walletAddress);
        lastRegisteredRef.current = address;
      })
      .catch(() => {
        setRegistrationError("Failed to register with backend");
        setWalletAddress(address);
        localStorage.setItem("proofgoal_wallet", address);
        lastRegisteredRef.current = address;
      })
      .finally(() => setIsRegistering(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey, disconnecting]);

  return (
    <WalletRegistrationContext.Provider
      value={{ walletAddress, isRegistering, registrationError }}
    >
      {children}
    </WalletRegistrationContext.Provider>
  );
}

function useWalletRegistration() {
  const ctx = useContext(WalletRegistrationContext);
  if (!ctx)
    throw new Error(
      "useWalletRegistration must be used within WalletRegistrationProvider",
    );
  return ctx;
}

export function useAppWallet() {
  const { walletAddress, isRegistering, registrationError } = useWalletRegistration();
  const solana = useWallet();
  return {
    walletAddress,
    isRegistering,
    registrationError,
    connected: solana.connected,
    connecting: solana.connecting,
    disconnect: solana.disconnect,
    publicKey: solana.publicKey,
    wallet: solana.wallet,
    select: solana.select,
    connect: solana.connect,
  };
}
