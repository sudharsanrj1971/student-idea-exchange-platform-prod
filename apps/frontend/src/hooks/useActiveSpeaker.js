import { useState, useEffect } from 'react';

// Create a single shared AudioContext to save resources
let sharedAudioContext = null;
function getAudioContext() {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume();
  }
  return sharedAudioContext;
}

export function useActiveSpeaker(stream, threshold = 0.03) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setIsSpeaking(false);
      return;
    }

    const audioCtx = getAudioContext();
    let source;
    let analyser;
    let animationFrame;

    try {
      // Must use MediaStreamAudioSourceNode for live streams
      source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speakingFrames = 0;
      let silentFrames = 0;

      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        
        // Calculate average volume (0.0 to 1.0)
        const average = (sum / bufferLength) / 255;

        // Debounce logic to prevent flickering
        if (average > threshold) {
          speakingFrames++;
          silentFrames = 0;
          if (speakingFrames > 2) setIsSpeaking(true);
        } else {
          silentFrames++;
          speakingFrames = 0;
          if (silentFrames > 8) setIsSpeaking(false);
        }

        animationFrame = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (err) {
      console.warn('[ActiveSpeaker] Failed to monitor stream:', err.message);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      if (source) source.disconnect();
      if (analyser) analyser.disconnect();
      setIsSpeaking(false);
    };
  }, [stream, threshold]);

  return isSpeaking;
}
