type StaffInviteEmailProps = {
  fullName: string;
  workspaceName: string;
  workspaceLogo: string | null;
  brandColor: string;
  inviteUrl: string;
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  PHOTOGRAPHER: "Photographer",
  EDITOR: "Editor",
  MANAGER: "Manager",
  ADMIN: "Admin",
  VA: "Virtual Assistant",
  VIEWER: "Viewer",
};

export function staffInviteEmail({
  fullName,
  workspaceName,
  workspaceLogo,
  brandColor,
  inviteUrl,
  role,
}: StaffInviteEmailProps): { html: string; subject: string } {
  const firstName = fullName.split(" ")[0];
  const roleLabel = ROLE_LABELS[role] ?? role;
  const subject = `You're invited to join ${workspaceName}`;

  const logoBlock = workspaceLogo
    ? `<img src="${workspaceLogo}" alt="${workspaceName}" style="height:40px;object-fit:contain;display:block;" />`
    : `<div style="width:44px;height:44px;background:${brandColor};border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
         <span style="color:white;font-size:22px;font-weight:700;">📷</span>
       </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header band -->
          <tr>
            <td style="background:${brandColor};padding:28px 36px;">
              ${logoBlock}
              <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:12px 0 0;letter-spacing:0.02em;">${workspaceName}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <h1 style="color:#0f172a;font-size:22px;font-weight:700;margin:0 0 12px;line-height:1.3;">
                Hi ${firstName}, you're invited! 👋
              </h1>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
                <strong style="color:#0f172a;">${workspaceName}</strong> has invited you to join their team as a <strong style="color:#0f172a;">${roleLabel}</strong>.
              </p>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 28px;">
                Click the button below to set up your password and access your account. You'll be able to view your assigned jobs and upload photos directly from your phone.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:${brandColor};border-radius:10px;">
                    <a href="${inviteUrl}"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.01em;">
                      Accept Invite &amp; Set Password →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What to expect -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;overflow:hidden;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="color:#0f172a;font-size:13px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.06em;">What you'll have access to</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="color:${brandColor};font-size:14px;margin-right:8px;">✓</span>
                          <span style="color:#475569;font-size:14px;">View your assigned jobs &amp; schedule</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="color:${brandColor};font-size:14px;margin-right:8px;">✓</span>
                          <span style="color:#475569;font-size:14px;">Clock in/out from the field</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="color:${brandColor};font-size:14px;margin-right:8px;">✓</span>
                          <span style="color:#475569;font-size:14px;">Upload photos directly from your phone</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="color:${brandColor};font-size:14px;margin-right:8px;">✓</span>
                          <span style="color:#475569;font-size:14px;">Add field notes &amp; mark jobs complete</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color:#94a3b8;font-size:13px;margin:0 0 6px;">
                This invite link expires in <strong>7 days</strong>. If you have any trouble, contact your manager at ${workspaceName}.
              </p>
              <p style="color:#cbd5e1;font-size:12px;margin:0;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
                Powered by <strong style="color:#64748b;">Scalist</strong> — The platform for real estate photography studios
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, subject };
}
