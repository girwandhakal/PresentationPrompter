import { json } from "@/lib/ai/server/http";
import { providerStatus } from "@/lib/ai/server/provider";

export const dynamic = "force-dynamic";

export function GET() {
  return json(providerStatus());
}
