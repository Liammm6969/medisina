import pLimit from 'p-limit';

const DEFAULT_LIMIT = 5;

export const createLimiter = (concurrency = DEFAULT_LIMIT) => {
  return pLimit(concurrency);
};

export const limitedAll = async (promiseFns, concurrency = DEFAULT_LIMIT) => {
  const limit = createLimiter(concurrency);
  return Promise.all(promiseFns.map(fn => limit(() => fn())));
};

export const limitConcurrency = async (items, asyncFn, concurrency = DEFAULT_LIMIT) => {
  const limit = createLimiter(concurrency);
  return Promise.all(items.map(item => limit(() => asyncFn(item))));
};

export default {
  createLimiter,
  limitedAll,
  limitConcurrency
};
