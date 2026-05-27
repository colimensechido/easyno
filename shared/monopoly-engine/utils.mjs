export function clone(value) {
  return structuredClone(value);
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function createId(prefix, counter) {
  return `${prefix}_${counter}`;
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function shuffle(items, random = Math.random) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

export function rollTwoDice(random = Math.random) {
  const dieOne = Math.floor(random() * 6) + 1;
  const dieTwo = Math.floor(random() * 6) + 1;

  return {
    dice: [dieOne, dieTwo],
    total: dieOne + dieTwo,
    isDouble: dieOne === dieTwo
  };
}

export function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function groupBy(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(item);
    return groups;
  }, new Map());
}
