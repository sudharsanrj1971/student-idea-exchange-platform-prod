import mediasoup from 'mediasoup';
import os from 'os';
import cluster from 'cluster';
import { mediasoupConfig } from '../config/mediasoup.js';
import { logger } from '../config/logger.js';

const workers = [];
let workerIndex = 0;

// Track load per worker (number of active routers)
const workerLoad = new Map();

export async function createWorkerPool() {
  const numCores = os.cpus().length;
  // Scaling Patch: Using 1 Node process (instances: 1) and letting Mediasoup
  // spawn workers matching CPU cores to avoid context switching saturation.
  const numWorkers = Math.max(1, numCores);

  logger.info(`Creating ${numWorkers} Mediasoup workers (${numCores} CPU cores available)`);

  for (let i = 0; i < numWorkers; i++) {
    await spawnWorker(i);
  }

  return workers;
}

async function spawnWorker(index) {
  const worker = await mediasoup.createWorker(mediasoupConfig.worker);

  worker.on('died', async (error) => {
    logger.error(`Mediasoup worker ${index} died — restarting in 2s`, { error: error?.message });
    setTimeout(async () => {
      workers[index] = null;
      await spawnWorker(index);
    }, 2000);
  });

  workers[index] = worker;
  workerLoad.set(index, 0); // Initialize load

  logger.debug(`Mediasoup worker ${index} created (PID: ${worker.pid})`);
  return worker;
}

export function getWorkerByIndex(index) {
  return workers[index];
}

export function incrementWorkerLoad(index) {
  const current = workerLoad.get(index) || 0;
  workerLoad.set(index, current + 1);
}

export function decrementWorkerLoad(index) {
  const current = workerLoad.get(index) || 0;
  workerLoad.set(index, Math.max(0, current - 1));
}

export function getLeastLoadedWorkerIndex() {
  let minLoad = Infinity;
  let minIndex = 0;

  for (let i = 0; i < workers.length; i++) {
    if (!workers[i]) continue;
    const load = workerLoad.get(i) || 0;
    if (load < minLoad) {
      minLoad = load;
      minIndex = i;
    }
  }

  return minIndex;
}

export function getNextWorker() {
  const available = workers.filter(Boolean);
  if (available.length === 0) throw new Error('No Mediasoup workers available');
  const worker = available[workerIndex % available.length];
  workerIndex++;
  return worker;
}

export async function closeWorkerPool() {
  logger.info('Closing Mediasoup worker pool...');
  for (const worker of workers) {
    if (worker) {
      await worker.close();
    }
  }
}
