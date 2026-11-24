/** One-click unsubscribe (RFC 8058) for email clients' built-in "Unsubscribe" button. */
import { unsubscribeToken } from "../../../actions";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  await unsubscribeToken((await params).token);
  return new Response("Unsubscribed", { status: 200 });
}
