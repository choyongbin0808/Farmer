const handlers = {};

export const EventBus = {
  on(evt, fn) {
    (handlers[evt] ||= []).push(fn);
  },
  off(evt, fn) {
    handlers[evt] = (handlers[evt] || []).filter((f) => f !== fn);
  },
  emit(evt, data) {
    for (const fn of handlers[evt] || []) fn(data);
  },
};
