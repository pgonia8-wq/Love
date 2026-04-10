import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  PLATFORM_FEE_PERCENT,
  PREMIUM_MONTHLY_PRICE,
  BOOST_PRICE,
  SUPERLIKE_PRICE,
  SEE_LIKES_PRICE,
} from "@/lib/constants";

type PaymentType = "subscription" | "boost" | "superlike" | "see_likes" | "event_ticket";

const PRICES: Record<Exclude<PaymentType, "event_ticket">, number> = {
  subscription: PREMIUM_MONTHLY_PRICE,
  boost: BOOST_PRICE,
  superlike: SUPERLIKE_PRICE,
  see_likes: SEE_LIKES_PRICE,
};

const PAYMENT_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

export function usePayments(userId: string | undefined) {
  const queryClient = useQueryClient();

  const initiatePayment = useCallback(
    async (paymentType: PaymentType, currency: "WLD" | "USDC", eventId?: string) => {
      if (!userId) throw new Error("Not authenticated");

      const amount =
        paymentType === "event_ticket" ? 0 : PRICES[paymentType];

      const MiniKitModule = await import("@worldcoin/minikit-js");
      const MK = MiniKitModule.MiniKit;

      if (!MK.isInstalled()) {
        throw new Error("Please open this app inside World App");
      }

      const feeAmount = amount * PLATFORM_FEE_PERCENT;
      const recipientAmount = amount - feeAmount;

      const paymentPayload = {
        reference: `hlove_${paymentType}_${Date.now()}`,
        to: PAYMENT_ADDRESS,
        tokens: [
          {
            symbol: currency as any,
            token_amount: String(Math.round(recipientAmount * 1e6) / 1e6),
          },
        ],
        description: `H Love ${paymentType.replace("_", " ")}`,
      };

      const result = await MK.commandsAsync.pay(paymentPayload as any);

      if (!result || !result.finalPayload) {
        throw new Error("Payment cancelled");
      }

      const txId =
        (result.finalPayload as any).transaction_id ||
        paymentPayload.reference;

      const confirmRes = await fetch("/api/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          payment_type: paymentType,
          currency,
          amount,
          tx_id: txId,
          event_id: eventId,
        }),
      });

      const data = await confirmRes.json();

      if (!confirmRes.ok || !data?.success) {
        throw new Error(data?.error || "Payment confirmation failed");
      }

      queryClient.invalidateQueries({ queryKey: ["user", userId] });
      if (paymentType === "subscription") {
        queryClient.invalidateQueries({ queryKey: ["subscription", userId] });
      }

      return data;
    },
    [userId, queryClient]
  );

  const getPrice = useCallback(
    (paymentType: Exclude<PaymentType, "event_ticket">) => PRICES[paymentType],
    []
  );

  return { initiatePayment, getPrice };
}
