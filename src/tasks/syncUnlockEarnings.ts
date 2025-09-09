import '../config/timezone';
import 'reflect-metadata';
import '../container';
import {container} from 'tsyringe';
import {F2FUnlockSyncService} from '../business/services/F2FUnlockSyncService';

async function runOnce() {
  const svc = container.resolve(F2FUnlockSyncService);
  await svc.syncLast24Hours();
}

runOnce().catch(err => {
  console.error('Sync failed', err);
  process.exit(1);
});

const DAY_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  runOnce().catch(err => console.error('Sync failed', err));
}, DAY_MS);
