# Operations Runbooks

These runbooks are the minimum operating contract for Manglam Balaji Society Management.

| Runbook                                                      | Use                                                |
| ------------------------------------------------------------ | -------------------------------------------------- |
| [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)                 | Provision and reset local integration dependencies |
| [CONFIGURATION_AND_SECRETS.md](CONFIGURATION_AND_SECRETS.md) | Configure environments and rotate secrets          |
| [DEPLOYMENT_AND_ROLLBACK.md](DEPLOYMENT_AND_ROLLBACK.md)     | Release, migrate, verify, and roll back            |
| [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md)               | Protect and recover PostgreSQL and object storage  |
| [MONITORING_AND_ALERTS.md](MONITORING_AND_ALERTS.md)         | Instrumentation, dashboards, and paging policy     |
| [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md)                 | Triage, contain, recover, and learn from incidents |

Every production change must have an owner, an immutable image digest, a reviewed migration plan, a
rollback decision point, and recorded verification evidence. Secrets and resident data must never be
placed in tickets, chat, CI logs, screenshots, or source control.
