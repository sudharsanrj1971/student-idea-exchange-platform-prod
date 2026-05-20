import { getWorkerByIndex, getLeastLoadedWorkerIndex, incrementWorkerLoad, decrementWorkerLoad } from './worker.js';

export async function getAllRouters() {
  const routers = [];
  for (const [sessionId, routerPromise] of routerPromises.entries()) {
    try {
      const router = await routerPromise;
      if (router) routers.push(router);
    } catch (e) {
      logger.error('Failed to get router for session', { sessionId, error: e.message });
    }
  }
  return routers;
}

// Alias for compatibility
export const getRouterForSession = getRouter;

import { mediasoupConfig } from '../config/mediasoup.js';
import { Session } from '../models/Session.model.js';
import { logger } from '../config/logger.js';
import { nanoid } from 'nanoid';

const PROCESS_ID = nanoid();
logger.info(`Initialized Mediasoup router manager [Process ID: ${PROCESS_ID}]`);

/**
 * Map of sessionId → Promise<mediasoup.Router>
 * Using Promises ensures parallel requests for the same session don't create multiple routers.
 */
const routerPromises = new Map();

export async function getRouter(sessionId) {
  let routerPromise = routerPromises.get(sessionId);

  if (routerPromise) {
    return routerPromise;
  }

  // Define creation logic as a promise
  routerPromise = (async () => {
    try {
      // 1. Check DB for assigned worker
      const session = await Session.findById(sessionId);
      let workerIndex = session?.workerId;

      // 2. Validate the stored workerIndex — use existing worker if it belongs to this process
      let worker = (workerIndex !== null && workerIndex !== undefined)
        ? getWorkerByIndex(workerIndex)
        : null;

      // 3. If worker found but it's closed, reset worker variable
      if (worker && worker.closed) {
        logger.warn(`Worker ${workerIndex} is closed — re-assigning`);
        worker = null;
      }

      // 4. If no worker assigned or worker not found in this process, pick a fresh one
      if (!worker) {
        workerIndex = getLeastLoadedWorkerIndex();
        worker = getWorkerByIndex(workerIndex);

        if (!worker) {
          throw new Error('No Mediasoup workers are available.');
        }

        // Persist the workerIndex and clear stale routerId
        await Session.findByIdAndUpdate(sessionId, {
          $set: { 
            workerId: workerIndex,
            routerId: null,
            processId: PROCESS_ID
          }
        });
      }

      const router = await worker.createRouter({
        mediaCodecs: mediasoupConfig.router.mediaCodecs,
      });

      logger.info(`Created Mediasoup router for session ${sessionId} [Worker: ${workerIndex}]`);
      incrementWorkerLoad(workerIndex);

      // Save router ID to DB
      await Session.findByIdAndUpdate(sessionId, {
        $set: { 
          routerId: router.id,
          workerId: workerIndex,
          processId: PROCESS_ID
        }
      });
      logger.info(`Successfully persisted routerId ${router.id} for session ${sessionId}`);

      router.on('workerclose', () => {
        logger.error(`Mediasoup worker closed for session ${sessionId}`);
        routerPromises.delete(sessionId);
        decrementWorkerLoad(workerIndex);
      });

      router.on('@close', () => {
        logger.debug(`Mediasoup router closed for session ${sessionId}`);
        routerPromises.delete(sessionId);
        decrementWorkerLoad(workerIndex);
      });

      return router;
    } catch (err) {
      logger.error('Failed to create Mediasoup router', { sessionId, error: err.message });
      routerPromises.delete(sessionId);
      throw err;
    }
  })();

  routerPromises.set(sessionId, routerPromise);
  return routerPromise;
}

export function closeRouter(sessionId) {
  const routerPromise = routerPromises.get(sessionId);
  if (routerPromise) {
    routerPromise.then(r => r.close());
    routerPromises.delete(sessionId);
    logger.info(`Requested closure for session ${sessionId} router`);
  }
}

