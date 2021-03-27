interface IHEAP {
  buffer: ArrayBuffer;
  HEAP8: Int8Array;
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  HEAPU16: Uint16Array;
  HEAP32: Int32Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
}

export const HEAP = {} as IHEAP;

interface TempValue {
  tempDouble: any;
  tempI64: any;
}

export const tempValue = {} as TempValue;
