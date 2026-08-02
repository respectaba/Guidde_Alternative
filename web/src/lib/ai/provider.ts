/**
 * Server-side AI provider for step captions. The abstraction means callers just
 * ask for a caption; the factory decides how to produce it based on env config:
 *
 *   AI_PROVIDER=browser (default) -> heuristic caption from element metadata
 *   AI_PROVIDER=claude            -> richer caption via the Anthropic API
 *
 * The Claude path is lazy so the app runs with zero AI dependencies configured,
 * and any failure falls back to the heuristic — captions never hard-fail.
 */
import type { ElementMeta } from "@guide/shared";
import { generateCaption } from "@guide/shared";

export interface CaptionRequest {
  element: ElementMeta;
  order?: number;
  /** Captions of prior steps, for context in the Claude path. */
  previousCaptions?: string[];
}

export async function generateServerCaption(req: CaptionRequest): Promise<string> {
  const provider = process.env.AI_PROVIDER ?? "browser";

  if (provider === "claude" && process.env.ANTHROPIC_API_KEY) {
    try {
      return await claudeCaption(req);
    } catch (err) {
      console.error("Claude caption failed, using heuristic:", err);
    }
  }
  return generateCaption(req.element, req.order);
}

async function claudeCaption(req: CaptionRequest): Promise<string> {
  // Lazy import so the SDK is only loaded when actually used.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
  const { element, previousCaptions } = req;

  const context = previousCaptions?.length
    ? `Previous steps:\n${previousCaptions.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\n`
    : "";

  const response = await client.messages.create({
    model,
    max_tokens: 100,
    system:
      "You write concise, imperative captions for steps in a how-to guide, one short sentence each. " +
      "Describe the action the user takes on the element. No preamble, no quotes around the whole sentence, no trailing period unless natural.",
    messages: [
      {
        role: "user",
        content:
          `${context}Write a one-sentence caption for this step. The user interacted with:\n` +
          `- tag: ${element.tagName}\n` +
          `- role: ${element.role ?? "unknown"}\n` +
          `- label/text: ${element.text ?? "(none)"}\n`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text");
  const caption = text && text.type === "text" ? text.text.trim() : "";
  return caption || generateCaption(element, req.order);
}
