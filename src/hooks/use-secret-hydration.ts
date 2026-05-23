import { useEffect } from "react";
import { toast } from "sonner";
import { BrowserModeError, getSecret } from "@/lib/ai/secrets";
import { useAISettingsStore } from "@/stores/ai";

let hydrationToastShown = false;

/** Hydrates keychain-backed secrets into in-memory stores. */
export function useSecretHydration() {
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const [anthropic, openaiAi] = await Promise.all([
          getSecret("ai.anthropic"),
          getSecret("ai.openai"),
        ]);

        if (cancelled) return;

        useAISettingsStore.getState().setProviderConfigured("anthropic", !!anthropic?.trim());
        useAISettingsStore.getState().setProviderConfigured("openai", !!openaiAi?.trim());
      } catch (error) {
        if (error instanceof BrowserModeError) return;
        console.warn("[secrets] Failed to hydrate secrets:", error);
        if (!hydrationToastShown) {
          hydrationToastShown = true;
          toast.warning(
            "Couldn't access the OS keychain. AI features will be off until this is resolved — open Settings → AI for details."
          );
        }
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);
}
