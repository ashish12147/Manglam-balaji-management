# Monitoring and Alerts

## Telemetry rules

Emit structured JSON logs with timestamp, level, service, version, environment, correlation ID,
route or job type, outcome, and duration. Never log OTPs, PINs, tokens, cookies, provider
credentials, signed URLs, full phone numbers, attachment contents, or unrestricted request bodies.
Restrict production log access and define retention by data classification.

Collect service metrics with OpenTelemetry-compatible instrumentation and centralize logs. Trace API
requests through database writes, outbox events, worker jobs, and provider delivery using
correlation and event IDs.

## Dashboards

- API request rate, p50/p95/p99 latency, 4xx/5xx rate, readiness, restarts, CPU, memory, and
  event-loop lag
- PostgreSQL connections, saturation, slow queries, lock waits, replication lag, storage, and backup
  age
- Redis connectivity, latency, memory, evictions, rejected connections, and persistence failures
- Outbox pending count, oldest pending age, attempts, dead letters, and processing throughput
- OTP requests, verification failures, lockouts, provider latency, and provider failures without
  phone data
- Push accepted/failed/invalid-token counts and receipt age
- S3 request failures, quarantine age, scan outcomes, bucket growth, and signed URL failures
- ClamAV readiness, signature age, scan latency, timeouts, and detections
- Security signals: denied authorizations, refresh reuse, suspicious rate limits, admin changes, and
  audit failures

## Paging defaults

Tune thresholds from measured traffic; the following are initial guardrails:

| Signal           | Page condition                                                                       |
| ---------------- | ------------------------------------------------------------------------------------ |
| API availability | readiness below 99% for 5 minutes or no healthy instances                            |
| API errors       | 5xx above 2% for 10 minutes with meaningful traffic                                  |
| API latency      | p95 above 2 seconds for 15 minutes                                                   |
| Database         | connection saturation above 85%, replication lag above 60 seconds, or backup overdue |
| Outbox           | oldest pending event above 5 minutes or dead-letter growth                           |
| Upload safety    | ClamAV unavailable for 5 minutes or quarantine age above 15 minutes                  |
| Authentication   | verification failures or refresh reuse exceed anomaly baseline                       |
| Storage          | error rate above 2%, capacity above 80%, or replication unhealthy                    |

Ticket non-urgent capacity trends and individual invalid push tokens. Page only actionable
user-impacting conditions. Every page links to a dashboard, this runbook index, and an owner. Test
paging and restore access quarterly.
