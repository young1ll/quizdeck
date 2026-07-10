import * as migration_20260710_041123_initial from './20260710_041123_initial';
import * as migration_20260710_044432_add_content_fields from './20260710_044432_add_content_fields';
import * as migration_20260710_061433_site_config from './20260710_061433_site_config';

export const migrations = [
  {
    up: migration_20260710_041123_initial.up,
    down: migration_20260710_041123_initial.down,
    name: '20260710_041123_initial',
  },
  {
    up: migration_20260710_044432_add_content_fields.up,
    down: migration_20260710_044432_add_content_fields.down,
    name: '20260710_044432_add_content_fields',
  },
  {
    up: migration_20260710_061433_site_config.up,
    down: migration_20260710_061433_site_config.down,
    name: '20260710_061433_site_config'
  },
];
