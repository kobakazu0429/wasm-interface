import { HEAP, tempValue } from "./Global";
import { UTF8ToString, lengthBytesUTF8, stringToUTF8 } from "./UTF8Decoder";
import { FS } from "./FS";
import { PATH } from "./PATH";
import { logger } from "./utils";

export class SYSCALLS {
  // static mappings = {};
  // static DEFAULT_POLLMASK = 5;
  // static umask = 511;
  static varargs: any = undefined;

  static calculateAt(dirfd: number, path: string, allowEmpty: boolean) {
    if (path[0] === "/") {
      return path;
    }
    let dir;
    if (dirfd === -100) {
      dir = FS.cwd();
    } else {
      const dirstream = FS.getStream(dirfd);
      if (!dirstream) throw new FS.ErrnoError(8);
      dir = dirstream.path;
    }
    if (path.length == 0) {
      if (!allowEmpty) {
        throw new FS.ErrnoError(44);
      }
      return dir;
    }
    return PATH.join2(dir, path);
  }

  static doStat(func: any, path: string, buf: any) {
    let stat;
    try {
      stat = func(path);
    } catch (e) {
      if (
        e &&
        e.node &&
        PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))
      ) {
        return -54;
      }
      throw e;
    }
    HEAP.HEAP32[buf >> 2] = stat.dev;
    HEAP.HEAP32[(buf + 4) >> 2] = 0;
    HEAP.HEAP32[(buf + 8) >> 2] = stat.ino;
    HEAP.HEAP32[(buf + 12) >> 2] = stat.mode;
    HEAP.HEAP32[(buf + 16) >> 2] = stat.nlink;
    HEAP.HEAP32[(buf + 20) >> 2] = stat.uid;
    HEAP.HEAP32[(buf + 24) >> 2] = stat.gid;
    HEAP.HEAP32[(buf + 28) >> 2] = stat.rdev;
    HEAP.HEAP32[(buf + 32) >> 2] = 0;
    (tempValue.tempI64 = [
      stat.size >>> 0,
      ((tempValue.tempDouble = stat.size),
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
      (HEAP.HEAP32[(buf + 40) >> 2] = tempValue.tempI64[0]),
      (HEAP.HEAP32[(buf + 44) >> 2] = tempValue.tempI64[1]);
    HEAP.HEAP32[(buf + 48) >> 2] = 4096;
    HEAP.HEAP32[(buf + 52) >> 2] = stat.blocks;
    HEAP.HEAP32[(buf + 56) >> 2] = (stat.atime.getTime() / 1e3) | 0;
    HEAP.HEAP32[(buf + 60) >> 2] = 0;
    HEAP.HEAP32[(buf + 64) >> 2] = (stat.mtime.getTime() / 1e3) | 0;
    HEAP.HEAP32[(buf + 68) >> 2] = 0;
    HEAP.HEAP32[(buf + 72) >> 2] = (stat.ctime.getTime() / 1e3) | 0;
    HEAP.HEAP32[(buf + 76) >> 2] = 0;
    (tempValue.tempI64 = [
      stat.ino >>> 0,
      ((tempValue.tempDouble = stat.ino),
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
      (HEAP.HEAP32[(buf + 80) >> 2] = tempValue.tempI64[0]),
      (HEAP.HEAP32[(buf + 84) >> 2] = tempValue.tempI64[1]);
    return 0;
  }

  static doMsync(addr: any, stream: any, len: any, flags: any, offset: any) {
    const buffer = HEAP.HEAPU8.slice(addr, addr + len);
    FS.msync(stream, buffer, offset, len, flags);
  }

  static doMkdir(path: any, mode: any) {
    path = PATH.normalize(path);
    if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
    FS.mkdir(path, mode);
    return 0;
  }

  static doMknod(path: any, mode: any, dev: any) {
    switch (mode & 61440) {
      case 32768:
      case 8192:
      case 24576:
      case 4096:
      case 49152:
        break;
      default:
        return -28;
    }
    FS.mknod(path, mode, dev);
    return 0;
  }

  static doReadlink(path: string, buf: any, bufsize: number) {
    if (bufsize <= 0) return -28;
    const ret = FS.readlink(path);
    const len = Math.min(bufsize, lengthBytesUTF8(ret));
    const endChar = HEAP.HEAP8[buf + len];
    stringToUTF8(ret, buf, bufsize + 1);
    HEAP.HEAP8[buf + len] = endChar;
    return len;
  }

  static doAccess(path: string, amode: number) {
    if (amode & ~7) {
      return -28;
    }
    const lookup = FS.lookupPath(path, { follow: true });
    const node = lookup.node;
    if (!node) {
      return -44;
    }
    let perms = "";
    if (amode & 4) perms += "r";
    if (amode & 2) perms += "w";
    if (amode & 1) perms += "x";
    if (perms && FS.nodePermissions(node, perms)) {
      return -2;
    }
    return 0;
  }

  static doDup(path: string, flags: any, suggestFD: number) {
    const suggest = FS.getStream(suggestFD);
    if (suggest) FS.close(suggest);
    return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
  }

  static doReadv(stream: any, iov: number, iovcnt: number, offset?: number) {
    let ret = 0;
    for (let i = 0; i < iovcnt; i++) {
      const ptr = HEAP.HEAP32[(iov + i * 8) >> 2];
      const len = HEAP.HEAP32[(iov + (i * 8 + 4)) >> 2];
      const curr = FS.read(stream, HEAP.HEAP8, ptr, len, offset);
      if (curr < 0) return -1;
      ret += curr;
      if (curr < len) break;
    }
    return ret;
  }

  static doWritev(stream: any, iov: number, iovcnt: number, offset?: number) {
    let ret = 0;
    for (let i = 0; i < iovcnt; i++) {
      const ptr = HEAP.HEAP32[(iov + i * 8) >> 2];
      const len = HEAP.HEAP32[(iov + (i * 8 + 4)) >> 2];
      const curr = FS.write(stream, HEAP.HEAP8, ptr, len, offset);
      if (curr < 0) return -1;
      ret += curr;
    }
    return ret;
  }

  static get() {
    logger("SYSCALLS.varargs", SYSCALLS.varargs);
    SYSCALLS.varargs += 4;
    logger("SYSCALLS.varargs", SYSCALLS.varargs);
    const ret = HEAP.HEAP32[(SYSCALLS.varargs - 4) >> 2];
    return ret;
  }

  static getStr(ptr: number) {
    const ret = UTF8ToString(ptr);
    return ret;
  }

  static getStreamFromFD(fd: number) {
    const stream = FS.getStream(fd);
    if (!stream) throw new FS.ErrnoError(8);
    return stream;
  }

  static get64(low: number, _high: number) {
    return low;
  }
}
