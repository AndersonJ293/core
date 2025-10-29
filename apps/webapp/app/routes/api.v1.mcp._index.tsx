import { json } from "@remix-run/node";
import { z } from "zod";
import { createHybridActionApiRoute } from "~/services/routeBuilders/apiBuilder.server";
import { handleMCPRequest } from "~/services/mcp.server";

const QueryParams = z.object({
  source: z.string().optional(),
  integrations: z.string().optional(),
  no_integrations: z.coerce.boolean().optional(),
  spaceId: z.string().optional(),
});

const { action } = createHybridActionApiRoute(
  {
    body: z.any(),
    allowJWT: true,
    authorization: {
      action: "mcp",
    },
    corsStrategy: "all",
  },
  async ({ request, body, authentication }) => {
    const url = new URL(request.url);
    const queryParams = QueryParams.parse({
      source: url.searchParams.get("source") || undefined,
      integrations: url.searchParams.get("integrations") || undefined,
      no_integrations: url.searchParams.get("no_integrations"),
      spaceId: url.searchParams.get("spaceId") || undefined,
    });

    try {
      const result = await handleMCPRequest(
        request,
        {
          status: (code: number) => ({ status: code }),
          send: (data: any) => data,
          setHeader: () => {},
        },
        body,
        authentication,
        queryParams,
      );
      
      return result;
    } catch (error) {
      console.error("MCP request error:", error);
      return json(
        { error: "MCP request failed", details: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  },
);

export { action };