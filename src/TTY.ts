/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-empty-function */
// import * as nodeFS from "fs";

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
  allocate: (...args: any[]) => any;
  ioctl: any;
  llseek: any;
  mmap: any;
  msync: any;
}

interface DefaultTty1Ops {
  put_char: (tty: any, val: any) => void;
  flush: (tty: any) => void;
}

interface DefaultTtyOps extends DefaultTty1Ops {
  get_char: (tty: any) => any;
}

type Ops = StreamOps | DefaultTtyOps | DefaultTty1Ops;

export interface Tty {
  input: any[];
  output: any[];
  ops: Ops;
}

export class TTY {
  static ttys: Tty[] = [];

  static stream_ops = {
    open(stream: FSStream) {
      const tty = TTY.ttys[stream.node.rdev];
      if (!tty) {
        throw new FS.ErrnoError(43);
      }
      stream.tty = tty;
      stream.seekable = false;
    },
    close(stream: FSStream) {
      logger(stream);
      // @ts-ignore
      stream.tty.ops.flush(stream.tty);
    },
    flush(stream: FSStream) {
      logger(stream);
      // @ts-ignore
      stream.tty.ops.flush(stream.tty);
    },
    read(
      stream: FSStream,
      buffer: any,
      offset: number,
      length: number,
      _pos: number
    ) {
      // @ts-ignore
      if (!stream.tty || !stream.tty.ops.get_char) {
        throw new FS.ErrnoError(60);
      }
      let bytesRead = 0;
      for (let i = 0; i < length; i++) {
        let result;
        try {
          // @ts-ignore
          result = stream.tty.ops.get_char(stream.tty);
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
      return bytesRead;
    },
    write: function (
      stream: FSStream,
      buffer: any,
      offset: number,
      length: number,
      _pos?: number,
      _canOwn?: boolean
    ) {
      // @ts-ignore
      if (!stream.tty || !stream.tty.ops.put_char) {
        throw new FS.ErrnoError(60);
      }
      let i = 0;
      try {
        for (; i < length; i++) {
          // @ts-ignore
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
  static default_tty_ops = {
    get_char: function (tty: any) {
      if (!tty.input.length) {
        let result = null;
        // if (/*ENVIRONMENT_IS_NODE*/ true) {
        //   let BUFSIZE = 256;
        //   let buf = Buffer.alloc ? Buffer.alloc(BUFSIZE) : new Buffer(BUFSIZE);
        //   let bytesRead = 0;
        //   try {
        //     bytesRead = nodeFS.readSync(
        //       process.stdin.fd,
        //       buf,
        //       0,
        //       BUFSIZE,
        //       null
        //     );
        //   } catch (e) {
        //     if (e.toString().indexOf("EOF") != -1) bytesRead = 0;
        //     else throw e;
        //   }
        //   if (bytesRead > 0) {
        //     result = buf.slice(0, bytesRead).toString("utf-8");
        //   } else {
        //     result = null;
        //   }
        // } else if (
        //   typeof window != "undefined" &&
        //   typeof window.prompt == "function"
        // ) {
        //   result = window.prompt("Input: ");
        //   if (result !== null) {
        //     result += "\n";
        //   }
        // } else if (typeof readline == "function") {
        //   result = readline();
        //   if (result !== null) {
        //     result += "\n";
        //   }
        // }
        // if (!result) {
        //   return null;
        // }
        result = "123\n";
        tty.input = intArrayFromString(result, true);
      }
      return tty.input.shift();
    },
    put_char: function (tty: any, val: any) {
      if (val === null || val === 10) {
        IO.stdout(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    flush: function (tty: any) {
      if (tty.output && tty.output.length > 0) {
        IO.stdout(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      }
    },
  };
  static default_tty1_ops = {
    put_char: function (tty: any, val: any) {
      if (val === null || val === 10) {
        IO.stderr(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      } else {
        if (val != 0) tty.output.push(val);
      }
    },
    flush: function (tty: any) {
      if (tty.output && tty.output.length > 0) {
        IO.stderr(UTF8ArrayToString(tty.output, 0));
        tty.output = [];
      }
    },
  };

  static init() {}
  static shutdown() {}

  static register(dev: number, ops: Ops) {
    TTY.ttys[dev] = { input: [], output: [], ops: ops };
    FS.registerDevice(dev, TTY.stream_ops);
  }
}
