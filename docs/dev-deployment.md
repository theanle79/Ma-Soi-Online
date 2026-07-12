# Dev deployment

The `Dev` environment uses the stable frontend alias:

- Frontend: `https://ma-soi-online-proto1-git-dev-andt.vercel.app`
- Gateway: `https://ma-soi-online-dev-gateway.onrender.com`

Render provisions the remaining topology from `render.yaml`:

- Realtime Gateway
- Lobby Service and its PostgreSQL database
- Role Service and its PostgreSQL database

All three Node services use Render's free web-service plan. Lobby and Role Service requests require a shared generated `SERVICE_AUTH_TOKEN`; only their `/health` endpoints remain public. Service-to-service requests use the services' HTTPS URLs because Render's free-tier internal hostname route did not provide reliable connectivity for this deployment. The bearer token keeps those public service APIs protected.

## First deployment

1. In Render, create a Blueprint from this repository and select the `Dev` branch.
2. Confirm the Blueprint creates three web services, two PostgreSQL databases, and the `ma-soi-online-dev-service-auth` environment group.
3. Wait for all services to report healthy.
4. Set Vercel's Preview `VITE_API_URL` to `https://ma-soi-online-dev-gateway.onrender.com`.
5. Redeploy the latest `Dev` Vercel deployment so Vite embeds the new environment value.

## Verification

```powershell
Invoke-WebRequest https://ma-soi-online-dev-gateway.onrender.com/health
```

The response should report `status: ok` and list both `lobby-service` and `role-service` as dependencies. Then open the Vercel Dev alias in two separate browser profiles or origins, create a room in one, and join it from the other.

## Local parity

Docker Compose uses the same service token and bare private-network-style hostnames as Render:

```powershell
docker compose up --build --detach
Set-Location backend
npm run test:integration
```

The integration suite confirms that health checks are public, domain APIs reject unauthenticated access, and the complete room/role/day flow works through the Gateway.
