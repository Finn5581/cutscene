/** Unsubscribe page linked from emails. GET shows a button; POST unsubscribes. */
import { redirect } from "next/navigation";
import { unsubscribeToken } from "../../actions";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;

  async function unsubscribe() {
    "use server";
    await unsubscribeToken(token);
    redirect(`/u/${token}?done=1`);
  }

  if (done)
    return (
      <>
        <h1>You&apos;re unsubscribed</h1>
        <p className="lead">You won&apos;t get any more texts or emails from us. Sign up again any time.</p>
      </>
    );
  return (
    <>
      <h1>Stop all alerts?</h1>
      <p className="lead">You&apos;ll stop getting texts and emails about open appointments.</p>
      <form action={unsubscribe}>
        <button type="submit">Unsubscribe</button>
      </form>
    </>
  );
}
