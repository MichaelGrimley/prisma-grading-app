// Sends the short-lived login token to the user's email.
// In development, when RESEND_API_KEY is not set, the token is logged to the
// console instead of being sent, so you can follow the flow without an email
// provider. In production, set RESEND_API_KEY to send real emails.
export async function sendEmailToken(
  email: string,
  token: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`email token for ${email}: ${token}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "login@your-domain.com",
      to: email,
      subject: "login token for the grading app API",
      text: `Your login token is: ${token}`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to send email: ${res.status} $(await res.text()}`);
  }
}
