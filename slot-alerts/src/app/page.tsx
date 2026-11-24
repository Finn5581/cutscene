import { config } from "@/lib/config";
import { SignupForm } from "./signup-form";

export default function Home() {
  return (
    <>
      <h1>{config.locationLabel} appointment alerts</h1>
      <p className="lead">
        Appointments sell out in minutes. Sign up and we&apos;ll text you the moment a slot opens at a day and time
        that works for you, with a link that opens the booking page with your details filled in. You book it yourself.
      </p>
      <div className="card">
        <SignupForm />
      </div>
      <p className="muted" style={{ marginTop: 24 }}>
        We only watch public availability and send alerts. We never book, hold or reserve appointments for anyone.
        The shop allows one appointment per person every two weeks, and it must be in your own name with matching photo ID.
        Not affiliated with Chrome Hearts or Waitwhile.
      </p>
    </>
  );
}
