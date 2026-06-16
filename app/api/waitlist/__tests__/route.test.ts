import { expect, test } from "vitest";
import { POST } from "@/app/api/waitlist/route";

const req = (body: unknown) =>
  new Request("http://x/api/waitlist", {
    method: "POST",
    body: JSON.stringify(body),
  });

test("valid email → 200 ok", async () => {
  const res = await POST(req({ email: "finn5581@gmail.com" }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test("invalid email → 400", async () => {
  const res = await POST(req({ email: "nope" }));
  expect(res.status).toBe(400);
});
