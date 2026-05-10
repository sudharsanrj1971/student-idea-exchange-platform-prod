import os from 'os';
import v8 from 'v8';

console.log('--- IChange System Monitor Started ---');
console.log('Time, CPU Load (1m), Free Mem (MB), Total Mem (MB), Heap Used (MB)');

setInterval(() => {
  const load = os.loadavg()[0].toFixed(2);
  const freeMem = (os.freemem() / (1024 * 1024)).toFixed(0);
  const totalMem = (os.totalmem() / (1024 * 1024)).toFixed(0);
  const heap = v8.getHeapStatistics();
  const heapUsed = (heap.used_heap_size / (1024 * 1024)).toFixed(0);
  
  const now = new Date().toLocaleTimeString();
  console.log(`${now}, ${load}, ${freeMem}, ${totalMem}, ${heapUsed}`);
}, 1000);
