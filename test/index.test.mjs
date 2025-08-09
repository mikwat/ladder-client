import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import LadderClient from '../src/index.js';

// Helpers
function makeFetch({ responder, record = [] } = {}) {
  const fn = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = init.method || 'GET';
    const headers = init.headers || {};
    let body = init.body;
    record.push({ url, method, headers, body });
    if (typeof responder === 'function') {
      return await responder({ url, method, headers, body });
    }
    // Default successful JSON
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  fn.record = record;
  return fn;
}

describe('LadderClient basics', () => {
  it('requires a token', () => {
    assert.throws(() => new LadderClient(), /requires a Bearer token/);
  });

  it('uses custom fetch implementation', async () => {
    const fetchImpl = makeFetch();
    const client = new LadderClient({ token: 't', fetchImpl });
    const res = await client.getMe();
    assert.equal(res.ok, true);
    assert.equal(fetchImpl.record.length, 1);
    assert.equal(fetchImpl.record[0].url, 'https://rocky-api.prod.ltdev.io/users/me');
    assert.equal(fetchImpl.record[0].method, 'GET');
    assert.equal(fetchImpl.record[0].headers.Authorization, 'Bearer t');
    assert.ok(fetchImpl.record[0].headers.Accept.includes('application/json'));
  });
});

describe('Endpoint shapes and query params', () => {
  it('getUserProfileCalendar builds correct query', async () => {
    const fetchImpl = makeFetch({
      responder: async ({ url }) => {
        const u = new URL(url);
        assert.equal(u.pathname, '/v1/getUserProfileCalendar');
        assert.equal(u.searchParams.get('userID'), 'uid');
        assert.equal(u.searchParams.get('firstDateStr'), '2024-10-27');
        assert.equal(u.searchParams.get('lastDateStr'), '2024-12-01');
        assert.equal(u.searchParams.get('ianaTimezoneID'), 'America/Los_Angeles');
        return new Response(JSON.stringify({ days: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    });
    const client = new LadderClient({ token: 't', fetchImpl });
    const out = await client.getUserProfileCalendar({ userID: 'uid', firstDateStr: '2024-10-27', lastDateStr: '2024-12-01', ianaTimezoneID: 'America/Los_Angeles' });
    assert.deepEqual(out, { days: [] });
  });

  it('getWorkoutMovementData joins array to CSV', async () => {
    const fetchImpl = makeFetch({
      responder: async ({ url }) => {
        const u = new URL(url);
        assert.equal(u.pathname, '/v1/getWorkoutMovementData');
        assert.equal(u.searchParams.get('userID'), 'uid');
        assert.equal(u.searchParams.get('movementIDs'), 'a,b,c');
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    });
    const client = new LadderClient({ token: 't', fetchImpl });
    const out = await client.getWorkoutMovementData({ userID: 'uid', movementIDs: ['a','b','c'] });
    assert.equal(out.ok, true);
  });

  it('getWorkout uses website base and encodes path', async () => {
    const wid = '254a1ccd-8c15-4695-8aba-d1d25af3df65';
    const fetchImpl = makeFetch({
      responder: async ({ url }) => {
        assert.equal(url, `https://www.joinladder.com/api/workouts/${wid}`);
        return new Response(JSON.stringify({ id: wid }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    });
    const client = new LadderClient({ token: 't', fetchImpl });
    const out = await client.getWorkout(wid);
    assert.equal(out.id, wid);
  });

  it('listWorkoutJournalRecommendationsV2 builds correct query', async () => {
    const fetchImpl = makeFetch({
      responder: async ({ url }) => {
        const u = new URL(url);
        assert.equal(u.pathname, '/v1/listWorkoutJournalRecommendationsV2');
        assert.equal(u.searchParams.get('userID'), 'uid');
        assert.equal(u.searchParams.get('workoutID'), 'wid');
        return new Response(JSON.stringify({ recommendations: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    });
    const client = new LadderClient({ token: 't', fetchImpl });
    const out = await client.listWorkoutJournalRecommendationsV2({ userID: 'uid', workoutID: 'wid' });
    assert.deepEqual(out, { recommendations: [] });
  });
});

describe('Error handling and content types', () => {
  it('throws Http-like error with parsed JSON body', async () => {
    const fetchImpl = makeFetch({
      responder: async ({ url }) => new Response(JSON.stringify({ error: 'nope' }), { status: 404, statusText: 'Not Found', headers: { 'content-type': 'application/json' } })
    });
    const client = new LadderClient({ token: 't', fetchImpl });
    await assert.rejects(
      client.getMe(),
      (err) => err && err.name === 'HttpError' && err.status === 404 && err.body?.error === 'nope'
    );
  });

  it('returns text when non-JSON content-type', async () => {
    const fetchImpl = makeFetch({
      responder: async () => new Response('plain', { status: 200, headers: { 'content-type': 'text/plain' } })
    });
    const client = new LadderClient({ token: 't', fetchImpl });
    const txt = await client._request({ base: 'rocky', path: '/users/me' });
    assert.equal(txt, 'plain');
  });

  it('sends JSON body and content-type for non-GET', async () => {
    let captured;
    const fetchImpl = makeFetch({
      responder: async ({ headers, body }) => {
        captured = { headers, body };
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    });
    const client = new LadderClient({ token: 't', fetchImpl });
    const res = await client._request({ base: 'rocky', path: '/v1/custom', method: 'POST', body: { a: 1 } });
    assert.equal(res.ok, true);
    assert.equal(captured.headers['Content-Type'], 'application/json');
    assert.equal(captured.body, JSON.stringify({ a: 1 }));
  });
});
