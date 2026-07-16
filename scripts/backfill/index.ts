import { backfillFifa } from './fifa';
import { backfillRugby } from './rugby';
import { backfillWbsc } from './wbsc';
import { backfillWta } from './wta';

const RUNNERS: Record<string, () => Promise<void>> = {
  fifa: backfillFifa,
  rugby: backfillRugby,
  wbsc: backfillWbsc,
  wta: backfillWta,
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const names = args.length === 0 || args.includes('all') ? Object.keys(RUNNERS) : args;
  for (const name of names) {
    const runner = RUNNERS[name];
    if (!runner) {
      console.error(`unknown backfill target: ${name} (choose: ${Object.keys(RUNNERS).join(', ')})`);
      process.exit(1);
    }
    console.log(`=== backfill: ${name} ===`);
    await runner();
  }
}

main();
