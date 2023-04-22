/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

import { FS } from "./FS";
import { HEAP, tempValue } from "./Global";
import { SYSCALLS } from "./sys_calls";
import { intArrayFromString } from "./UTF8Decoder";
import { abort } from "./utils";

export function _fd_write(
  fd: number,
  iov: number,
  iovcnt: number,
  pnum: number
) {
  try {
    const stream = SYSCALLS.getStreamFromFD(fd);
    const num = SYSCALLS.doWritev(stream, iov, iovcnt);
    HEAP.HEAP32[pnum >> 2] = num;
    return 0;
  } catch (e) {
    if (!(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
}

export function _fd_close(fd: number) {
  try {
    const stream = SYSCALLS.getStreamFromFD(fd);
    FS.close(stream);
    return 0;
  } catch (e) {
    if (!(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
}

async function _forEachIoVec(
  iovsPtr: number,
  iovsLen: number,
  handledPtr: number,
  memory: WebAssembly.Memory,
  cb: (buf: Uint8Array) => Promise<number>
) {
  let totalHandled = 0;
  for (let i = 0; i < iovsLen; i++) {
    const iovec = iovec_t.get(memory.buffer, iovsPtr);
    const buf = new Uint8Array(memory.buffer, iovec.bufPtr, iovec.bufLen);
    const handled = await cb(buf);
    totalHandled += handled;
    if (handled < iovec.bufLen) {
      break;
    }
    iovsPtr = (iovsPtr + iovec_t.size) as ptr<iovec_t>;
  }
  size_t.set(memory.buffer, handledPtr, totalHandled);
}

export async function _fd_read(
  fd: number,
  iov: number,
  iovcnt: number,
  pnum: number,
  memory: WebAssembly.Memory
) {
  // try {
  const input = intArrayFromString("429\n");
  await _forEachIoVec(iov, iovcnt, pnum, memory, async (buf) => {
    const chunk = await input.read(buf.length);
    buf.set(chunk);
    return chunk.length;
  });

  //   const stream = SYSCALLS.getStreamFromFD(fd);
  //   const num = SYSCALLS.doReadv(stream, iov, iovcnt);
  //   HEAP.HEAP32[pnum >> 2] = num;
  //   return 0;
  // } catch (e) {
  //   if (!(e instanceof FS.ErrnoError)) abort(e);
  //   return e.errno;
  // }
}

export function _fd_seek(
  fd: number,
  offset_low: number,
  offset_high: number,
  whence: number,
  newOffset: number
) {
  try {
    const stream = SYSCALLS.getStreamFromFD(fd);
    const HIGH_OFFSET = 4294967296;
    const offset = offset_high * HIGH_OFFSET + (offset_low >>> 0);
    const DOUBLE_LIMIT = 9007199254740992;
    if (offset <= -DOUBLE_LIMIT || offset >= DOUBLE_LIMIT) {
      return -61;
    }
    FS.llseek(stream, offset, whence);
    (tempValue.tempI64 = [
      stream.position >>> 0,
      ((tempValue.tempDouble = stream.position),
      +Math.abs(tempValue.tempDouble) >= 1
        ? tempValue.tempDouble > 0
          ? (Math.min(
              +Math.floor(tempValue.tempDouble / 4294967296),
              4294967295
            ) |
              0) >>>
            0
          : ~~+Math.ceil(
              (tempValue.tempDouble - +(~~tempValue.tempDouble >>> 0)) /
                4294967296
            ) >>> 0
        : 0),
    ]),
      (HEAP.HEAP32[newOffset >> 2] = tempValue.tempI64[0]),
      (HEAP.HEAP32[(newOffset + 4) >> 2] = tempValue.tempI64[1]);
    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
    return 0;
  } catch (e) {
    if (!(e instanceof FS.ErrnoError)) abort(e);
    return e.errno;
  }
}
