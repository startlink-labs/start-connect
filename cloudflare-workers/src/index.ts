/**
 * HubSpot OAuth Proxy for Desktop App
 * Cloudflare Workers implementation
 */

interface Env {
  HUBSPOT_CLIENT_ID: string;
  HUBSPOT_CLIENT_SECRET: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/oauth/callback" && request.method === "GET") {
      return handleOAuthCallback(request, env, corsHeaders);
    }

    if (url.pathname === "/oauth/refresh" && request.method === "POST") {
      return handleTokenRefresh(request, env, corsHeaders);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};

async function handleOAuthCallback(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response(
      JSON.stringify({ error: "Missing authorization code" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const tokenResponse = await fetch(
      "https://api.hubapi.com/oauth/v1/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: env.HUBSPOT_CLIENT_ID,
          client_secret: env.HUBSPOT_CLIENT_SECRET,
          redirect_uri: `${url.origin}/oauth/callback`,
          code: code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Token exchange failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokenData = (await tokenResponse.json()) as TokenResponse;

    const deepLinkUrl = new URL("sfhsfiletrans://oauth/callback");
    deepLinkUrl.searchParams.set("access_token", tokenData.access_token);
    deepLinkUrl.searchParams.set("refresh_token", tokenData.refresh_token);
    deepLinkUrl.searchParams.set("expires_in", tokenData.expires_in.toString());
    if (state) {
      deepLinkUrl.searchParams.set("state", state);
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>認証成功</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 400px;
    }
    h1 { color: #333; margin-bottom: 1rem; }
    p { color: #666; margin-bottom: 1.5rem; }
    .success { color: #10b981; font-size: 3rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">✓</div>
    <h1>認証成功</h1>
    <p>アプリケーションに戻っています...</p>
    <p><small>自動的に戻らない場合は、このウィンドウを閉じてください。</small></p>
  </div>
  <script>
    window.location.href = "${deepLinkUrl.toString()}";
    setTimeout(() => { window.close(); }, 3000);
  </script>
</body>
</html>
    `;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleTokenRefresh(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body = (await request.json()) as { refresh_token: string };
    const { refresh_token } = body;

    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: "Missing refresh_token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokenResponse = await fetch(
      "https://api.hubapi.com/oauth/v1/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: env.HUBSPOT_CLIENT_ID,
          client_secret: env.HUBSPOT_CLIENT_SECRET,
          refresh_token: refresh_token,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token refresh failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Token refresh failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokenData = (await tokenResponse.json()) as TokenResponse;

    return new Response(JSON.stringify(tokenData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
