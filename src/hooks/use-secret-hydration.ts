import { useEffect } from "react";
import { getSecret } from "@/lib/ai/secrets";
import { useAISettingsStore } from "@/stores/ai";

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
        console.warn("[secrets] Failed to hydrate secrets:", error);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);
}
