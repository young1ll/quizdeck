import * as migration_20260710_041123_initial from './20260710_041123_initial';

export const migrations = [
  {
    up: migration_20260710_041123_initial.up,
    down: migration_20260710_041123_initial.down,
    name: '20260710_041123_initial'
  },
];
