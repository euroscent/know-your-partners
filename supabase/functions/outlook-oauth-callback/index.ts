import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    console.log('OAuth callback received, code present:', !!code);

    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return new Response(
        `<html><body><h1>OAuth Fehler</h1><p>${errorDescription || error}</p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!code) {
      return new Response(
        '<html><body><h1>Fehler</h1><p>Kein Autorisierungscode erhalten</p></body></html>',
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const clientId = Deno.env.get('AZURE_CLIENT_ID');
    const clientSecret = Deno.env.get('AZURE_CLIENT_SECRET');
    const tenantId = (Deno.env.get('AZURE_TENANT_ID') || 'consumers');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!clientId || !clientSecret || !tenantId) {
      console.error('Missing Azure credentials in callback');
      return new Response(
        '<html><body><h1>Konfigurationsfehler</h1><p>Azure-Anmeldedaten nicht konfiguriert</p></body></html>',
        { status: 500, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const callbackUrl = `${supabaseUrl}/functions/v1/outlook-oauth-callback`;

    // Exchange authorization code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    });

    console.log('Exchanging code for tokens...');
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return new Response(
        `<html><body><h1>Token-Fehler</h1><p>${tokenData.error_description || tokenData.error}</p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    console.log('Token exchange successful');

    // Get user info from Microsoft Graph
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    console.log('User email:', userData.mail || userData.userPrincipalName);

    // Parse state to get original redirect URL
    let redirectUrl = '/admin/email-accounts';
    let customState = null;
    
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        redirectUrl = stateData.originalRedirect || redirectUrl;
        customState = stateData.customState;
      } catch (e) {
        console.error('Failed to parse state:', e);
      }
    }

    // Store the tokens in the database
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { error: upsertError } = await supabase
      .from('email_accounts')
      .upsert({
        email_address: userData.mail || userData.userPrincipalName,
        imap_host: '', // Legacy field, no longer used
        imap_port: 993, // Legacy field, no longer used
        imap_password: '', // Legacy field, no longer used
        provider: 'outlook_oauth',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        status: 'available', // Must be one of: available, assigned, inactive
        notes: JSON.stringify({
          provider: 'outlook_oauth',
          connected_at: new Date().toISOString(),
          user_id: userData.id,
          display_name: userData.displayName
        })
      }, {
        onConflict: 'email_address'
      });

    if (upsertError) {
      console.error('Failed to save email account:', upsertError);
    } else {
      console.log('Email account saved successfully');
    }

    // Return HTML that sends message to parent window and closes popup
    const email = userData.mail || userData.userPrincipalName;
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Outlook verbunden</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f0f0; }
    .container { text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .success { color: #22c55e; font-size: 48px; margin-bottom: 16px; }
    h1 { color: #333; margin: 0 0 8px 0; font-size: 24px; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">✓</div>
    <h1>Erfolgreich verbunden!</h1>
    <p>${email}</p>
    <p style="margin-top: 16px; font-size: 14px; color: #999;">Dieses Fenster schließt sich automatisch...</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'outlook-oauth-success', 
        email: '${email}' 
      }, '*');
      setTimeout(() => window.close(), 1500);
    } else {
      window.location.href = '${redirectUrl}?outlook_connected=true&email=${encodeURIComponent(email)}';
    }
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error: unknown) {
    console.error('Error in outlook-oauth-callback:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      `<html><body><h1>Fehler</h1><p>${message}</p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
});
