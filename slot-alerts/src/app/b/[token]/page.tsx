/**
 * "I booked it" link from texts/emails. GET only shows a button. The pause happens
 * on POST, so phone link previews (which fetch the URL) can't trigger it by accident.
 */
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { confirmBooked } from "../../actions";

export const dynamic = "force-dynamic";

export default async function BookedPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { token } = await params;
  const { done } = await searchParams;

  async function confirm() {
    "use server";
    const res = await confirmBooked(token);
    redirect(`/b/${token}?done=${res ? "1" : "0"}`);
  }

  if (done === "1")
    return (
      <>
        <h1>Nice, enjoy your visit 🎉</h1>
        <p className="lead">
          Alerts are paused for {config.bookedPauseDays} days, since the shop allows one appointment per person every
          two weeks. They&apos;ll start again automatically after that.
        </p>
      </>
    );
  if (done === "0") return <h1>That link isn&apos;t valid any more.</h1>;

  return (
    <>
      <h1>Did you book an appointment?</h1>
      <p className="lead">
        Confirm and we&apos;ll pause your alerts for {config.bookedPauseDays} days. The shop allows one appointment per
        person every two weeks, and may cancel duplicates.
      </p>
      <form action={confirm}>
        <button type="submit">Yes, I booked it</button>
      </form>
    </>
  );
}
