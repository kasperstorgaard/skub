type Attachment = {
  filename: string;
  content: string;
};

type Email = {
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
};

/** Whether email can be sent here; features that send hide without it. */
export const canSendEmail = Deno.env.has("RESEND_API_KEY");

/** Sends an email through Resend's HTTP API. */
export async function sendEmail(email: Email): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      reply_to: email.replyTo,
      attachments: email.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: btoa(String.fromCodePoint(
          ...new TextEncoder().encode(attachment.content),
        )),
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}
