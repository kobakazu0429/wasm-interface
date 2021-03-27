import { HEAP } from "./Global";

const UTF8Decoder = new TextDecoder("utf8");

export function UTF8ToString(ptr: number, maxBytesToRead?: number) {
  return ptr ? UTF8ArrayToString(HEAP.HEAPU8, ptr, maxBytesToRead) : "";
}

export function UTF8ArrayToString(
  heap: Uint8Array,
  idx: number,
  maxBytesToRead?: any
) {
  const endIdx = idx + maxBytesToRead;
  let endPtr = idx;
  while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(heap.subarray(idx, endPtr));
  } else {
    let str = "";
    while (idx < endPtr) {
      let u0 = heap[idx++];
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue;
      }
      const u1 = heap[idx++] & 63;
      if ((u0 & 224) == 192) {
        str += String.fromCharCode(((u0 & 31) << 6) | u1);
        continue;
      }
      const u2 = heap[idx++] & 63;
      if ((u0 & 240) == 224) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heap[idx++] & 63);
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0);
      } else {
        const ch = u0 - 65536;
        str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
      }
    }
    return str;
  }
}

export function stringToUTF8Array(
  str: string,
  heap: any,
  outIdx: number,
  maxBytesToWrite?: any
) {
  if (!(maxBytesToWrite > 0)) return 0;
  const startIdx = outIdx;
  const endIdx = outIdx + maxBytesToWrite - 1;
  for (let i = 0; i < str.length; ++i) {
    let u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343) {
      const u1 = str.charCodeAt(++i);
      u = (65536 + ((u & 1023) << 10)) | (u1 & 1023);
    }
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      heap[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      heap[outIdx++] = 192 | (u >> 6);
      heap[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      heap[outIdx++] = 224 | (u >> 12);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 3 >= endIdx) break;
      heap[outIdx++] = 240 | (u >> 18);
      heap[outIdx++] = 128 | ((u >> 12) & 63);
      heap[outIdx++] = 128 | ((u >> 6) & 63);
      heap[outIdx++] = 128 | (u & 63);
    }
  }
  heap[outIdx] = 0;
  return outIdx - startIdx;
}

export function stringToUTF8(
  str: string,
  outPtr: number,
  maxBytesToWrite?: any
) {
  return stringToUTF8Array(str, HEAP.HEAPU8, outPtr, maxBytesToWrite);
}

export function lengthBytesUTF8(str: string) {
  let len = 0;
  for (let i = 0; i < str.length; ++i) {
    let u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343)
      u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
    if (u <= 127) ++len;
    else if (u <= 2047) len += 2;
    else if (u <= 65535) len += 3;
    else len += 4;
  }
  return len;
}

export function intArrayFromString(
  stringy: string,
  dontAddNull: boolean,
  length?: number
) {
  const len = length && length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  const u8array = new Array(len);
  const numBytesWritten = stringToUTF8Array(
    stringy,
    u8array,
    0,
    u8array.length
  );
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
