import { invoke } from "@tauri-apps/api/core";
import PostalMime from "postal-mime";
import type { EmailAddress, IncomingEmail } from "./types";

function toEmailAddress(
  addr: { address?: string; name?: string } | undefined,
): EmailAddress | undefined {
  if (!addr?.address) return undefined;
  const name = addr.name?.trim();
  return name ? { email: addr.address, name } : { email: addr.address };
}

function toEmailAddressList(
  list: { address?: string; name?: string }[] | undefined,
): EmailAddress[] | undefined {
  if (!list?.length) return undefined;
  const mapped = list.map(toEmailAddress).filter((a): a is EmailAddress => !!a);
  return mapped.length ? mapped : undefined;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function parseEmlToIncomingEmail(
  emlText: string,
): Promise<IncomingEmail> {
  const parsed = await PostalMime.parse(emlText);

  const from = toEmailAddress(parsed.from);
  if (!from) throw new Error("Email has no From address");

  const body =
    parsed.text?.trim() ||
    (parsed.html ? htmlToPlainText(parsed.html) : "") ||
    "";

  const subject = parsed.subject?.trim() || "(no subject)";

  let dateIso: string | undefined;
  if (parsed.date) {
    const d = new Date(parsed.date);
    if (!Number.isNaN(d.getTime())) dateIso = d.toISOString();
  }

  return {
    subject,
    from,
    body,
    to: toEmailAddressList(parsed.to),
    cc: toEmailAddressList(parsed.cc),
    date: dateIso,
    messageId: parsed.messageId ?? undefined,
    source: "other",
  };
}

export async function importEmlFromPath(path: string): Promise<IncomingEmail> {
  const text = await invoke<string>("read_eml_file", { path });
  return parseEmlToIncomingEmail(text);
}
