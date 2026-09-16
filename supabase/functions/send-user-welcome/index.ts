// Supabase Edge Function: send-user-welcome
// Dispatches a welcome notification email via Resend when an admin adds a user to the profiles allowlist.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  agent: 'Licensed Agent',
  tc: 'Transaction Coordinator (TC)',
  listing_coordinator: 'Listing Coordinator',
  admin: 'System Administrator',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, email, role, appBaseUrl = 'https://hub.msreg.com', googleDomain = 'msreg.com' } =
      await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
    const resendFromEmail =
      Deno.env.get('RESEND_FROM_EMAIL') || 'MSREG Operations <operations@msreg.com>';
    const roleLabel = ROLE_DISPLAY_NAMES[role] || role || 'User';

    const subject = `Welcome to MSREG Marketing Hub — Your Account is Ready`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #131826; border: 1px solid #334155; border-radius: 16px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 28px 24px; background: linear-gradient(180deg, #1e293b 0%, #131826 100%); border-bottom: 1px solid #334155;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #d97706; margin-bottom: 6px;">
                MSREG Marketing Hub
              </div>
              <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #f8fafc; font-family: Georgia, serif;">
                Account Provisioned
              </h1>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                Hello ${name || 'Team Member'}, you have been granted access to the MSREG Transaction Management system.
              </p>
            </td>
          </tr>

          <!-- Role Details -->
          <tr>
            <td style="padding: 24px;">
              <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px;">
                  Assigned Workspace Role
                </div>
                <div style="font-size: 18px; font-weight: 700; color: #f8fafc;">
                  ${roleLabel}
                </div>
                <div style="font-size: 13px; color: #10b981; margin-top: 6px; font-weight: 600;">
                  ● Account Status: Active & Authorized
                </div>
              </div>

              <!-- Google Workspace Instructions -->
              <div style="background-color: rgba(217, 119, 6, 0.1); border: 1px solid rgba(217, 119, 6, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 700; color: #d97706; margin-bottom: 6px;">
                  🔐 Google Workspace Single Sign-On
                </div>
                <p style="margin: 0; font-size: 13px; color: #f8fafc; line-height: 1.5;">
                  No password setup or registration is necessary. Simply click the button below and sign in using your official <strong>@${googleDomain}</strong> Google account.
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 12px;">
                <a href="${appBaseUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #d97706 0%, #c86d3b 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.35);">
                  Sign in with Google Workspace →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center; font-size: 11px; color: #64748b;">
              MSREG Marketing & Transaction Management System • ${email}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const text = `
MSREG MARKETING HUB — ACCOUNT PROVISIONED
Hello ${name || 'Team Member'},

Your account has been provisioned by an administrator on the MSREG Marketing Hub.
Assigned Role: ${roleLabel}

HOW TO SIGN IN:
No password setup is required. Visit ${appBaseUrl} and click "Sign in with Google" using your @${googleDomain} Google Workspace account.

Access URL: ${appBaseUrl}
    `.trim();

    let resendMessageId: string | null = null;

    if (resendApiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: [email],
          subject,
          html,
          text,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(`Resend error (${res.status}): ${JSON.stringify(errorJson)}`);
      }

      const resData = await res.json();
      resendMessageId = resData.id || null;
    } else {
      console.warn(`[Mock Welcome Email] Resend API key not configured. Mock dispatch to ${email}`);
      resendMessageId = `mock-welcome-${Date.now()}`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        resend_message_id: resendMessageId,
        recipient: email,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Error sending user welcome email:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
