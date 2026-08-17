# Monitoring & CI Debugging

Moved out of `infra/terraform/CLAUDE.md` to keep the per-turn instruction load small. Read when actively debugging CI runner performance or infra metrics.

## Debugging Gitea Actions Runner Performance

**Grafana Dashboards:**
- **Ops Metrics** (uid: `ops-metrics`) - Infrastructure monitoring for CI/CD debugging
- **Product Metrics** (uid: `product-metrics`) - Application traffic and health

Access via: https://grafana.abaci.one (or use port-forward to localhost)

**Key panels for Gitea runner debugging (Ops Metrics dashboard):**

| Panel | Metric | What to Look For |
|-------|--------|------------------|
| Runner Memory Usage | `container_memory_working_set_bytes{namespace="gitea-runner"}` | Memory spikes during builds |
| Runner CPU Usage | `rate(container_cpu_usage_seconds_total{namespace="gitea-runner"}[5m])` | CPU saturation |
| Runner Network I/O | `rate(container_network_receive_bytes_total{namespace="gitea-runner"}[5m])` | Network bottlenecks |
| Node Memory % | `1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)` | System-wide memory pressure |
| Node CPU Usage | `1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))` | Total CPU with I/O wait |
| Disk Throughput | `rate(node_disk_read_bytes_total[5m])` | Disk read/write rates |
| Disk I/O Utilization | `rate(node_disk_io_time_seconds_total[5m])` | Disk saturation (>90% = bottleneck) |

**Quick Prometheus queries for debugging:**
```promql
# Runner memory during build
container_memory_working_set_bytes{namespace="gitea-runner", container="gitea-runner"}

# Node I/O wait (high = disk bottleneck)
avg(rate(node_cpu_seconds_total{mode="iowait"}[5m])) * 100

# Disk device utilization (>90% is bad)
rate(node_disk_io_time_seconds_total{device=~"sd.*|nvme.*"}[5m]) * 100
```

**If builds are slow, check in order:**
1. Disk I/O Utilization - if >90%, disk is the bottleneck
2. Node Memory % - if >85%, memory pressure causes swapping
3. I/O Wait - high I/O wait with low CPU = disk-bound
4. Runner Memory - spikes may indicate build is memory-heavy
