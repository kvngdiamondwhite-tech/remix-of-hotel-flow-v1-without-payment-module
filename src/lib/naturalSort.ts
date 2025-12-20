// Natural sorting utility for human-readable order (Room 1, Room 2, Room 10 instead of Room 1, Room 10, Room 2)

export function naturalSort<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const aVal = key(a);
    const bVal = key(b);
    return aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
  });
}
