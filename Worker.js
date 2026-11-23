export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/.well-known/oauth-authorization-server") {
      return Response.json({
        issuer: url.origin,
        authorization_endpoint: url.origin + "/oauth/authorize",
        token_endpoint: url.origin + "/oauth/token",
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"]
      });
    }

    if (path === "/oauth/authorize") {
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state") || "";
      const dest = new URL(redirectUri);
      dest.searchParams.set("code", "amap-code");
      dest.searchParams.set("state", state);
      return Response.redirect(dest.toString(), 302);
    }

    if (path === "/oauth/token" && request.method === "POST") {
      return Response.json({
        access_token: "amap-token",
        token_type: "Bearer",
        expires_in: 999999
      });
    }

    if (path === "/mcp" && request.method === "POST") {
      const KEY = "adc7aadc9f1daa9ac699c55234f564f8";
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return Response.json({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" }
        }, { status: 400 });
      }
      const id = body.id ?? null;
      const method = body.method ?? "";
      const params = body.params ?? {};

      if (method === "initialize") {
        return Response.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "amap-weather", version: "1.0.0" }
          }
        });
      }

      if (method === "notifications/initialized") {
        return new Response(null, { status: 202 });
      }

      if (method === "tools/list") {
        return Response.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            tools: [{
              name: "amap_weather",
              description: "查询城市天气。extensions填base查当前天气，all查预报。",
              inputSchema: {
                type: "object",
                properties: {
                  city: {
                    type: "string",
                    description: "城市名，如福州、北京"
                  },
                  extensions: {
                    type: "string",
                    enum: ["base", "all"]
                  }
                },
                required: ["city"]
              }
            }]
          }
        });
      }

      if (method === "tools/call" && params.name === "amap_weather") {
        const city = params.arguments ? params.arguments.city : "";
        const ext = params.arguments ? (params.arguments.extensions || "base") : "base";
        const amapUrl = "https://restapi.amap.com/v3/weather/weatherInfo?key=" + KEY + "&city=" + encodeURIComponent(city) + "&extensions=" + ext + "&output=JSON";
        try {
          const res = await fetch(amapUrl);
          const data = await res.json();
          return Response.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
              isError: data.status !== "1"
            }
          });
        } catch (e) {
          return Response.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              content: [{ type: "text", text: "天气查询失败：" + e.message }],
              isError: true
            }
          });
        }
      }

      return Response.json({
        jsonrpc: "2.0",
        id: id,
        error: { code: -32601, message: "Method not found" }
      });
    }

    return new Response("amap weather mcp ok");
  }
};
