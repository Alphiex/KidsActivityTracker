// Rate limit helper to manage retry delays
class RateLimitHelper {
  private static instance: RateLimitHelper;
  private rateLimitedUntil: Map<string, number> = new Map();
  
  static getInstance(): RateLimitHelper {
    if (!RateLimitHelper.instance) {
      RateLimitHelper.instance = new RateLimitHelper();
    }
    return RateLimitHelper.instance;
  }
  
  // Check if we should wait before making a request
  shouldWait(endpoint: string): { wait: boolean; timeRemaining?: number } {
    const now = Date.now();
    const blockedUntil = this.rateLimitedUntil.get(endpoint);
    
    if (blockedUntil && blockedUntil > now) {
      return {
        wait: true,
        timeRemaining: Math.ceil((blockedUntil - now) / 1000)
      };
    }
    
    return { wait: false };
  }
  
  // Set rate limit for an endpoint
  setRateLimit(endpoint: string, retryAfterSeconds?: number) {
    // Default to 60 seconds if no retry-after header
    const waitTime = (retryAfterSeconds || 60) * 1000;
    this.rateLimitedUntil.set(endpoint, Date.now() + waitTime);
    
    console.log(`Rate limited on ${endpoint}, retry after ${retryAfterSeconds || 60} seconds`);
  }
  
  // Clear rate limit for an endpoint
  clearRateLimit(endpoint: string) {
    this.rateLimitedUntil.delete(endpoint);
  }
  
  // Clear all rate limits
  clearAll() {
    this.rateLimitedUntil.clear();
  }
  
  // Get auth-specific endpoint key
  getAuthEndpointKey(url: string): string {
    if (url.includes('/auth/login')) return 'auth_login';
    if (url.includes('/auth/register')) return 'auth_register';
    if (url.includes('/auth/refresh')) return 'auth_refresh';
    if (url.includes('/auth/')) return 'auth_general';
    return 'api_general';
  }
}

export default RateLimitHelper.getInstance();