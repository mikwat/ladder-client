Unofficial Ladder API Client (JavaScript)

This is a lightweight, unofficial JavaScript client for the Ladder (JoinLadder) API, reverse‑engineered from observed requests. Endpoints and shapes may change without notice.

Requirements
- Node.js 18+ (uses built‑in `fetch`).
- A valid Ladder user Bearer token (JWT).

Install
- Local usage (no publish required): clone this repo and import from `src/index.js`.
- Or copy `src/index.js` into your project as needed.

Usage
1) Set your token in an environment variable (example):
   `export LADDER_TOKEN=eyJ...` (never commit tokens)

2) Example script:
   - See `examples/quickstart.mjs` or inline:

   ```js
   import LadderClient from "./src/index.js";

   const client = new LadderClient({ token: process.env.LADDER_TOKEN });

   const me = await client.getMe();
   console.log("Me:", me);

   const teams = await client.listTeams();
   console.log("Teams:", teams);

   const calendar = await client.getUserProfileCalendar({
     userID: me?.id || me?.userID,
     firstDateStr: "2024-10-27",
     lastDateStr: "2024-12-01",
     ianaTimezoneID: "America/Los_Angeles",
   });
   console.log("Calendar:", calendar);

   const summary = await client.getWorkoutJournalSummary(me?.id || me?.userID);
   console.log("Journal Summary:", summary);

   const workout = await client.getWorkout("254a1ccd-8c15-4695-8aba-d1d25af3df65");
   console.log("Workout:", workout);

   const detailed = await client.getDetailedWorkoutSession("fdf1f41b-5fd8-4edd-b41c-18fa4fc5f313");
   console.log("Detailed Session:", detailed);

   const movementData = await client.getWorkoutMovementData({
     userID: me?.id || me?.userID,
     movementIDs: ["256254e1-1bf8-48bc-81c8-af8d79e4b090"],
   });
   console.log("Movement Data:", movementData);
   ```

Supported Endpoints
- `GET /users/me`
- `GET /v1/listTeams`
- `GET /v1/getUserProfileCalendar?userID&firstDateStr&lastDateStr&ianaTimezoneID`
- `GET /v1/getWorkoutJournalSummary?userID`
- `GET /v1/listWorkoutJournalRecommendationsV2?userID&workoutID`
- `GET https://www.joinladder.com/api/workouts/:workoutID`
- `GET /v1/getDetailedWorkoutSession?workoutSessionID`
- `GET /v1/getWorkoutMovementData?userID&movementIDs`

Constructor
```js
new LadderClient({
  token: "<Bearer JWT>",
  rockyBaseUrl?: "https://rocky-api.prod.ltdev.io",
  websiteBaseUrl?: "https://www.joinladder.com",
  fetchImpl?: customFetch,
});
```

Notes
- Tokens expire; handle refresh externally.
- This is not an official client; endpoints may change or enforce stricter auth.
- Move IDs may support multiple values; client sends CSV when an array is provided.
- Errors throw `HttpError` with `status`, `statusText`, `url`, and parsed `body` (when available).

Security
- Treat your JWT like a password. Do not commit, log, or share it. Prefer environment variables or a secret manager.
