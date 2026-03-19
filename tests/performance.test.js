import assert from 'node:assert/strict';
import { PerformanceProfiler, profiler } from '../src/utils/performance-profiler.js';

// PerformanceProfiler – basic start / end
{
  const p = new PerformanceProfiler();
  p.start('op1', { label: 'test' });
  const result = p.end('op1');

  assert.ok(result.duration >= 0);
  assert.equal(result.name, 'op1');
  assert.deepEqual(result.metadata, { label: 'test' });
  assert.ok(result.timestamp > 0);
  console.log('✓ PerformanceProfiler start / end');
}

// PerformanceProfiler – checkpoints
{
  const p = new PerformanceProfiler();
  p.start('op2');
  p.checkpoint('op2', 'phase-a');
  p.checkpoint('op2', 'phase-b');
  const result = p.end('op2');

  assert.equal(result.checkpoints.length, 2);
  assert.equal(result.checkpoints[0].name, 'phase-a');
  assert.equal(result.checkpoints[1].name, 'phase-b');
  console.log('✓ PerformanceProfiler checkpoints');
}

// PerformanceProfiler – checkpoint on unknown name is a no-op
{
  const p = new PerformanceProfiler();
  p.checkpoint('does-not-exist', 'step');
  // no throw
  console.log('✓ PerformanceProfiler checkpoint on unknown name is a no-op');
}

// PerformanceProfiler – end on unknown name returns null
{
  const p = new PerformanceProfiler();
  const result = p.end('never-started');
  assert.equal(result, null);
  console.log('✓ PerformanceProfiler end on unknown name returns null');
}

// PerformanceProfiler – profileFunction
{
  const p = new PerformanceProfiler();
  const { result, profile } = await p.profileFunction(
    'async-op',
    async (x) => x * 2,
    [21]
  );
  assert.equal(result, 42);
  assert.ok(profile.duration >= 0);
  console.log('✓ PerformanceProfiler.profileFunction()');
}

// PerformanceProfiler – getProfiles / getProfile / clear
{
  const p = new PerformanceProfiler();
  p.start('a'); p.end('a');
  p.start('b'); p.end('b');

  const all = p.getProfiles();
  assert.equal(all.length, 2);

  const a = p.getProfile('a');
  assert.equal(a.name, 'a');

  const missing = p.getProfile('z');
  assert.equal(missing, null);

  p.clear();
  assert.equal(p.getProfiles().length, 0);
  console.log('✓ PerformanceProfiler getProfiles / getProfile / clear');
}

// PerformanceProfiler – generateReport
{
  const p = new PerformanceProfiler();
  p.start('r1'); p.end('r1');
  p.start('r2'); p.end('r2');
  p.start('r3'); p.end('r3');

  const report = p.generateReport();
  assert.equal(report.summary.totalProfiles, 3);
  assert.ok(report.summary.avgDuration >= 0);
  assert.ok(Array.isArray(report.slowestOperations));
  assert.ok(Array.isArray(report.memoryIntensive));
  console.log('✓ PerformanceProfiler.generateReport()');
}

// generateReport on empty profiler
{
  const p = new PerformanceProfiler();
  const report = p.generateReport();
  assert.equal(report.message, 'No profiles available');
  console.log('✓ PerformanceProfiler.generateReport() on empty profiler');
}

// singleton profiler is exported
{
  assert.ok(profiler instanceof PerformanceProfiler);
  profiler.start('singleton-test');
  profiler.end('singleton-test');
  const prof = profiler.getProfile('singleton-test');
  assert.ok(prof);
  console.log('✓ singleton profiler instance');
}

console.log('\n✅ performance tests passed');
