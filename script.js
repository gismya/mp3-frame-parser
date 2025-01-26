// MP3 Parsing definitions from http://www.mp3-tech.org/programmer/frame_header.html
// Formatted the byte lookup keys as binary numbers for easier manual comparison

// Move lookup tables outside function for better performance and readability

const RESERVED = "Reserved";
const MPEG_V1 = "MPEG Version 1";
const MPEG_V2 = "MPEG Version 2";
const MPEG_V2_5 = "MPEG Version 2.5";

const LAYER_I = "Layer I";
const LAYER_II = "Layer II";
const LAYER_III = "Layer III";

const VERSIONS = {
  0b00: MPEG_V2_5,
  0b01: RESERVED,
  0b10: MPEG_V2,
  0b11: MPEG_V1,
};

const LAYERS = {
  0b00: RESERVED,
  0b01: LAYER_III,
  0b10: LAYER_II,
  0b11: LAYER_I,
};

const CHANNEL_MODE_STEREO = "Stereo";
const CHANNEL_MODE_JOINT_STEREO = "Joint stereo (Stereo)";
const CHANNEL_MODE_DUAL_CHANNEL = "Dual channel (Two mono)";
const CHANNEL_MODE_SINGLE_CHANNEL = "Single channel (Mono)";

const CHANNEL_MODES = {
  0b00: CHANNEL_MODE_STEREO,
  0b01: CHANNEL_MODE_JOINT_STEREO,
  0b10: CHANNEL_MODE_DUAL_CHANNEL,
  0b11: CHANNEL_MODE_SINGLE_CHANNEL,
};

// Add bitrate tables for different versions and layers
const BITRATES = {
  // MPEG 1
  "V1,L1": {
    0b0000: "Free",
    0b0001: 32,
    0b0010: 64,
    0b0011: 96,
    0b0100: 128,
    0b0101: 160,
    0b0110: 192,
    0b0111: 224,
    0b1000: 256,
    0b1001: 288,
    0b1010: 320,
    0b1011: 352,
    0b1100: 384,
    0b1101: 416,
    0b1110: 448,
    0b1111: "Bad",
  },
  "V1,L2": {
    0b0000: "Free",
    0b0001: 32,
    0b0010: 48,
    0b0011: 56,
    0b0100: 64,
    0b0101: 80,
    0b0110: 96,
    0b0111: 112,
    0b1000: 128,
    0b1001: 160,
    0b1010: 192,
    0b1011: 224,
    0b1100: 256,
    0b1101: 320,
    0b1110: 384,
    0b1111: "Bad",
  },
  "V1,L3": {
    0b0000: "Free",
    0b0001: 32,
    0b0010: 40,
    0b0011: 48,
    0b0100: 56,
    0b0101: 64,
    0b0110: 80,
    0b0111: 96,
    0b1000: 112,
    0b1001: 128,
    0b1010: 160,
    0b1011: 192,
    0b1100: 224,
    0b1101: 256,
    0b1110: 320,
    0b1111: "Bad",
  },
  // MPEG 2 & 2.5
  "V2,L1": {
    0b0000: "Free",
    0b0001: 32,
    0b0010: 48,
    0b0011: 56,
    0b0100: 64,
    0b0101: 80,
    0b0110: 96,
    0b0111: 112,
    0b1000: 128,
    0b1001: 144,
    0b1010: 160,
    0b1011: 176,
    0b1100: 192,
    0b1101: 224,
    0b1110: 256,
    0b1111: "Bad",
  },
  "V2,L2L3": {
    0b0000: "Free",
    0b0001: 8,
    0b0010: 16,
    0b0011: 24,
    0b0100: 32,
    0b0101: 40,
    0b0110: 48,
    0b0111: 56,
    0b1000: 64,
    0b1001: 80,
    0b1010: 96,
    0b1011: 112,
    0b1100: 128,
    0b1101: 144,
    0b1110: 160,
    0b1111: "Bad",
  },
};

// Add Layer II allowed bitrate combinations
const LAYER2_ALLOWED_BITRATES = {
  stereo: new Set([64, 96, 112, 128, 160, 192, 224, 256, 320, 384]),
  intensity_stereo: new Set([64, 96, 112, 128, 160, 192, 224, 256, 320, 384]),
  dual_channel: new Set([64, 96, 112, 128, 160, 192, 224, 256, 320, 384]),
  single_channel: new Set([32, 48, 56, 64, 80, 96, 112, 128, 160, 192]),
};

// Add missing lookup tables
const MODE_EXTENSIONS_LAYER_3 = {
  0b00: { intensity: false, ms: false },
  0b01: { intensity: false, ms: true },
  0b10: { intensity: true, ms: false },
  0b11: { intensity: true, ms: true },
};

const MODE_EXTENSIONS_LAYER_12 = {
  0b00: "Bands 4 to 31",
  0b01: "Bands 8 to 31",
  0b10: "Bands 12 to 31",
  0b11: "Bands 16 to 31",
};

function parseMP3Header() {
  const input = document.getElementById("headerInput").value.trim();
  const output = document.getElementById("output");
  const hexBytes = validateAndParseBytes(input, output);
  if (!hexBytes) return;

  const [byte1, byte2, byte3, byte4] = hexBytes;

  // Validate basic header fields
  const headerInfo = validateBasicHeader(byte1, byte2, output);
  if (!headerInfo) return;
  const { version, layer } = headerInfo;

  // Protection bit (1 bit)
  const protection = (byte2 & 0b1) === 0 ? "Protected by CRC" : "No CRC";

  // Get bitrate information
  const { bitrateKey, isL2 } = getBitrateInfo(version, layer);
  const bitrateIndex = (byte3 >> 4) & 0b1111;
  const bitrate = BITRATES[bitrateKey][bitrateIndex];

  // Validate bitrate
  if (!bitrate || bitrate === "Bad") {
    output.textContent = "Invalid bitrate index. Not a valid MP3 frame header.";
    return;
  }

  // Sampling rate (2 bits)
  const sampleRateIndex = (byte3 >> 2) & 0b11;
  const sampleRates =
    {
      [MPEG_V1]: [44100, 48000, 32000],
      [MPEG_V2]: [22050, 24000, 16000],
      [MPEG_V2_5]: [11025, 12000, 8000],
    }[version] || [];
  const sampleRate = sampleRates[sampleRateIndex] || RESERVED;
  if (sampleRate === RESERVED) {
    output.textContent =
      "Invalid sample rate index. Not a valid MP3 frame header.";
    return;
  }

  // Padding bit (1 bit)
  const padding = (byte3 >> 1) & 0b1 ? "Padded" : "Not padded";

  // Private bit (1 bit)
  const privateBit = byte3 & 0b1 ? "Private bit set" : "Private bit not set";

  // Channel mode (2 bits)
  const channelModeID = (byte4 >> 6) & 0b11;
  const channelMode = CHANNEL_MODES[channelModeID];

  // Mode extension (2 bits, for joint stereo only)
  const modeExtension = (byte4 >> 4) & 0b11;
  const modeExtensionText = getModeExtensionText(
    channelMode,
    layer,
    modeExtension
  );

  // Validate Layer II bitrate combinations
  if (isL2 && !validateLayer2Bitrate(channelMode, bitrate, output)) return;

  // Copyright information
  const copyright =
    (byte4 >> 3) & 0b1 ? "Copyright bit set" : "Copyright bit not set";
  const original =
    (byte4 >> 2) & 0b1 ? "Original media" : "Copy of original media";

  const emphasisByte = byte4 & 0b11;
  const emphasisValues = {
    0b00: "No emphasis",
    0b01: "50/15 ms",
    0b10: RESERVED,
    0b11: "CCIT J.17",
  };
  const emphasis = emphasisValues[emphasisByte] || "Unknown emphasis";

  // Create output
  output.textContent = `
Sync Word: (Valid)
MPEG Audio Version: ${version}
Layer: ${layer}
Protection: ${protection}
Bitrate: ${bitrate} kbps
Sampling Rate: ${sampleRate} Hz
Padding: ${padding}
Private Bit: ${privateBit}
Channel Mode: ${channelMode}
Mode Extension: ${modeExtensionText}
Copyright: ${copyright}
Original: ${original}
Emphasis: ${emphasis}
        `;
}

function validateBasicHeader(byte1, byte2, output) {
  // Sync word (11 bits), all 1s
  const syncWord = (byte1 << 3) | (byte2 >> 5);
  if (syncWord !== 0b011111111111) {
    output.textContent = "Invalid sync word. Not a valid MP3 frame header.";
    return false;
  }

  // MPEG Audio version ID (2 bits)
  const versionID = (byte2 >> 3) & 0b11;
  const version = VERSIONS[versionID];
  if (version === RESERVED) {
    output.textContent = "Invalid version ID. Not a valid MP3 frame header.";
    return false;
  }

  // Layer description (2 bits)
  const layerID = (byte2 >> 1) & 0b11;
  const layer = LAYERS[layerID];
  if (layer === RESERVED) {
    output.textContent = "Invalid layer ID. Not a valid MP3 frame header.";
    return false;
  }

  return { versionID, version, layerID, layer };
}

function getBitrateInfo(version, layer) {
  const isL1 = layer === LAYER_I;
  const isL2 = layer === LAYER_II;

  let bitrateKey;
  if (version === MPEG_V1) {
    if (isL1) bitrateKey = "V1,L1";
    else if (isL2) bitrateKey = "V1,L2";
    else bitrateKey = "V1,L3";
  } else {
    // V2 or V2.5
    if (isL1) bitrateKey = "V2,L1";
    else bitrateKey = "V2,L2L3";
  }

  return { bitrateKey, isL1, isL2 };
}

function getModeExtensionText(channelMode, layer, modeExtension) {
  if (channelMode !== CHANNEL_MODE_JOINT_STEREO) return "N/A";

  if (layer === LAYER_III) {
    const stereoModes = MODE_EXTENSIONS_LAYER_3[modeExtension];
    const modes = [];
    if (stereoModes.intensity) modes.push("Intensity stereo");
    if (stereoModes.ms) modes.push("MS stereo");
    return modes.length ? modes.join(" and ") : "No joint stereo coding";
  }

  if (layer === LAYER_I || layer === LAYER_II) {
    return `Intensity stereo: ${MODE_EXTENSIONS_LAYER_12[modeExtension]}`;
  }

  return "N/A";
}

function validateLayer2Bitrate(channelMode, bitrate, output) {
  const isStereo = channelMode === CHANNEL_MODE_STEREO;
  const isIntensityStereo = channelMode === CHANNEL_MODE_JOINT_STEREO;
  const isDualChannel = channelMode === CHANNEL_MODE_DUAL_CHANNEL;
  const isSingleChannel = channelMode === CHANNEL_MODE_SINGLE_CHANNEL;

  let allowed = false;
  if (bitrate === "Free") {
    allowed = true;
  } else if (isSingleChannel) {
    allowed = LAYER2_ALLOWED_BITRATES.single_channel.has(bitrate);
  } else if (isStereo || isIntensityStereo || isDualChannel) {
    allowed = LAYER2_ALLOWED_BITRATES.stereo.has(bitrate);
  }

  if (!allowed) {
    output.textContent =
      "Invalid bitrate and channel mode combination for Layer II.";
    return false;
  }

  return true;
}

function validateAndParseBytes(input, output) {
  // Remove all spaces and split into 4 bytes, every 2 characters
  const hexBytes = input
    .replace(/\s+/g, "")
    .match(/.{1,2}/g)
    .map((byte) => Number.parseInt(byte, 16));

  if (hexBytes.length !== 4 || hexBytes.some(Number.isNaN)) {
    output.textContent = "Please enter exactly 4 valid hexadecimal bytes.";
    return null;
  }

  return hexBytes;
}
