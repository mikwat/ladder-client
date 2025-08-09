/**
 * Unofficial JavaScript client for the Ladder (JoinLadder) API.
 *
 * Notes:
 * - Requires a valid user JWT (Bearer token) from the Ladder app or web session.
 * - Targets observed endpoints based on reverse engineering, subject to change.
 * - Designed for Node.js >= 18 (global fetch).
 */

const DEFAULT_ROCKY_BASE = "https://rocky-api.prod.ltdev.io";
const DEFAULT_WEBSITE_BASE = "https://www.joinladder.com";

/**
 * Build a URL with query params.
 * @param {string} base - e.g. https://host
 * @param {string} path - e.g. /v1/endpoint
 * @param {Record<string, string | number | boolean | undefined> | URLSearchParams} [query]
 */
function buildUrl(base, path, query) {
  const url = new URL(path, base);
  if (query) {
    const params = query instanceof URLSearchParams ? query : new URLSearchParams();
    if (!(query instanceof URLSearchParams)) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        params.set(k, String(v));
      }
    }
    // Append provided params without nuking existing
    for (const [k, v] of params.entries()) url.searchParams.set(k, v);
  }
  return url.toString();
}

/**
 * Lightweight HTTP error including parsed response body when possible.
 */
class HttpError extends Error {
  constructor(message, { status, statusText, url, body } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.body = body;
  }
}

/**
 * Ladder API client (unofficial).
 */
export class LadderClient {
  /**
   * @param {object} opts
   * @param {string} opts.token - Bearer token (JWT) for Authorization.
   * @param {string} [opts.rockyBaseUrl] - Base URL for the Rocky API.
   * @param {string} [opts.websiteBaseUrl] - Base URL for www.joinladder.com.
   * @param {(input: RequestInfo, init?: RequestInit) => Promise<Response>} [opts.fetchImpl] - Custom fetch.
   */
  constructor({ token, rockyBaseUrl = DEFAULT_ROCKY_BASE, websiteBaseUrl = DEFAULT_WEBSITE_BASE, fetchImpl } = {}) {
    if (!token) throw new Error("LadderClient requires a Bearer token");
    this.token = token;
    this.rockyBaseUrl = rockyBaseUrl.replace(/\/$/, "");
    this.websiteBaseUrl = websiteBaseUrl.replace(/\/$/, "");
    this._fetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
    if (!this._fetch) throw new Error("No fetch implementation found; Node 18+ or provide fetchImpl");
  }

  /**
   * Internal request helper.
   * @param {object} req
   * @param {"rocky"|"website"} [req.base]
   * @param {string} req.path
   * @param {Record<string,string|number|boolean|undefined>|URLSearchParams} [req.query]
   * @param {string} [req.method]
   * @param {any} [req.body]
   * @returns {Promise<any>} Parsed response body (JSON or text)
   */
  async _request({ base = "rocky", path, query, method = "GET", body }) {
    const baseUrl = base === "website" ? this.websiteBaseUrl : this.rockyBaseUrl;
    const url = buildUrl(baseUrl, path, query);
    const headers = {
      "Authorization": `Bearer ${this.token}`,
      "Accept": "application/json, text/plain;q=0.9,*/*;q=0.8",
    };
    const init = { method, headers };
    if (body !== undefined && body !== null && method !== "GET") {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const res = await this._fetch(url, init);
    const ct = res.headers.get("content-type") || "";
    const isJson = ct.includes("application/json");
    let parsed;
    try {
      parsed = isJson ? await res.json() : await res.text();
    } catch (e) {
      parsed = null;
    }
    if (!res.ok) {
      const message = `HTTP ${res.status} ${res.statusText} for ${url}`;
      throw new HttpError(message, { status: res.status, statusText: res.statusText, url, body: parsed });
    }
    return parsed;
  }

  // ===== Observed endpoints =====

  /** GET /users/me */
  async getMe() {
    return this._request({ base: "rocky", path: "/users/me" });
  }

  /** GET /v1/listTeams */
  async listTeams() {
    return this._request({ base: "rocky", path: "/v1/listTeams" });
  }

  /**
   * GET /v1/getUserProfileCalendar
   * @param {object} p
   * @param {string} p.userID
   * @param {string} p.firstDateStr - YYYY-MM-DD
   * @param {string} p.lastDateStr - YYYY-MM-DD
   * @param {string} p.ianaTimezoneID - e.g. America/Los_Angeles
   */
  async getUserProfileCalendar({ userID, firstDateStr, lastDateStr, ianaTimezoneID }) {
    if (!userID) throw new Error("userID required");
    if (!firstDateStr || !lastDateStr) throw new Error("firstDateStr and lastDateStr required");
    if (!ianaTimezoneID) throw new Error("ianaTimezoneID required");
    return this._request({
      base: "rocky",
      path: "/v1/getUserProfileCalendar",
      query: { userID, firstDateStr, lastDateStr, ianaTimezoneID },
    });
  }

  /**
   * GET /v1/getWorkoutJournalSummary
   * @param {string} userID
   */
  async getWorkoutJournalSummary(userID) {
    if (!userID) throw new Error("userID required");
    return this._request({
      base: "rocky",
      path: "/v1/getWorkoutJournalSummary",
      query: { userID },
    });
  }

  /**
   * GET https://www.joinladder.com/api/workouts/:id
   * @param {string} workoutID
   */
  async getWorkout(workoutID) {
    if (!workoutID) throw new Error("workoutID required");
    return this._request({ base: "website", path: `/api/workouts/${encodeURIComponent(workoutID)}` });
  }

  /**
   * GET /v1/getDetailedWorkoutSession?workoutSessionID=...
   * @param {string} workoutSessionID
   */
  async getDetailedWorkoutSession(workoutSessionID) {
    if (!workoutSessionID) throw new Error("workoutSessionID required");
    return this._request({
      base: "rocky",
      path: "/v1/getDetailedWorkoutSession",
      query: { workoutSessionID },
    });
  }

  /**
   * GET /v1/getWorkoutMovementData?userID=...&movementIDs=...
   * @param {object} p
   * @param {string} p.userID
   * @param {string|string[]} p.movementIDs - One or many movement IDs.
   */
  async getWorkoutMovementData({ userID, movementIDs }) {
    if (!userID) throw new Error("userID required");
    if (!movementIDs || (Array.isArray(movementIDs) && movementIDs.length === 0)) {
      throw new Error("movementIDs required");
    }
    const ids = Array.isArray(movementIDs) ? movementIDs.join(",") : movementIDs;
    return this._request({
      base: "rocky",
      path: "/v1/getWorkoutMovementData",
      query: { userID, movementIDs: ids },
    });
  }

  /**
   * GET /v1/listWorkoutJournalRecommendationsV2?userID=...&workoutID=...
   * @param {object} p
   * @param {string} p.userID
   * @param {string} p.workoutID
   */
  async listWorkoutJournalRecommendationsV2({ userID, workoutID }) {
    if (!userID) throw new Error("userID required");
    if (!workoutID) throw new Error("workoutID required");
    return this._request({
      base: "rocky",
      path: "/v1/listWorkoutJournalRecommendationsV2",
      query: { userID, workoutID },
    });
  }
}

export default LadderClient;
