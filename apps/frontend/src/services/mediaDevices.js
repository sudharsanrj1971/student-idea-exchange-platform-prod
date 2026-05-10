/**
 * Returns the deviceId of the best physical camera available.
 * Filters out virtual/phone cameras (Windows Phone Link, Android virtual cameras, etc.)
 * Falls back to undefined (browser default) if no physical camera is found.
 */
export async function getPreferredCameraId() {
  try {
    // Need at least one getUserMedia call first to get real labels
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    tempStream.getTracks().forEach(t => t.stop());
  } catch {
    // Permissions not yet granted — continue without labels (browser will prompt)
    return undefined;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');

    if (videoDevices.length === 0) return undefined;
    if (videoDevices.length === 1) return videoDevices[0].deviceId;

    // Keywords that identify virtual/phone cameras — skip these
    const virtualPatterns = [
      'virtual', 'phone', 'mobile', 'android', 'iphone', 'link',
      'continuity', 'droidcam', 'epoccam', 'iriun', 'mmhmm',
      // Common phone brands used as virtual cameras
      'infinix', 'samsung', 'xiaomi', 'realme', 'oneplus', 'oppo',
      'vivo', 'huawei', 'motorola', 'nokia', 'redmi',
    ];

    // Keywords that identify real physical cameras — prefer these
    const physicalPatterns = [
      'usb', 'integrated', 'built-in', 'builtin', 'webcam',
      'hd', 'facecam', 'logitech', 'chicony', 'bison', 'syntek',
      'realtek', 'intel', 'suyin', 'azurewave', 'ov',
    ];

    const score = (label) => {
      const l = label.toLowerCase();
      let s = 0;
      if (virtualPatterns.some(p => l.includes(p))) s -= 100;
      if (physicalPatterns.some(p => l.includes(p))) s += 10;
      return s;
    };

    // Sort by score descending — highest score = most physical camera
    const sorted = [...videoDevices].sort((a, b) => score(b.label) - score(a.label));
    const best = sorted[0];

    // If the best camera is still virtual (score < 0), just use browser default
    if (score(best.label) < 0) {
      console.warn('[Camera] All cameras appear to be virtual. Using browser default.');
      return undefined;
    }

    console.info(`[Camera] Selected: "${best.label}"`);
    return best.deviceId;
  } catch (err) {
    console.warn('[Camera] Could not enumerate devices:', err.message);
    return undefined;
  }
}

/**
 * Returns the deviceId of the best physical microphone.
 */
export async function getPreferredAudioId() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(d => d.kind === 'audioinput');
    
    if (audioDevices.length === 0) return undefined;
    
    // Look for keywords like "USB", "External", "Logitech", "High Definition"
    const priorityKeywords = ['usb', 'external', 'logitech', 'steelseries', 'razer', 'yeti', 'hyperx'];
    const best = audioDevices.sort((a, b) => {
      const aLabel = a.label.toLowerCase();
      const bLabel = b.label.toLowerCase();
      const aPriority = priorityKeywords.some(k => aLabel.includes(k)) ? 1 : 0;
      const bPriority = priorityKeywords.some(k => bLabel.includes(k)) ? 1 : 0;
      return bPriority - aPriority;
    })[0];

    return best.deviceId;
  } catch (err) {
    return undefined;
  }
}

/**
 * Returns the deviceId of the preferred speaker output.
 */
export async function getPreferredSpeakerId() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const speakerDevices = devices.filter(d => d.kind === 'audiooutput');
    
    if (speakerDevices.length === 0) return undefined;
    
    // Prefer external speakers/headphones over internal
    const best = speakerDevices.sort((a, b) => {
      const aLabel = a.label.toLowerCase();
      const bLabel = b.label.toLowerCase();
      const aIsExt = aLabel.includes('usb') || aLabel.includes('headphones') || aLabel.includes('external');
      const bIsExt = bLabel.includes('usb') || bLabel.includes('headphones') || bLabel.includes('external');
      return (bIsExt ? 1 : 0) - (aIsExt ? 1 : 0);
    })[0];

    return best.deviceId;
  } catch (err) {
    return undefined;
  }
}

/**
 * Returns getUserMedia constraints using the preferred physical camera.
 * Pass selectedVideoId / selectedAudioId for user-chosen devices (from Settings).
 */
export async function buildMediaConstraints(selectedVideoId, selectedAudioId) {
  const videoId = selectedVideoId || await getPreferredCameraId();

  return {
    video: videoId
      ? { deviceId: { exact: videoId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: selectedAudioId
      ? { deviceId: { exact: selectedAudioId }, echoCancellation: true, noiseSuppression: true }
      : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  };
}
