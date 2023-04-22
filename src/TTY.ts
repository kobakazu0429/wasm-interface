/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-empty-function */
// import * as nodeFS from "fs";

// import debounce from "lodash/debounce";

import { FS } from "./FS";
import { intArrayFromString, UTF8ArrayToString } from "./UTF8Decoder";
import type { FSStream } from "./FSStream";
import { IO } from "./IO";
import { logger } from "./utils";

export interface StreamOps {
  open: (stream: FSStream) => void;
  close: (stream: FSStream) => void;
  flush: (stream: FSStream) => void;
  read: (
    stream: FSStream,
    buffer: any,
    offset: number,
    length: number,
    _pos: number
  ) => number;
  write: (
    stream: FSStream,
    buffer: any,
    offset: number,
    length: number,
    _pos: number,
    _canOwn: boolean
  ) => number;
  allocate?: (...args: any[]) => any;
  ioctl: any;
  llseek: any;
  mmap: any;
  msync: any;
}

interface DefaultTty1Ops {
  put_char: (tty: Tty, val: number) => void;
  flush: (tty: Tty) => void;
}

interface DefaultTtyOps extends DefaultTty1Ops {
  get_char: (tty: Tty) => any;
}

type Ops = StreamOps | DefaultTtyOps | DefaultTty1Ops;

export interface Tty {
  input: number[];
  output: number[];
  ops: Ops;
}

function hasGetChar(ops: Ops): ops is DefaultTtyOps {
  return Object.prototype.hasOwnProperty.call(ops, "get_char");
}

function hasPutChar(ops: Ops): ops is DefaultTtyOps | DefaultTty1Ops {
  return Object.prototype.hasOwnProperty.call(ops, "put_char");
}

export class TTY {
  static ttys: Tty[] = [];

  static stream_ops = {
    open(stream) {
      const tty = TTY.ttys[stream.node.rdev];
      if (!tty) {
        throw new FS.ErrnoError(43);
      }
      stream.tty = tty;
      stream.seekable = false;
    },
    close(stream) {
      logger(stream);
      // @ts-ignore
      stream.tty.ops.flush(stream.tty);
    },
    flush(stream) {
      logger(stream);
      // @ts-expect-error
      stream.tty.ops.flush(stream.tty);
    },
    read: (stream, buffer, offset, length, _pos) => {
      if (!stream.tty || !hasGetChar(stream.tty.ops)) {
        throw new FS.ErrnoError(60);
      }
      let bytesRead = 0;

      function* makeRangeIterator(start = 0, end = 100, step = 1) {
        let iterationCount = 0;
        for (let i = start; i < end; i += step) {
          iterationCount++;
          yield i;
        }
        return iterationCount;
      }

      // for await (const i of makeRangeIterator(0, length)) {
      //   let result;
      //   try {
      //     result = await stream.tty.ops.get_char(stream.tty);
      //     console.log("1---", result);
      //   } catch (e) {
      //     throw new FS.ErrnoError(29);
      //   }
      //   if (result === undefined && bytesRead === 0) {
      //     throw new FS.ErrnoError(6);
      //   }
      //   if (result === null || result === undefined) break;
      //   bytesRead++;
      //   buffer[offset + i] = result;
      // }
      for (let i = 0; i < length; i++) {
        let result;
        try {
          result = stream.tty.ops.get_char(stream.tty);
          // console.log("1---", result);
        } catch (e) {
          throw new FS.ErrnoError(29);
        }
        if (result === undefined && bytesRead === 0) {
          throw new FS.ErrnoError(6);
        }
        if (result === null || result === undefined) break;
        bytesRead++;
        buffer[offset + i] = result;
      }
      if (bytesRead) {
        stream.node.timestamp = Date.now();
      }
      // console.log("2---");
      return bytesRead;
    },
    write: function (stream, buffer, offset, length, _pos, _canOwn) {
      if (!stream.tty || !hasPutChar(stream.tty.ops)) {
        throw new FS.ErrnoError(60);
      }
      let i = 0;
      try {
        for (; i < length; i++) {
          stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
        }
      } catch (e) {
        throw new FS.ErrnoError(29);
      }
      if (length) {
        stream.node.timestamp = Date.now();
      }
      return i;
    },
  } as StreamOps;

  static default_tty_ops: DefaultTtyOps = {
    get_char: function (tty) {
      // eslint-disable-next-line no-async-promise-executor
      // return new Promise(async (resolve) => {
      // console.log("called");
      // console.log("123------", IO.stdin);
      if (!tty.input.length) {
        let result = null;
        // console.log("123------", IO.stdin.read());
        // while (!IO.stdin.read().endsWith("\n"));
        // const intvl = setInterval(function () {
        //   // console.log(IO.stdin.read());
        //   const a = IO.stdin.read();
        //   if (a.endsWith("\n")) {
        //     clearInterval(intvl);
        //     result = a;
        //   }
        // }, 100);
        // await new Promise((r: (a: void) => void) =>
        //   setTimeout(() => {
        //     result = "123\n";
        //     r();
        //   }, 100)
        // );
        result = "123\n";
        tty.input = intArrayFromString(result, true);
      }
      //   resolve(tty.input.shift());
      // });
      tty.input.shift();
    },
    put_char: function (tty, val) {
      if (val === null || val === 10) {
        IO.stdout(UTF8ArrayToString(new Uint8Array(tty.output), 0));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    flush: function (tty) {
      if (tty.output && tty.output.length > 0) {
        IO.stdout(UTF8ArrayToString(new Uint8Array(tty.output), 0));
        tty.output = [];
      }
    },
  };

  static default_tty1_ops: DefaultTty1Ops = {
    put_char: function (tty, val: any) {
      if (val === null || val === 10) {
        IO.stderr(UTF8ArrayToString(new Uint8Array(tty.output), 0));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    flush: function (tty) {
      if (tty.output && tty.output.length > 0) {
        IO.stderr(UTF8ArrayToString(new Uint8Array(tty.output), 0));
        tty.output = [];
      }
    },
  };

  static init() {}
  static shutdown() {}

  static register(dev: number, ops: Ops) {
    TTY.ttys[dev] = {
      input: [],
      output: [],
      ops: ops,
    };
    FS.registerDevice(dev, TTY.stream_ops);
  }
}
