import { prisma } from '~/db.server';

interface DateRange {
  start: Date;
  end: Date;
}

interface TeamOverview {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  totalSpaces: number;
  teamAge: number;
  teamName: string;
  createdAt: Date;
}

interface MemberMetrics {
  ownerCount: number;
  adminCount: number;
  memberCount: number;
  roleDistribution: Record<string, number>;
  totalConversations: number;
  averageConversationsPerMember: number;
  topContributors: Array<{
    userId: string;
    conversationCount: number;
    rank: number;
  }>;
}

interface SpaceMetrics {
  teamSpaces: number;
  privateSpaces: number;
  workspaceSpaces: number;
  totalContextItems: number;
  averageContextPerSpace: number;
  mostActiveSpaces: Array<{
    spaceId: string;
    name: string;
    contextCount: number;
    activityScore: number;
    visibility: string;
    createdAt: Date;
  }>;
}

interface EngagementMetrics {
  highlyActiveMembers: number;
  moderatelyActiveMembers: number;
  inactiveMembers: number;
  engagementRate: number;
  weeklyGrowthRate: number;
}

interface ContentMetrics {
  totalConversations: number;
  totalSearches: number;
  integrationActivities: number;
  searchEffectiveness: {
    totalSearches: number;
    successfulSearches: number;
    successRate: number;
    averageResponseTime: number;
    averageResultCount: number;
  };
  contentVelocity: {
    conversationsPerDay: number;
    searchesPerDay: number;
  };
}

interface BusinessIntelligence {
  healthScore: {
    overall: number;
    engagement: number;
    growth: number;
    activity: number;
  };
  insights: Array<{
    type: string;
    title: string;
    description: string;
    recommendation: string;
  }>;
  teamGrowthRate: number;
  engagementTrend: 'improving' | 'declining' | 'stable';
  featureAdoption: {
    spacesCreated: number;
    membersPerSpace: number;
    utilizationRate: number;
  };
}

export class AnalyticsService {
  /**
   * Calculate date range based on timeframe string
   */
  private static getDateRange(timeframe: string): DateRange {
    const now = new Date();
    const end = new Date(now);
    let start: Date;

    switch (timeframe) {
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  /**
   * Get comprehensive team overview metrics
   */
  static async getTeamOverview(teamId: string, timeframe: string): Promise<TeamOverview> {
    const dateRange = this.getDateRange(timeframe);

    const [team, totalMembers, activeMembers, totalSpaces] = await Promise.all([
      // Get team details
      prisma.team.findUnique({
        where: { id: teamId },
        include: {
          workspace: true,
        },
      }),
      // Get total team members count
      prisma.teamMember.count({
        where: {
          teamId,
          deleted: null
        },
      }),
      // Get active members (active within timeframe)
      prisma.teamMember.count({
        where: {
          teamId,
          deleted: null,
          updatedAt: {
            gte: dateRange.start,
          },
        },
      }),
      // Get total spaces count
      prisma.space.count({
        where: {
          teamId,
          deleted: null
        },
      }),
    ]);

    if (!team) {
      throw new Error('Team not found');
    }

    const teamAge = Math.floor((new Date().getTime() - team.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const inactiveMembers = totalMembers - activeMembers;

    return {
      totalMembers,
      activeMembers,
      inactiveMembers,
      totalSpaces,
      teamAge,
      teamName: team.name,
      createdAt: team.createdAt,
    };
  }

  /**
   * Get member-related metrics
   */
  static async getMemberMetrics(teamId: string, timeframe: string): Promise<MemberMetrics> {
    const dateRange = this.getDateRange(timeframe);

    const [members, roleDistribution, conversationCounts] = await Promise.all([
      // Get all team members
      prisma.teamMember.findMany({
        where: {
          teamId,
          deleted: null
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
            },
          },
        },
      }),
      // Get role distribution
      prisma.teamMember.groupBy({
        by: ['role'],
        where: {
          teamId,
          deleted: null
        },
        _count: true,
      }),
      // Get conversation counts per member
      prisma.conversation.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: dateRange.start,
          },
          user: {
            teamMembers: {
              some: {
                teamId,
                deleted: null
              },
            },
          },
        },
        _count: { id: true },
        orderBy: {
          _count: { id: 'desc' },
        },
        take: 10,
      }),
    ]);

    // Calculate role counts
    const roleCounts = roleDistribution.reduce((acc, curr) => {
      acc[curr.role] = curr._count;
      return acc;
    }, {} as Record<string, number>);

    // Calculate conversation metrics
    const totalConversations = conversationCounts.reduce((sum, curr) => sum + curr._count.id, 0);
    const averageConversationsPerMember = members.length > 0 ? totalConversations / members.length : 0;

    // Create top contributors list
    const topContributors = conversationCounts.map((item, index) => ({
      userId: item.userId,
      conversationCount: item._count.id,
      rank: index + 1,
    }));

    return {
      ownerCount: roleCounts.OWNER || 0,
      adminCount: roleCounts.ADMIN || 0,
      memberCount: roleCounts.MEMBER || 0,
      roleDistribution,
      totalConversations,
      averageConversationsPerMember,
      topContributors,
    };
  }

  /**
   * Get space-related metrics
   */
  static async getSpaceMetrics(teamId: string, timeframe: string): Promise<SpaceMetrics> {
    const dateRange = this.getDateRange(timeframe);

    const [spaces, spaceTypeDistribution] = await Promise.all([
      // Get all spaces with pattern counts
      prisma.space.findMany({
        where: {
          teamId,
          deleted: null
        },
        include: {
          _count: {
            select: {
              spacePatterns: true,
            },
          },
        },
        orderBy: {
          contextCount: 'desc',
        },
        take: 10,
      }),
      // Get space type distribution
      prisma.space.groupBy({
        by: ['visibility'],
        where: {
          teamId,
          deleted: null
        },
        _count: true,
        _sum: {
          contextCount: true,
        },
      }),
    ]);

    // Calculate type counts
    const typeCounts = spaceTypeDistribution.reduce((acc, curr) => {
      acc[curr.visibility] = {
        count: curr._count,
        totalContext: curr._sum.contextCount || 0,
      };
      return acc;
    }, {} as Record<string, { count: number; totalContext: number }>);

    // Calculate context metrics
    const totalContextItems = spaces.reduce((sum, space) => sum + (space.contextCount || 0), 0);
    const averageContextPerSpace = spaces.length > 0 ? totalContextItems / spaces.length : 0;

    // Create most active spaces list
    const mostActiveSpaces = spaces.map((space) => ({
      spaceId: space.id,
      name: space.name,
      contextCount: space.contextCount || 0,
      patternCount: space._count.spacePatterns,
      activityScore: this.calculateActivityScore(space.contextCount || 0, space._count.spacePatterns),
      visibility: space.visibility,
      createdAt: space.createdAt,
    }));

    return {
      teamSpaces: typeCounts.TEAM?.count || 0,
      privateSpaces: typeCounts.PRIVATE?.count || 0,
      workspaceSpaces: typeCounts.WORKSPACE?.count || 0,
      totalContextItems,
      averageContextPerSpace,
      mostActiveSpaces,
    };
  }

  /**
   * Get engagement metrics
   */
  static async getEngagementMetrics(teamId: string, timeframe: string): Promise<EngagementMetrics> {
    const dateRange = this.getDateRange(timeframe);

    const [newMembers, memberActivities] = await Promise.all([
      // Get new members in timeframe
      prisma.teamMember.count({
        where: {
          teamId,
          createdAt: {
            gte: dateRange.start,
          },
          deleted: null,
        },
      }),
      // Get all member activities
      prisma.teamMember.findMany({
        where: {
          teamId,
          deleted: null
        },
        select: {
          id: true,
          userId: true,
          lastActiveAt: true,
          createdAt: true,
        },
      }),
    ]);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Calculate activity levels
    const highlyActiveMembers = memberActivities.filter(m =>
      m.lastActiveAt && m.lastActiveAt >= new Date(now.getTime() - 24 * 60 * 60 * 1000)
    ).length;

    const moderatelyActiveMembers = memberActivities.filter(m =>
      m.lastActiveAt && m.lastActiveAt >= sevenDaysAgo
    ).length;

    const inactiveMembers = memberActivities.length - moderatelyActiveMembers;
    const engagementRate = memberActivities.length > 0 ? (moderatelyActiveMembers / memberActivities.length) * 100 : 0;
    const weeklyGrowthRate = this.calculateGrowthRate(newMembers, memberActivities.length);

    return {
      highlyActiveMembers,
      moderatelyActiveMembers,
      inactiveMembers,
      engagementRate: parseFloat(engagementRate.toFixed(2)),
      weeklyGrowthRate,
    };
  }

  /**
   * Get content and usage metrics
   */
  static async getContentMetrics(teamId: string, timeframe: string): Promise<ContentMetrics> {
    const dateRange = this.getDateRange(timeframe);

    const [conversationTrends, searchMetrics, integrationActivities] = await Promise.all([
      // Get conversation trends
      prisma.conversation.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: dateRange.start,
          },
          user: {
            teamMembers: {
              some: {
                teamId,
                deleted: null
              },
            },
          },
        },
        _count: { id: true },
      }),
      // Get search metrics
      prisma.recallLog.findMany({
        where: {
          createdAt: {
            gte: dateRange.start,
          },
          user: {
            teamMembers: {
              some: {
                teamId,
                deleted: null
              },
            },
          },
        },
        select: {
          id: true,
          accessType: true,
          resultCount: true,
          responseTimeMs: true,
          createdAt: true,
        },
        take: 1000, // Limit for performance
      }),
      // Get integration activities
      prisma.activity.count({
        where: {
          createdAt: {
            gte: dateRange.start,
          },
          workspace: {
            teams: {
              some: {
                id: teamId,
                deleted: null
              },
            },
          },
          deleted: null,
        },
      }),
    ]);

    const totalConversations = conversationTrends.reduce((sum, item) => sum + item._count.id, 0);
    const totalSearches = searchMetrics.length;
    const successfulSearches = searchMetrics.filter(log => log.resultCount > 0).length;
    const successRate = totalSearches > 0 ? (successfulSearches / totalSearches) * 100 : 0;
    const averageResponseTime = totalSearches > 0
      ? searchMetrics.reduce((sum, log) => sum + (log.responseTimeMs || 0), 0) / totalSearches
      : 0;
    const averageResultCount = totalSearches > 0
      ? searchMetrics.reduce((sum, log) => sum + log.resultCount, 0) / totalSearches
      : 0;

    // Calculate content velocity
    const timeframeDays = (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24);
    const conversationsPerDay = parseFloat((totalConversations / timeframeDays).toFixed(2));
    const searchesPerDay = parseFloat((totalSearches / timeframeDays).toFixed(2));

    return {
      totalConversations,
      totalSearches,
      integrationActivities,
      searchEffectiveness: {
        totalSearches,
        successfulSearches,
        successRate: parseFloat(successRate.toFixed(2)),
        averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
        averageResultCount: parseFloat(averageResultCount.toFixed(2)),
      },
      contentVelocity: {
        conversationsPerDay,
        searchesPerDay,
      },
    };
  }

  /**
   * Get business intelligence and insights
   */
  static async getBusinessIntelligence(
    teamId: string,
    timeframe: string,
    overview: TeamOverview,
    memberMetrics: MemberMetrics,
    spaceMetrics: SpaceMetrics,
    engagementMetrics: EngagementMetrics
  ): Promise<BusinessIntelligence> {
    const healthScore = this.calculateHealthScore(overview, memberMetrics, spaceMetrics, engagementMetrics);
    const insights = this.generateInsights(overview, memberMetrics, spaceMetrics, engagementMetrics);
    const engagementTrend = this.determineEngagementTrend(engagementMetrics);
    const membersPerSpace = overview.totalSpaces > 0 ? overview.totalMembers / overview.totalSpaces : 0;
    const utilizationRate = this.calculateUtilizationRate(overview.totalMembers, spaceMetrics);

    return {
      healthScore,
      insights,
      teamGrowthRate: engagementMetrics.weeklyGrowthRate,
      engagementTrend,
      featureAdoption: {
        spacesCreated: overview.totalSpaces,
        membersPerSpace,
        utilizationRate,
      },
    };
  }

  /**
   * Calculate activity score for spaces
   */
  private static calculateActivityScore(contextCount: number, patternCount: number): number {
    // Simple scoring algorithm - can be enhanced
    return Math.round((contextCount * 0.7) + (patternCount * 10 * 0.3));
  }

  /**
   * Calculate growth rate
   */
  private static calculateGrowthRate(newMembers: number, totalMembers: number): number {
    if (totalMembers === 0) return 0;
    return parseFloat(((newMembers / totalMembers) * 100).toFixed(2));
  }

  /**
   * Calculate health score based on various metrics
   */
  private static calculateHealthScore(
    overview: TeamOverview,
    memberMetrics: MemberMetrics,
    spaceMetrics: SpaceMetrics,
    engagementMetrics: EngagementMetrics
  ): { overall: number; engagement: number; growth: number; activity: number } {
    const engagementScore = engagementMetrics.engagementRate;
    const growthScore = Math.min(engagementMetrics.weeklyGrowthRate * 10, 100); // Cap at 100
    const activityScore = spaceMetrics.totalSpaces > 0 ?
      Math.min((spaceMetrics.averageContextPerSpace / 10) * 100, 100) : 0;

    const overall = parseFloat(((engagementScore + growthScore + activityScore) / 3).toFixed(2));

    return {
      overall,
      engagement: parseFloat(engagementScore.toFixed(2)),
      growth: parseFloat(growthScore.toFixed(2)),
      activity: parseFloat(activityScore.toFixed(2)),
    };
  }

  /**
   * Generate insights based on metrics
   */
  private static generateInsights(
    overview: TeamOverview,
    memberMetrics: MemberMetrics,
    spaceMetrics: SpaceMetrics,
    engagementMetrics: EngagementMetrics
  ): Array<{ type: string; title: string; description: string; recommendation: string }> {
    const insights = [];

    // Member engagement insights
    if (engagementMetrics.engagementRate < 50) {
      insights.push({
        type: 'warning',
        title: 'Low Member Engagement',
        description: `Only ${engagementMetrics.engagementRate.toFixed(1)}% of members are actively participating`,
        recommendation: 'Consider sending engagement reminders or creating interactive content',
      });
    }

    // Space utilization insights
    if (overview.totalSpaces === 0) {
      insights.push({
        type: 'info',
        title: 'No Team Spaces Created',
        description: 'Your team hasn\'t created any collaborative spaces yet',
        recommendation: 'Create your first team space to organize content and improve collaboration',
      });
    }

    // Growth insights
    if (engagementMetrics.weeklyGrowthRate > 20) {
      insights.push({
        type: 'success',
        title: 'Rapid Team Growth',
        description: `Your team is growing at ${engagementMetrics.weeklyGrowthRate.toFixed(1)}% per week`,
        recommendation: 'Ensure onboarding processes can handle the growth',
      });
    }

    // Activity insights
    if (engagementMetrics.inactiveMembers > overview.totalMembers * 0.5) {
      insights.push({
        type: 'warning',
        title: 'High Inactivity Rate',
        description: `${engagementMetrics.inactiveMembers} members haven't been active recently`,
        recommendation: 'Reach out to inactive members or consider team restructuring',
      });
    }

    return insights;
  }

  /**
   * Determine engagement trend
   */
  private static determineEngagementTrend(engagementMetrics: EngagementMetrics): 'improving' | 'declining' | 'stable' {
    const { highlyActiveMembers, inactiveMembers } = engagementMetrics;

    if (highlyActiveMembers > inactiveMembers) return 'improving';
    if (inactiveMembers > highlyActiveMembers * 2) return 'declining';
    return 'stable';
  }

  /**
   * Calculate utilization rate
   */
  private static calculateUtilizationRate(totalMembers: number, spaceMetrics: SpaceMetrics): number {
    if (totalMembers === 0 || spaceMetrics.totalSpaces === 0) return 0;
    const maxPossibleUtilization = totalMembers * spaceMetrics.totalSpaces;
    const currentUtilization = spaceMetrics.totalContextItems;
    return parseFloat(((currentUtilization / Math.max(maxPossibleUtilization, 1)) * 100).toFixed(2));
  }
}