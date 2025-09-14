# ILGD CRM Backend

Express and TypeScript backend for the ILGD CRM application. It exposes a REST
API for managing chatters, users, models, shifts, employee earnings,
commissions and revenue. All responses are returned as JSON.

## Authorization

Authenticate by sending a `POST /api/users/login` request with `{ email,
password }`. The server responds with an object containing a JWT token and the
authenticated user:

```json
{ "token": "<jwt>", "user": { /* user fields */ } }
```

Include the token in an `Authorization` header for all other requests:

```
Authorization: Bearer <jwt>
```

Requests without a valid token receive `401` (no token) or `403` (invalid
token) responses.

## API Endpoints

### Health

- `GET /api/health` – returns `{ ok: true }`.

### Users

- `POST /api/users/login` – authenticate a user; returns `{ token, user }`.
- `GET /api/users` – list users.
- `GET /api/users/:id` – retrieve a single user.
- `POST /api/users` – create a user.
- `PUT /api/users/:id` – update a user.
- `DELETE /api/users/:id` – remove a user (204 No Content).

### Chatters

- `GET /api/chatters` – list chatters.
- `GET /api/chatters/online` – list online chatters.
- `GET /api/chatters/:id` – retrieve a chatter.
- `POST /api/chatters` – create a chatter.
- `PUT /api/chatters/:id` – update a chatter.
- `DELETE /api/chatters/:id` – remove a chatter (204 No Content).

### Employee Earnings

- `GET /api/employee-earnings` – list earnings; supports `chatterId`, `type` and `date` query params; responds with `{ earnings, total }` where `total` is the total number of matching records.
- `GET /api/employee-earnings/leaderboard` – leaderboard summary.
- `GET /api/employee-earnings/totalCount` – total number of earnings; supports `chatterId`, `type`, `modelId` and `date` query params.
- `GET /api/employee-earnings/chatter/:id` – earnings for a chatter.
- `POST /api/employee-earnings/sync` – synchronize earnings data.
- `GET /api/employee-earnings/:id` – fetch an earning record.
- `POST /api/employee-earnings` – create an earning record.
- `PUT /api/employee-earnings/:id` – update an earning record.
- `DELETE /api/employee-earnings/:id` – remove an earning record (204 No
  Content).

### Shifts

- `GET /api/shifts` – list shifts.
- `GET /api/shifts/:id` – retrieve a shift.
- `POST /api/shifts` – create a shift.
- `PUT /api/shifts/:id` – update a shift.
- `DELETE /api/shifts/:id` – remove a shift.
- `POST /api/shifts/clock-in` – clock in a chatter.
- `POST /api/shifts/:id/clock-out` – clock out a chatter.
- `GET /api/shifts/time-entry/active/:chatterId` – get the active time entry
  for a chatter.

### Models

- `GET /api/models` – list models.
- `GET /api/models/:id` – retrieve a model.
- `POST /api/models` – create a model.
- `PUT /api/models/:id` – update a model.
- `DELETE /api/models/:id` – remove a model.

### Commissions

- `GET /api/commissions` – list commissions.
- `GET /api/commissions/:id` – retrieve a commission.
- `POST /api/commissions` – create a commission.
- `PUT /api/commissions/:id` – update a commission.
- `DELETE /api/commissions/:id` – remove a commission.

### Revenue

- `GET /api/revenue/earnings` – retrieve earnings summary.

Unless noted otherwise, endpoints return the requested entity as JSON. Create
and update operations respond with the created or updated record, while delete
operations return status `204 No Content`.

## Scripts

- `npm run dev` - start development server with hot reload
- `npm run build` - compile TypeScript sources
- `npm start` - run the compiled server
- `npm test` - execute tests
- `npm run lint` - lint the codebase
- `npm run docs` - generate API documentation (requires `jsdoc`)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```

Generated documentation is output to the `docs/` folder.
