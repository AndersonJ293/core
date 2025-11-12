import { z } from "zod";
import { json } from "@remix-run/node";
import { prisma } from "~/db.server";
import { requireTeamMember } from "~/utils/team-permissions.server";
import { checkRateLimit } from "~/utils/rate-limit.server";
import { logger } from "~/services/logger.service";
import { AnalyticsService } from "~/services/analytics.server";

// Schema for query parameters
const AnalyticsQuerySchema = z.object({
  timeframe: z.enum(["7d", "30d", "90d"]).optional().default("30d"),
  include: z.enum(["overview", "members", "spaces", "engagement", "content", "performance", "all"]).optional().default("all"),
});

// GET /api/v1/teams/:teamId/analytics - Get comprehensive team analytics
export const loader = async ({
  params,
  request,
}: {
  params: any;
  request: Request;
}) => {
  const startTime = Date.now();

  try {
    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryResult = AnalyticsQuerySchema.safeParse({
      timeframe: url.searchParams.get("timeframe") || "30d",
      include: url.searchParams.get("include") || "all",
    });

    if (!queryResult.success) {
      return json(
        { error: "Invalid query parameters", details: queryResult.error },
        { status: 400 }
      );
    }

    const { timeframe, include } = queryResult.data;

    // Use middleware to require team member access
    const { user, teamId } = await requireTeamMember(request, params.teamId);

    // Apply rate limiting: 20 analytics requests per minute per team
    await checkRateLimit(request, 20, 60, `analytics:${teamId}`);

    // Build analytics response based on include parameter
    let analytics: any = {};

    if (include === "all" || include === "overview") {
      analytics.overview = await AnalyticsService.getTeamOverview(teamId, timeframe);
    }

    if (include === "all" || include === "members") {
      analytics.memberMetrics = await AnalyticsService.getMemberMetrics(teamId, timeframe);
    }

    if (include === "all" || include === "spaces") {
      analytics.spaceMetrics = await AnalyticsService.getSpaceMetrics(teamId, timeframe);
    }

    if (include === "all" || include === "engagement") {
      analytics.engagement = await AnalyticsService.getEngagementMetrics(teamId, timeframe);
    }

    if (include === "all" || include === "content") {
      analytics.content = await AnalyticsService.getContentMetrics(teamId, timeframe);
    }

    if (include === "all" || include === "performance") {
      // Get all previous metrics for business intelligence
      const overview = analytics.overview || await AnalyticsService.getTeamOverview(teamId, timeframe);
      const memberMetrics = analytics.memberMetrics || await AnalyticsService.getMemberMetrics(teamId, timeframe);
      const spaceMetrics = analytics.spaceMetrics || await AnalyticsService.getSpaceMetrics(teamId, timeframe);
      const engagementMetrics = analytics.engagement || await AnalyticsService.getEngagementMetrics(teamId, timeframe);

      analytics.businessIntelligence = await AnalyticsService.getBusinessIntelligence(
        teamId, timeframe, overview, memberMetrics, spaceMetrics, engagementMetrics
      );
    }

    const responseTime = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    const response = {
      analytics,
      meta: {
        responseTimeMs: responseTime,
        cached: false,
        timestamp,
        version: "1.0.0",
        timeframe,
        include,
        teamId,
        userId: user.id,
      },
    };

    logger.info(
      `Analytics generated for team ${teamId} by user ${user.id} in ${responseTime}ms`,
      { teamId, userId: user.id, responseTime, timeframe }
    );

    return json(response);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Error generating team analytics:", {
      error: error as Error,
      teamId: params.teamId,
      responseTime
    });

    // Handle permission errors
    if (error instanceof Error) {
      if (error.message.includes("Team not found")) {
        return json({ error: "Team not found" }, { status: 404 });
      }
      if (error.message.includes("Access denied") || error.message.includes("Permission denied") || error.message.includes("access denied")) {
        return json({ error: "Access denied: User is not a team member" }, { status: 403 });
      }
      if (error.message.includes("Rate limit")) {
        return json({ error: "Rate limit exceeded" }, { status: 429 });
      }
    }

    return json(
      {
        error: "Failed to generate analytics",
        meta: {
          responseTimeMs: responseTime,
          timestamp: new Date().toISOString(),
        }
      },
      { status: 500 }
    );
  }
};