# VexzHubStudio

## Database

The application uses **MongoDB** through the official `mongodb` Node.js driver. The database connection is lazy and collections/indexes are initialized on the first database request.

Configure these environment variables:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority
MONGODB_DB=vexzhubstudio
```

`MONGODB_DB` defaults to `vexzhubstudio`. The application creates the `users`, `coinTransactions`, `rewardAttempts`, and `counters` collections and their required unique indexes automatically.

For production, use a MongoDB replica set or MongoDB Atlas because reward claiming uses a transaction to atomically create a claim, increment the user's balance, and close the reward attempt.

## Development

```bash
pnpm install
pnpm check
pnpm build
pnpm dev
```

The old MySQL/Drizzle migration files are retained only as historical repository files; runtime persistence no longer imports or uses them.
