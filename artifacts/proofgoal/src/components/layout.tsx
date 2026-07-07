import { Link, useLocation } from "wouter";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAppWallet } from "@/lib/wallet";
import { shortenAddress } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";

export function Layout({ children }: { children: React.ReactNode }) {
  const { walletAddress, disconnect, connecting, isRegistering } = useAppWallet();
  const { setVisible } = useWalletModal();
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/markets", label: "Markets" },
    { href: "/matches", label: "Matches" },
    { href: "/insurance", label: "Insurance" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/proofs", label: "Proofs" },
    { href: "/governance", label: "Governance" },
  ];

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-bold text-xl tracking-tight text-primary">
              ProofGoal
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors hover:text-primary ${
                    location === item.href ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {walletAddress ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-lg border">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-mono">{shortenAddress(walletAddress)}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setVisible(true)}
                disabled={connecting || isRegistering}
              >
                {connecting || isRegistering ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden border-t flex overflow-x-auto scrollbar-none">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 px-4 py-2 text-xs font-medium transition-colors hover:text-primary ${
                location === item.href ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
