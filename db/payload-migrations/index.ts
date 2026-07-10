import * as migration_20260710_041123_initial from './20260710_041123_initial';
import * as migration_20260710_044432_add_content_fields from './20260710_044432_add_content_fields';

export const migrations = [
  {
    up: migration_20260710_041123_initial.up,
    down: migration_20260710_041123_initial.down,
    name: '20260710_041123_initial',
  },
  {
    up: migration_20260710_044432_add_content_fields.up,
    down: migration_20260710_044432_add_content_fields.down,
    name: '20260710_044432_add_content_fields'
  },
];
