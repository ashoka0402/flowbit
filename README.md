**Project Title:** Flowbit: Multi-Tenant Workflow Integration

**Description:**
Build a multi-tenant application that integrates with the n8n workflow engine. The application will feature tenant-aware authentication, strict data isolation, dynamic micro-frontend loading in a React shell, and real-time updates via WebSockets. All services should be containerized using Docker Compose.

**Core Requirements:**

1.  **Authentication & RBAC:**
    * Implement email/password login using JWT (`jsonwebtoken` + `bcrypt`).
    * JWT payload must include `customerId` and `role` (Admin/User).
    * Implement middleware to restrict `/admin/*` routes to Admins only.

2.  **Tenant Data Isolation:**
    * Every MongoDB collection must include a `customerId` field.
    * Implement queries to filter data by the logged-in user's `customerId`.
    * Write at least one Jest unit test proving an Admin from Tenant A cannot read Tenant B's data.

3.  **Use-Case Registry:**
    * Hard-code two use cases in a `registry.json` file, mapping `{tenant, screenUrl, componentName}`.
    * Implement a `/api/me/screens` API endpoint that returns the screens list for the logged-in tenant.

4.  **Dynamic Navigation (React Micro-frontends):**
    * Develop a React "shell" application that fetches `/api/me/screens`.
    * The shell should render a dynamic sidebar based on the fetched screens.
    * Implement lazy-loading of a remote `SupportTicketsApp` micro-frontend via Webpack Module Federation based on the `screenUrl` from the registry.

5.  **Workflow Round-Trip (Flowbit <-> n8n):**
    * Include an `n8n` container in `docker-compose.yml`.
    * `POST /api/tickets` should trigger a workflow in `n8n` (via Webhook) with `ticketId` and `customerId`.
    * The `n8n` workflow must call back to `/webhook/ticket-done` on the Flowbit API with a `shared secret header` (e.g., `X-Flowbit-Secret`).
    * Flowbit must verify this secret.
    * Upon successful verification, Flowbit updates the ticket status in MongoDB.
    * Flowbit pushes the change to the React UI in real-time (using WebSockets like Socket.IO), ensuring tenant-aware updates.

6.  **Containerized Development Environment:**
    * `docker-compose up` must start:
        * MongoDB
        * Your Flowbit API (Node.js/Express)
        * React Shell
        * `SupportTicketsApp` (Micro-frontend)
        * n8n
        * `ngrok` (or a local tunneling solution) to expose Flowbit API for n8n webhooks.
    * All containers must self-configure with environment variables (e.g., MongoDB URI, JWT secret, n8n URLs). No manual steps after `docker-compose up`.

**Nice-to-Have (Bonus Features):**

* Implement a basic **audit log** for ticket events (`{action, userId, tenant, timestamp}`).
* Add a **Cypress smoke test** for the login -> create ticket -> status update flow.
* Add a **GitHub Actions workflow** that lints and runs Jest tests.

**Deliverables:**

* **Git Repository:** Source code, `docker-compose.yml`, and a `seed.js` script to add two tenants (LogisticsCo, RetailGmbH) with one Admin each. Ensure sensitive data (like `ngrok` tokens) is `.gitignore`d.
* **Short Demo Video (<= 3 min):** Clearly demonstrate login as both tenants, ticket creation, status update, and tenant data isolation. (If local Docker issues occur, ensure the video still shows the *flow* works).
* **`README.md`:** Quick-start instructions, a simple architecture diagram (hand-drawn is fine!), and any known limitations.

**Replit Specific Instructions/Hints:**

* You'll likely use Replit's native Docker Compose support.
* **Exposing Ports:** Replit automatically handles exposing ports for services defined in `replit.nix` or `docker-compose.yml`. Your `react-shell` (port 3000) will be your main entry point.
* **`host.docker.internal`:** Replit environments might not directly support `host.docker.internal`. You might need to use the service name directly (e.g., `http://flowbit-api:5000` for inter-container communication) and `0.0.0.0` for listening ports within containers. For `ngrok` or external webhooks, Replit usually provides a public URL for your main exposed service; you'll need to use that for n8n's callback URL.
* **`.env` files:** Replit's Secrets feature (`.env` equivalent) is ideal for storing sensitive environment variables like `JWT_SECRET`, `N8N_CALLBACK_SECRET`, and `NGROK_AUTHTOKEN`.
* **`ngrok` on Replit:** Replit itself might provide a public URL that removes the need for `ngrok` in many cases, especially if your Flowbit API is the primary exposed service. If you *do* use `ngrok`, ensure it's configured to tunnel to the internal Docker Compose service name and port (e.g., `flowbit-api:5000`), not `localhost`.
* **`n8n` in Replit:** n8n's UI will be accessible through its exposed port in your Replit workspace. The webhooks will rely on your Replit deployment's public URL.
