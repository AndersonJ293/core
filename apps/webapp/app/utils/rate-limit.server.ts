import { json } from "@remix-run/node";
import { prisma } from "~/db.server";

interface RateLimitOptions {
  limit: number;
  window: number; // in seconds
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  limit: 100, // 100 requests
  window: 60, // per minute
};

export async function rateLimit(
  key: string,
  options: RateLimitOptions = DEFAULT_OPTIONS
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - options.window * 1000);

  try {
    // Get current count
    const current = await prisma.rateLimitCounter.findUnique({
      where: { key },
    });

    if (!current || current.windowStart < windowStart) {
      // New window
      await prisma.rateLimitCounter.upsert({
        where: { key },
        update: {
          count: 1,
          windowStart: now,
        },
        create: {
          key,
          count: 1,
          windowStart: now,
        },
      });

      return {
        allowed: true,
        remaining: options.limit - 1,
        resetTime: now.getTime() + options.window * 1000,
      };
    }

    // Increment count
    const newCount = current.count + 1;

    if (newCount > options.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.windowStart.getTime() + options.window * 1000,
      };
    }

    await prisma.rateLimitCounter.update({
      where: { key },
      data: { count: newCount },
    });

    return {
      allowed: true,
      remaining: options.limit - newCount,
      resetTime: current.windowStart.getTime() + options.window * 1000,
    };
  } catch (error) {
    console.error("Rate limit error:", error);
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      remaining: 999,
      resetTime: now.getTime() + options.window * 1000,
    };
  }
}

export async function checkRateLimit(
  request: Request,
  limit: number = 100,
  window: number = 60
) {
  const userId = await getUserIdFromRequest(request);
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Create rate limit key
  const key = `ratelimit:${userId || "anonymous"}:${clientIP}`;

  const result = await rateLimit(key, { limit, window });

  if (!result.allowed) {
    const resetTime = new Date(result.resetTime);
    throw new Response(
      json({
        error: "Rate limit exceeded",
        limit,
        window,
        resetTime: resetTime.toISOString(),
      }),
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
        },
      }
    );
  }

  return {
    allowed: true,
    remaining: result.remaining,
    resetTime: result.resetTime,
    headers: {
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": result.remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
    },
  };
}

export function getClientIP(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }

  const xri = request.headers.get("x-real-ip");
  if (xri) {
    return xri;
  }

  return "unknown";
}

async function getUserIdFromRequest(request: Request): Promise<string | null> {
  try {
    const cookieHeader = request.headers.get("Cookie");
    if (!cookieHeader) return null;

    // Simple session parsing - adjust based on your session storage
    // This is a placeholder - adapt to your actual auth system
    const match = cookieHeader.match(/session=([^;]+)/);
    if (!match) return null;

    // You might want to decode the session here
    // For now, return a simple hash of the cookie
    return match[1];
  } catch {
    return null;
  }
}
