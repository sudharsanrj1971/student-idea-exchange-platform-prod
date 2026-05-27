import * as mediasoupClient from 'mediasoup-client';
import { socketService } from './socket.js';
import { toast } from 'react-hot-toast';

class WebRTCService {
  constructor() {
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map();
    this.consumers = new Map(); // consumerId → consumer
    this.producerToConsumerMap = new Map(); // producerId → consumerId
    this.sessionId = null;
    this.consumePromises = new Map();
    this.consumeQueue = Promise.resolve(); // serialize recvTransport.consume() calls
  }

  async init(sessionId) {
    if (this.sessionId === sessionId && this.device?.loaded) return this.device;
    
    // Prevent multiple parallel initializations
    if (this.initPromise && this.sessionId === sessionId) {
      return this.initPromise;
    }

    this.sessionId = sessionId;
    this.initPromise = (async () => {
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          const { rtpCapabilities } = await this._request('media:getRtpCapabilities', { sessionId });

          if (!this.device) {
            this.device = new mediasoupClient.Device();
          }
          
          if (!this.device.loaded) {
            try {
              await this.device.load({ routerRtpCapabilities: rtpCapabilities });
            } catch (loadErr) {
              toast.error('Browser not supported for video, please use Chrome');
              throw loadErr;
            }
          }

          return this.device;
        } catch (err) {
          attempts++;
          console.warn(`[WebRTC] Initialization attempt ${attempts} failed:`, err.message);
          if (attempts >= maxAttempts) {
            console.error('[WebRTC] Initialization failed permanently after', maxAttempts, 'attempts');
            throw err;
          }
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
        }
      }
    })();

    return this.initPromise;
  }

  async createSendTransport() {
    if (this.sendTransportPromise) return this.sendTransportPromise;

    if (this.sendTransport && !this.sendTransport.closed) {
      return this.sendTransport;
    }
    
    this.sendTransportPromise = (async () => {
      try {
        // Ensure device is initialized before creating transports
        if (this.initPromise) await this.initPromise;
        if (!this.device || !this.device.loaded) {
          throw new Error('WebRTC device not initialized');
        }

        const { transportId, params } = await this._request('media:createTransport', {
          sessionId: this.sessionId,
          direction: 'send',
        });

        const transportOptions = {
          ...params,
          iceServers: params.iceServers || [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        };
        const transport = this.device.createSendTransport(transportOptions);
        this.sendTransport = transport;

        transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await this._request('media:connectTransport', { transportId, dtlsParameters });
            callback();
          } catch (err) {
            errback(err);
          }
        });

        transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
          try {
            const { producerId } = await this._request('media:produce', {
              sessionId: this.sessionId,
              transportId,
              kind,
              rtpParameters,
              appData,
            });
            callback({ id: producerId });
          } catch (err) {
            errback(err);
          }
        });

        return transport;
      } finally {
        this.sendTransportPromise = null;
      }
    })();

    return this.sendTransportPromise;
  }

  async createRecvTransport() {
    if (this.recvTransportPromise) return this.recvTransportPromise;

    if (this.recvTransport && !this.recvTransport.closed) {
      return this.recvTransport;
    }

    this.recvTransportPromise = (async () => {
      try {
        // Ensure device is initialized before creating transports
        if (this.initPromise) await this.initPromise;
        if (!this.device || !this.device.loaded) {
          throw new Error('WebRTC device not initialized');
        }

        const { transportId, params } = await this._request('media:createTransport', {
          sessionId: this.sessionId,
          direction: 'recv',
        });

        const transportOptions = {
          ...params,
          iceServers: params.iceServers || [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        };
        const transport = this.device.createRecvTransport(transportOptions);
        this.recvTransport = transport;

        transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await this._request('media:connectTransport', { transportId, dtlsParameters });
            callback();
          } catch (err) {
            errback(err);
          }
        });

        return transport;
      } finally {
        this.recvTransportPromise = null;
      }
    })();

    return this.recvTransportPromise;
  }

  async produceStream(stream, appData = {}) {
    const transport = await this.createSendTransport();
    if (!transport || transport.closed) {
      throw new Error('Send transport is not available');
    }

    const producers = [];
    for (const track of stream.getTracks()) {
      // Deduplicate: skip if we already have a healthy producer for this exact track
      const existing = Array.from(this.producers.values()).find(
        p => !p.closed && p.track?.id === track.id
      );
      if (existing) {
        producers.push(existing);
        continue;
      }

      // For camera streams (not screen), also skip if a same-kind non-screen producer exists
      // to prevent double video producers when restarting camera
      if (!appData.screen) {
        const sameKind = Array.from(this.producers.values()).find(
          p => !p.closed && p.kind === track.kind && !p.appData?.screen
        );
        if (sameKind) {
          // Replace the old producer instead of duplicating
          sameKind.replaceTrack({ track }).catch(err => {
            console.warn('[WebRTC] replaceTrack failed, will close old producer:', err.message);
            this.producers.delete(sameKind.id);
            sameKind.close();
          });
          producers.push(sameKind);
          continue;
        }
      }

      // Configure Simulcast (send 3 quality tiers for video) & Audio DTX
      let encodings = undefined;
      let codecOptions = undefined;

      if (track.kind === 'video') {
        if (appData.screen) {
          // Screen share needs high quality, no simulcast downscaling
          encodings = [{ maxBitrate: 2500000 }];
        } else {
          // Standard webcams use simulcast: Low, Med, High
          encodings = [
            { scaleResolutionDownBy: 4, maxBitrate: 100000 },
            { scaleResolutionDownBy: 2, maxBitrate: 300000 },
            { scaleResolutionDownBy: 1, maxBitrate: 900000 }
          ];
        }
      } else if (track.kind === 'audio') {
        // Discontinuous Transmission (saves bandwidth when not speaking)
        codecOptions = { opusDtx: true, opusFec: true };
      }

      const producer = await transport.produce({ track, appData, encodings, codecOptions });
      this.producers.set(producer.id, producer);
      producers.push(producer);

      producer.on('transportclose', () => {
        this.producers.delete(producer.id);
      });
    }
    return producers;
  }


  async consumeProducer(producerId) {
    // Prevent concurrent consumes for the same producer
    if (this.consumePromises.has(producerId)) {
      return this.consumePromises.get(producerId);
    }

    const consumeTask = async () => {
      if (!this.recvTransport) await this.createRecvTransport();

      // Check if we already have a consumer for this producer
      const existingConsumerId = this.producerToConsumerMap.get(producerId);
      if (existingConsumerId) {
        const existing = this.consumers.get(existingConsumerId);
        if (existing && !existing.closed) return existing;
      }

    const { consumerId, kind, rtpParameters } = await this._request('media:consume', {
      sessionId: this.sessionId,
      transportId: this.recvTransport.id,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });
    const consumer = await new Promise((resolve, reject) => {
      const task = () => this.recvTransport.consume({ id: consumerId, producerId, kind, rtpParameters });
      this.consumeQueue = this.consumeQueue.then(task, task).then(resolve, reject);
    });

    this.consumers.set(consumer.id, consumer);
    this.producerToConsumerMap.set(producerId, consumer.id);

    consumer.on('transportclose', () => {
      this.consumers.delete(consumer.id);
      this.producerToConsumerMap.delete(producerId);
    });

      // Resume consumer
      await this._request('media:resumeConsumer', { consumerId });
      consumer.resume();

      return consumer;
    };

    const promise = consumeTask();
    this.consumePromises.set(producerId, promise);
    
    try {
      return await promise;
    } finally {
      this.consumePromises.delete(producerId);
    }
  }

  async pauseConsumer(consumerId) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer || consumer.paused) return;
    
    try {
      await this._request('media:pauseConsumer', { consumerId });
      consumer.pause();
    } catch (err) {
      console.error('[WebRTC] Failed to pause consumer:', err.message);
    }
  }

  async resumeConsumer(consumerId) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer || !consumer.paused) return;
    
    try {
      await this._request('media:resumeConsumer', { consumerId });
      consumer.resume();
    } catch (err) {
      console.error('[WebRTC] Failed to resume consumer:', err.message);
    }
  }

  async getConsumerStats(consumerId) {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) return null;
    try {
      return await consumer.getStats();
    } catch (err) {
      console.error('[WebRTC] Failed to get consumer stats:', err.message);
      return null;
    }
  }

  closeAll() {
    this.producers.forEach((p) => p.close());
    this.consumers.forEach((c) => c.close());
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.producers.clear();
    this.consumers.clear();
    this.producerToConsumerMap.clear();
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.sessionId = null; // BUG FIX: reset so re-joining same session re-inits device
    this.consumePromises.clear();
    this.initPromise = null;
    this.sendTransportPromise = null;
    this.recvTransportPromise = null;
  }
  
  async closeProducer(producerId) {
    const producer = this.producers.get(producerId);
    if (!producer) return;

    producer.close();
    this.producers.delete(producerId);
    
    // Notify server
    socketService.emit('media:closeProducer', { 
      sessionId: this.sessionId, 
      producerId 
    });
  }

  _request(event, data) {
    return new Promise((resolve, reject) => {
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        return reject(new Error(`Socket not connected for request: ${event}`));
      }

      const responseMap = {
        'media:getRtpCapabilities': 'media:rtpCapabilities',
        'media:createTransport': 'media:transportCreated',
        'media:connectTransport': 'media:transportConnected',
        'media:produce': 'media:produced',
        'media:consume': 'media:consumed',
        'media:resumeConsumer': 'media:resumed',
        'media:pauseConsumer': 'media:paused',
        'media:getProducers': 'media:producers',
      };

      const responseEvent = responseMap[event];
      if (!responseEvent) return reject(new Error(`Unknown event: ${event}`));

      const onResponse = (res) => {
        cleanup();
        if (res?.error) reject(new Error(res.error));
        else resolve(res);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off(responseEvent, onResponse);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout: ${event}`));
      }, 15000);

      socket.once(responseEvent, onResponse);
      socket.emit(event, data);
    });
  }
}

export const webrtcService = new WebRTCService();
