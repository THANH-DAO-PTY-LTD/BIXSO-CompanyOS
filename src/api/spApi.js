export const spApi = {
  async get(path) {
    if (/^flows\/[^/]+\/events$/.test(path)) return { data: [] };
    throw new Error('This route is outside the local extract.');
  },
};
