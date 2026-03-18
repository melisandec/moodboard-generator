"use client";

import { useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { base } from "viem/chains";
import { createCreatorClient } from "@zoralabs/protocol-sdk";

interface MintButtonProps {
  boardId: string;
  boardTitle: string;
  existingTxHash?: string | null;
  existingContract?: string | null;
}

type MintState =
  | "idle"
  | "uploading"
  | "preparing"
  | "signing"
  | "confirming"
  | "done"
  | "error";

export default function MintButton({
  boardId,
  boardTitle,
  existingTxHash,
  existingContract,
}: MintButtonProps) {
  const [state, setState] = useState<MintState>(
    existingTxHash ? "done" : "idle",
  );
  const [txHash, setTxHash] = useState<string | null>(existingTxHash ?? null);
  const [contractAddress, setContractAddress] = useState<string | null>(
    existingContract ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const handleMint = async () => {
    try {
      setError(null);

      // 1. Upload NFT metadata to IPFS via our backend
      setState("uploading");
      const metaRes = await fetch(`/api/boards/${boardId}/mint-metadata`, {
        method: "POST",
      });
      if (!metaRes.ok) {
        const body = await metaRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to prepare metadata");
      }
      const { metadataUri } = await metaRes.json();

      // 2. Connect to the Farcaster MiniApp wallet
      setState("preparing");
      const provider = sdk.wallet.ethProvider;
      const publicClient = createPublicClient({
        chain: base,
        transport: http("https://mainnet.base.org"),
      });
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      const accounts = await walletClient.getAddresses();
      if (!accounts.length) throw new Error("No wallet connected");
      const address = accounts[0];

      // 3. Prepare Zora 1155 creation via the protocol SDK
      //    createCreatorClient handles contract deployment + token setup in one tx.
      //    Cast publicClient to bypass viem peer-dep version mismatch (2.47 vs 2.22).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const creatorClient = createCreatorClient({ chainId: base.id, publicClient: publicClient as any });
      const { parameters } = await creatorClient.create1155({
        contract: {
          name: boardTitle,
          uri: metadataUri,
        },
        token: {
          tokenMetadataURI: metadataUri,
        },
        account: address,
      });

      // 4. Simulate first (recommended by viem), then send through Farcaster wallet
      setState("signing");
      const { request } = await publicClient.simulateContract({
        ...(parameters as Parameters<typeof publicClient.simulateContract>[0]),
        account: address,
      });
      const hash = await walletClient.writeContract(request);
      setTxHash(hash);

      // 5. Wait for on-chain confirmation
      setState("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const deployedContract =
        receipt.contractAddress ??
        (receipt.logs?.[0]?.address as `0x${string}` | null) ??
        null;
      setContractAddress(deployedContract);

      // 6. Persist tx hash to DB (non-critical)
      fetch(`/api/boards/${boardId}/mint-metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash, contractAddress: deployedContract }),
      }).catch(() => {});

      setState("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Mint failed";
      setError(msg);
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2">
          <span className="text-green-600 dark:text-green-400 text-sm font-medium">
            ✓ Minted on Base!
          </span>
          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-green-600 dark:text-green-400 underline"
            >
              Basescan ↗
            </a>
          )}
        </div>
        {contractAddress && (
          <a
            href={`https://zora.co/collect/base:${contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-xs text-blue-500 hover:text-blue-600 underline"
          >
            View on Zora ↗
          </a>
        )}
      </div>
    );
  }

  const label: Record<MintState, string> = {
    idle: "⬡ Mint as NFT on Base",
    uploading: "Uploading metadata…",
    preparing: "Connecting wallet…",
    signing: "Sign in Warpcast wallet",
    confirming: "Confirming on Base…",
    done: "Done",
    error: "⬡ Retry Mint",
  };

  const busy = state !== "idle" && state !== "error";

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleMint}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white transition-colors"
      >
        {busy && (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        {label[state]}
      </button>
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
