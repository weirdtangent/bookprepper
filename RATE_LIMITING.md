# Rate Limiting Implementation

This document describes the rate limiting strategy implemented to protect the BookPrepper API from denial-of-service (DoS) attacks and resource exhaustion.

## Overview

The API uses `@fastify/rate-limit` (v10.3.0) with a tiered approach:

- **Global rate limit**: 100 requests/minute per IP
- **Per-route limits**: Stricter limits for expensive operations

## Implementation Details

### Global Configuration

**File**: [`apps/api/src/server.ts`](apps/api/src/server.ts#L32-L47)

```typescript
await server.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  global: true,
  keyGenerator: (request) => {
    return (
      request.ip ||
      request.headers["x-forwarded-for"]?.toString() ||
      request.headers["x-real-ip"]?.toString() ||
      "unknown"
    );
  },
});
```

Rate limiting is applied per IP address (including support for proxied requests via `X-Forwarded-For` and `X-Real-IP` headers).

### Rate Limit Tiers

**File**: [`apps/api/src/utils/rate-limit-configs.ts`](apps/api/src/utils/rate-limit-configs.ts)

| Configuration             | Limit  | Time Window | Use Case                                                     |
| ------------------------- | ------ | ----------- | ------------------------------------------------------------ |
| `externalApiRateLimit`    | 5 req  | 1 minute    | Routes making external API calls (Google Books, AWS Cognito) |
| `expensiveQueryRateLimit` | 20 req | 1 minute    | Routes with complex database queries                         |
| `writeOperationRateLimit` | 30 req | 1 minute    | POST/PUT/PATCH/DELETE operations                             |
| `adminOperationRateLimit` | 50 req | 1 minute    | Admin-only operations                                        |
| `publicReadRateLimit`     | 60 req | 1 minute    | Public read operations                                       |

### Protected Routes

#### External API Calls (5 req/min)

These routes make calls to external services and are heavily rate-limited:

1. **`POST /api/books/:slug/preps/:prepId/quotes`** ([preps.ts:337-452](apps/api/src/routes/preps.ts#L337-L452))
   - Creates quotes with Google Books API verification
   - Risk: Each request makes 1 external API call

2. **`GET /api/quotes/search`** ([preps.ts:511-581](apps/api/src/routes/preps.ts#L511-L581))
   - Searches Google Books API for quotes
   - Risk: Direct external API dependency

3. **`PATCH /api/profile`** ([profile.ts:21-70](apps/api/src/routes/profile.ts#L21-L70))
   - Updates user profile and syncs with AWS Cognito
   - Risk: AWS API rate limits and costs

#### Expensive Database Queries (20 req/min)

1. **`GET /api/preps/feedback/insights`** ([preps.ts:213-301](apps/api/src/routes/preps.ts#L213-L301))
   - Runs 3 complex queries in parallel via `Promise.all`:
     - Top prompt scores with book relations
     - Lowest prompt scores with book relations
     - Recent feedback with nested relations
   - Risk: High database load

#### Write Operations (30 req/min)

All write operations have stricter limits than reads to prevent abuse:

1. **`POST /api/books/:slug/preps/:prepId/vote`** ([preps.ts:97-177](apps/api/src/routes/preps.ts#L97-L177))
   - Multiple upserts + score synchronization

2. **`POST /api/books/:slug/preps/suggest`** ([preps.ts:179-216](apps/api/src/routes/preps.ts#L179-L216))
   - Creates prep suggestions

3. **`POST /api/books/:slug/preps/:prepId/quotes/:quoteId/vote`** ([preps.ts:455-525](apps/api/src/routes/preps.ts#L455-L525))
   - Upserts quote votes + fetches all votes

4. **`DELETE /api/books/:slug/preps/:prepId/quotes/:quoteId`** ([preps.ts:583-639](apps/api/src/routes/preps.ts#L583-L639))
   - Deletes quotes with permission checks

## Security Benefits

### DoS Attack Prevention

1. **Resource Exhaustion Protection**
   - External API calls are limited to prevent quota exhaustion and cost overruns
   - Database query limits prevent connection pool exhaustion
   - Write operation limits prevent storage abuse

2. **Application Availability**
   - Global limit prevents any single IP from monopolizing server resources
   - Per-route limits ensure expensive operations don't impact overall performance

3. **Cost Control**
   - Google Books API calls are limited to prevent unexpected API costs
   - AWS Cognito calls are rate-limited to prevent AWS charges from abuse

### Attack Scenarios Mitigated

| Attack Type               | Mitigation                                                          |
| ------------------------- | ------------------------------------------------------------------- |
| **Bulk request flooding** | Global 100 req/min limit blocks rapid-fire requests                 |
| **External API abuse**    | 5 req/min limit prevents quota exhaustion and cost overruns         |
| **Database overload**     | 20 req/min on expensive queries prevents connection saturation      |
| **Storage spam**          | 30 req/min on writes prevents database bloat from automated scripts |
| **Credential stuffing**   | Combined with authentication, limits login attempts                 |

## Implementation Notes

### File System Operations

**File**: [`apps/api/src/utils/covers.ts`](apps/api/src/utils/covers.ts)

The synchronous file reads (`readFileSync`, `existsSync`) are acceptable here because:

- They execute **once at module load time** (line 20), not during request handling
- The manifest is loaded into an in-memory `Map` for fast lookups during requests
- No blocking I/O occurs during HTTP request processing

### Future Improvements

1. **Redis-based rate limiting**: For distributed deployments, use Redis as the rate limit store

   ```typescript
   await server.register(rateLimit, {
     redis: redisClient,
     // ...
   });
   ```

2. **User-based limits**: Track limits by authenticated user ID instead of just IP

   ```typescript
   keyGenerator: (request) => {
     return request.user?.id || request.ip;
   };
   ```

3. **Dynamic limits**: Adjust limits based on user tier or subscription level

4. **Monitoring**: Add metrics/alerts when rate limits are frequently hit

## Testing

To test rate limiting locally:

```bash
# Test global limit (should fail after 100 requests in 1 minute)
for i in {1..110}; do curl http://localhost:3000/api/books; done

# Test external API limit (should fail after 5 requests in 1 minute)
for i in {1..10}; do curl http://localhost:3000/api/quotes/search?text=test; done

# Expected response when rate limited:
# HTTP 429 Too Many Requests
# {"statusCode":429,"error":"Too Many Requests","message":"Rate limit exceeded, retry in 1 minute"}
```

## References

- [OWASP: Denial of Service Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [Wikipedia: Denial-of-service attack](https://en.wikipedia.org/wiki/Denial-of-service_attack)
- [@fastify/rate-limit documentation](https://github.com/fastify/fastify-rate-limit)
- [CWE-770: Allocation of Resources Without Limits](https://cwe.mitre.org/data/definitions/770.html)
- [CWE-307: Improper Restriction of Excessive Authentication Attempts](https://cwe.mitre.org/data/definitions/307.html)
- [CWE-400: Uncontrolled Resource Consumption](https://cwe.mitre.org/data/definitions/400.html)
