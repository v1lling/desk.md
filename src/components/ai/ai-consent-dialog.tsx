import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { useAIConsentStore } from "@/stores/ai-consent";

/**
 * One-time privacy disclosure shown before the first outbound AI call.
 *
 * Mounted once at the app shell. It is driven entirely by `useAIConsentStore`:
 * `ensureAIConsent()` opens it and awaits the user's choice. Cancelling — via the
 * button, Escape, or an outside click — declines and aborts the AI action.
 */
export function AIConsentDialog() {
  const isOpen = useAIConsentStore((s) => s.isOpen);
  const resolve = useAIConsentStore((s) => s.resolve);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resolve(false)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            Before you use AI features
          </DialogTitle>
          <DialogDescription>
            Desk's AI features send content to the provider you chose (Anthropic
            or OpenAI) over their API. Desk runs no AI server of its own.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">What gets sent</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Messages you type to the assistant, plus the conversation history.</li>
              <li>Short previews and summaries of your files for the Smart Index catalog.</li>
              <li>The contents of files the assistant reads to answer you.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">When</p>
            <p className="mt-1">
              Only when you use an AI feature. With{" "}
              <span className="font-medium text-foreground">Auto-summarize on save</span>{" "}
              enabled, short file previews are also sent automatically after you
              edit a file.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Retention</p>
            <p className="mt-1">
              Handled under your provider's API terms. Anthropic and OpenAI state
              that API data is not used to train their models by default.
            </p>
          </div>
          <p>
            Nothing is sent if you have not configured an API key. You can review
            this anytime in Settings → AI.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => resolve(false)}>
            Cancel
          </Button>
          <Button onClick={() => resolve(true)}>I Understand &amp; Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
