/**
 * syncTransactionEarnings module.
 */
import '../config/timezone';
import 'reflect-metadata';
import '../container';
import {container} from 'tsyringe';
import {F2FTransactionSyncService} from '../business/services/F2FTransactionSyncService';

async function runOnce() {
  const svc = container.resolve(F2FTransactionSyncService);
  const created = await svc.syncRecentTransactions();
  console.log(`Synced ${created} recent transactions`);
}

runOnce().catch(err => {
  console.error('Sync failed', err);
  process.exit(1);
});

const INTERVAL_MS = 60 * 60 * 1000;
setInterval(() => {
  runOnce().catch(err => console.error('Sync failed', err));
}, INTERVAL_MS);
