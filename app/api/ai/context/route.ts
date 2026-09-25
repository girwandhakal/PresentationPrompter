import { handleAi } from "@/lib/ai/server/http";
import { ContextRequest } from "@/lib/ai/schemas";

export const dynamic = "force-dynamic";

const trim = (value: string, max: number) => value.replace(/\s+/g, " ").trim().slice(0, max);

export function POST(request: Request) {
  return handleAi(request, ContextRequest, async (provider, input, signal) => {
    const context = await provider.context(input, signal);
    return {
      context: {
        title: trim(context.title, 160),
        topic: trim(context.topic, 160),
        summary: trim(context.summary, 800),
        suggestedGoal: trim(context.suggestedGoal, 300),
        suggestedAudience: trim(context.suggestedAudience, 200),
        suggestedKeyMessage: trim(context.suggestedKeyMessage, 300),
      },
    };
  });
}
