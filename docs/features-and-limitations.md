# Implemented features and limitations

## Implemented

- Auth, orgs, RBAC, tenant isolation
- Services/routes registry
- Gateway proxy + Redis rate limits + security events
- RabbitMQ workers (events, analytics, AI)
- Incidents + AI analysis + dashboard
- CI workflows, Dockerfiles, Azure guide
- Security regression tests + AI eval harness + load harness

## Explicit limitations

- Demo credentials are for local demos only
- OpenTelemetry currently initializes local tracers/meters; full collector export is a follow-up
- Container workflow builds images but does not push unless configured with registry credentials
- Load results must be measured per environment before being cited on a resume
