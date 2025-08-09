import LadderClient from "../src/index.js";

function line(title = "") {
  console.log("\n===", title, "===");
}

function printKV(label, obj = {}) {
  const keys = Object.keys(obj || {});
  console.log(`${label}:`, keys.length ? keys.join(", ") : obj);
}

async function main() {
  const token = process.env.LADDER_TOKEN;
  if (!token) {
    console.error("Set LADDER_TOKEN env var with a valid JWT.");
    process.exit(1);
  }

  const client = new LadderClient({ token });

  // 1) User
  line("/users/me");
  const me = await client.getMe();
  const userID = me?.id || me?.userID || me?.user?.id || me?.profile?.id;
  console.log("User ID:", userID);
  console.log("Name:", me?.name || me?.user?.name || me?.profile?.name || "<unknown>");
  console.log("Email:", me?.email || me?.user?.email || me?.profile?.email || "<unknown>");
  printKV("/users/me keys", me);

  // 2) Teams
  line("/v1/listTeams");
  const teams = await client.listTeams();
  const teamList = teams?.teams || teams?.data || [];
  console.log("Teams count:", Array.isArray(teamList) ? teamList.length : 0);
  if (Array.isArray(teamList)) {
    for (const t of teamList.slice(0, 5)) {
      console.log("-", t?.id || t?.teamID || "<id>", ":", t?.name || t?.title || "<name>");
    }
  }

  if (!userID) {
    console.warn("Could not infer userID from /users/me; skipping user-specific calls.");
    return;
  }

  // 3) Calendar
  line("/v1/getUserProfileCalendar");
  const calendar = await client.getUserProfileCalendar({
    userID,
    firstDateStr: "2025-08-01",
    lastDateStr: "2025-08-08",
    ianaTimezoneID: "America/Los_Angeles",
  });
  const calendarEntries = calendar?.calendarEntries || [];
  console.log("Calendar entries:", Array.isArray(calendarEntries) ? calendarEntries.length : 0);
  if (Array.isArray(calendarEntries)) {
    for (const d of calendarEntries.slice(0, 3)) {
      const label = d?.dateStr || "<day>";
      const wos = d.workoutSessionIDs.length;
      console.log("-", label, "| workouts:", wos);
    }
  }

  // 4) Journal summary
  line("/v1/getWorkoutJournalSummary");
  const summary = await client.getWorkoutJournalSummary(userID);
  printKV("Summary keys", summary);
  const total = summary?.totalWorkouts ?? summary?.workoutCount ?? undefined;
  if (typeof total === "number") console.log("Total workouts:", total);

  // 5) Movement data (example IDs)
  line("/v1/getWorkoutMovementData");
  const movementData = await client.getWorkoutMovementData({
    userID,
    movementIDs: ["256254e1-1bf8-48bc-81c8-af8d79e4b090"],
  });
  printKV("Movement data keys", movementData);

  // 6) Workout object (from website base)
  line("GET https://www.joinladder.com/api/workouts/:id");
  const workoutID = "254a1ccd-8c15-4695-8aba-d1d25af3df65";
  const workout = await client.getWorkout(workoutID);
  console.log("Workout:", workout?.title || workout?.name || workout?.id || workoutID);
  const blocks = Array.isArray(workout?.blocks) ? workout.blocks.length : undefined;
  if (typeof blocks === "number") console.log("Blocks:", blocks);

  // 7) Detailed session
  line("/v1/getDetailedWorkoutSession");
  const sessionID = "fdf1f41b-5fd8-4edd-b41c-18fa4fc5f313";
  const detailed = await client.getDetailedWorkoutSession(sessionID);
  printKV("Detailed session keys", detailed);
  const start = detailed?.startTime || detailed?.startedAt || detailed?.date;
  if (start) console.log("Start time:", start);

  // 8) Recommendations V2 for a workout
  line("/v1/listWorkoutJournalRecommendationsV2");
  const recs = await client.listWorkoutJournalRecommendationsV2({
    userID,
    workoutID: "0144ead7-68c6-4990-837c-319bbda07fba",
  });
  printKV("Recommendations object keys", recs);
  const items = recs?.recommendations || recs?.items || recs?.data || [];
  if (Array.isArray(items)) {
    for (const r of items.slice(0, 3)) {
      console.log("-", r?.id || r?.workoutID || "<id>", ":", r?.title || r?.name || "<title>");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
