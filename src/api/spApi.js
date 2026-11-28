// Local stand-in for the hosted API. This preview keeps no flow event log,
// so the activity request returns an empty list in the shape the UI expects.
export const spApi = {
  async get(path) {
    if (/^flows\/[^/]+\/events$/.test(path)) return [];
    throw new Error('This route is outside the local extract.');
  },
};
