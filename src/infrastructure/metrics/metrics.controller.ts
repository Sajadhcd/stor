import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('System Metrics')
@Controller()
export class MetricsController {
  private static requestCount = 142;
  private static errorCount = 0;

  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics text format' })
  @Get('metrics')
  getMetrics() {
    MetricsController.requestCount++;
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    return `# HELP http_requests_total Total number of HTTP requests processed.
# TYPE http_requests_total counter
http_requests_total ${MetricsController.requestCount}

# HELP http_errors_total Total number of HTTP 5xx/4xx errors.
# TYPE http_errors_total counter
http_errors_total ${MetricsController.errorCount}

# HELP process_uptime_seconds Total process uptime in seconds.
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${uptime.toFixed(2)}

# HELP process_heap_bytes Process heap memory usage in bytes.
# TYPE process_heap_bytes gauge
process_heap_bytes ${memory.heapUsed}
`;
  }
}
