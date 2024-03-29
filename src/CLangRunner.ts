/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// import * as path from "path";
// import * as fs from "fs";

import { HEAP } from "./Global";
import { SYSTEM_STATUS } from "./system_status";
import { _fd_close, _fd_read, _fd_seek, _fd_write } from "./fd";
import { IO } from "./IO";
import { FS } from "./FS";
import { TTY } from "./TTY";
import { abort, logger } from "./utils";
import { ExitStatus } from "./ExitStatus";
import { stringToUTF8, UTF8ToString } from "./UTF8Decoder";

// const _scriptDir = import.meta.url;
// const _scriptDir = "file:///Users/kazu/workspace2/foo/src/mjs.mjs";
// const __dirname = path.dirname(new URL(_scriptDir).pathname);
// const scriptDirectory = __dirname + "/";

// function locateFile(_path: string) {
//   return scriptDirectory + _path;
// }

export type ArgType = "string" | "boolean" | "number";

export let readyPromiseResolve: (value: unknown) => void;
export let readyPromiseReject: (reason?: any) => void;
new Promise(function (resolve, reject) {
  readyPromiseResolve = resolve;
  readyPromiseReject = reject;
});

export function shell_read(filename: string, binary?: boolean) {
  IO.debug(filename, binary);
  // filename = path.normalize(filename);
  // return fs.readFileSync(filename, binary ? null : "utf8");
}

// function readBinary(filename: string) {
//   let ret = shell_read(filename, true) as any;
//   if (!ret.buffer) {
//     ret = new Uint8Array(ret);
//   }
//   assert(ret.buffer);
//   return ret;
// }

// function assert(condition: unknown, text?: string) {
//   if (!condition) {
//     abort("Assertion failed: " + text);
//   }
// }

// declare const process: any;

// if (process && process.on) {
//   process.on("unhandledRejection", abort);
//   process.on("uncaughtException", function (ex: any) {
//     if (!(ex instanceof ExitStatus)) {
//       throw ex;
//     }
//   });
// }

const quit_ = function (status: number, reason: any) {
  IO.stderr(reason);
  // if (process.exit) process.exit(status);
};

function getBinaryPromise(wasmBinary: Uint8Array) {
  // const wasmBinaryFileName = "tmp.wasm";
  // const wasmBinaryFile = locateFile(wasmBinaryFileName);

  return Promise.resolve().then(function () {
    // return readBinary(wasmBinaryFile);
    return wasmBinary;
  });
}

type IModule = Record<"asm" | "_main" | string, any>;

export class CLangRunner {
  private noExitRuntime = true;
  private wasmMemory?: WebAssembly.Memory;
  private wasmTable?: WebAssembly.Table;
  private __ATINIT__: any[] = [];
  private ___wasm_call_ctors: any;

  private runDependencies = 0;
  private dependenciesFulfilled: any = null;
  private calledRun = false;

  private Module: IModule = {} as IModule;

  private addRunDependency() {
    this.runDependencies++;
  }

  private removeRunDependency() {
    this.runDependencies--;
    if (this.runDependencies === 0) {
      if (this.dependenciesFulfilled) {
        const callback = this.dependenciesFulfilled;
        this.dependenciesFulfilled = null;
        callback();
      }
    }
  }

  private updateGlobalBufferAndViews(
    store: Record<any, any>,
    buf: ArrayBuffer
  ) {
    HEAP.buffer = buf;
    store["HEAP8"] = HEAP.HEAP8 = new Int8Array(buf);
    store["HEAPU8"] = HEAP.HEAPU8 = new Uint8Array(buf);
    store["HEAP16"] = HEAP.HEAP16 = new Int16Array(buf);
    store["HEAPU16"] = HEAP.HEAPU16 = new Uint16Array(buf);
    store["HEAP32"] = HEAP.HEAP32 = new Int32Array(buf);
    store["HEAPU32"] = HEAP.HEAPU32 = new Uint32Array(buf);
    store["HEAPF32"] = HEAP.HEAPF32 = new Float32Array(buf);
    store["HEAPF64"] = HEAP.HEAPF64 = new Float64Array(buf);
  }

  private initRuntime() {
    if (!FS.initialized) {
      FS.Module = this.Module;
      FS.init();
    }
    TTY.init();
    this.callRuntimeCallbacks(this.__ATINIT__);
    logger("initRuntime finished");
  }

  private exit(status: number, implicit: any) {
    if (implicit && this.noExitRuntime && status === 0) {
      return;
    }
    if (!this.noExitRuntime) {
      SYSTEM_STATUS.EXITSTATUS = status;
      SYSTEM_STATUS.ABORT = true;
    }
    quit_(status, new ExitStatus(status));
  }

  private callRuntimeCallbacks(callbacks: any[]) {
    while (callbacks.length > 0) {
      const callback = callbacks.shift();
      if (typeof callback == "function") {
        callback(this.Module);
        continue;
      }
      const func = callback.func;
      if (typeof func === "number") {
        if (callback.arg === undefined) {
          this.wasmTable!.get(func)!();
        } else {
          this.wasmTable!.get(func)!(callback.arg);
        }
      } else {
        func(callback.arg === undefined ? null : callback.arg);
      }
    }
  }

  private abortOnCannotGrowMemory(_requestedSize: any) {
    abort("OOM");
  }

  private _emscripten_resize_heap(requestedSize: any) {
    this.abortOnCannotGrowMemory(requestedSize);
  }

  private _emscripten_memcpy_big(dest: number, src: number, num: number) {
    HEAP.HEAPU8.copyWithin(dest, src, src + num);
  }

  private tmp_run() {
    FS.staticInit();
  }

  public async createWasm(
    wasmBinary: Uint8Array,
    asmLibraryArgKeys: Array<Record<string, string>>,
    wasmRuntime: Record<"wasmMemory" | "wasmTable", string>
  ) {
    this.tmp_run();
    const mapping: Record<string, (...args: any[]) => any> = {
      _fd_write: _fd_write,
      _fd_seek: _fd_seek,
      _emscripten_memcpy_big: this._emscripten_memcpy_big,
      _emscripten_resize_heap: this._emscripten_resize_heap,
      _fd_read: (...args: any[]) => {
        // console.log("11123");
        // console.log(args);

        // @ts-ignore
        return _fd_read(...args, this.wasmMemory);
      },
      _fd_close: _fd_close,
    };

    const asmLibraryArg: Record<string, (...args: any[]) => any> = {};
    asmLibraryArgKeys.forEach((asmLibraryArgKey) => {
      // @ts-ignore
      asmLibraryArg[asmLibraryArgKey.key] = mapping[asmLibraryArgKey.value];
    });
    logger("asmLibraryArg: ", asmLibraryArg);

    const info = { a: asmLibraryArg };
    const receiveInstance = (instance: WebAssembly.Instance) => {
      const exports = instance.exports;
      this.Module["asm"] = exports;
      logger(`this.Module["asm"]: `, this.Module["asm"]);

      this.wasmMemory = this.Module["asm"][wasmRuntime.wasmMemory];
      this.updateGlobalBufferAndViews(this.Module, this.wasmMemory!.buffer);
      this.wasmTable = this.Module["asm"][wasmRuntime.wasmTable];
      this.removeRunDependency();
    };
    this.addRunDependency();
    function receiveInstantiatedSource(output: any) {
      receiveInstance(output["instance"]);
    }
    function instantiateArrayBuffer(receiver: any) {
      return getBinaryPromise(wasmBinary)
        .then(function (binary) {
          logger("1", info);
          return WebAssembly.instantiate(binary, info);
        })
        .then(receiver, function (reason) {
          IO.stderr("failed to asynchronously prepare wasm: " + reason);
          abort(reason);
        });
    }

    await instantiateArrayBuffer(receiveInstantiatedSource).catch(
      readyPromiseReject
    );
    logger("createWasm finished");
  }

  public preRun(
    caller: Record<"___wasm_call_ctors" | "_main" | string, string>
  ) {
    this.___wasm_call_ctors = (...args: any[]) =>
      this.Module["asm"][caller["___wasm_call_ctors"]](...args);

    for (const key in caller) {
      if (key !== "___wasm_call_ctors") {
        this.Module[key] = (...args: any[]) =>
          this.Module["asm"][caller[key]](...args);
      }
    }

    this.__ATINIT__.push({
      func: () => {
        this.___wasm_call_ctors();
      },
    });

    const runCaller = () => {
      if (!this.calledRun) this.run();
      if (!this.calledRun) this.dependenciesFulfilled = runCaller;
    };
    this.dependenciesFulfilled = runCaller;
    logger("preRun finished");
  }

  public callMain() {
    const entryFunction = this.Module["_main"];
    const argc = 0;
    const argv = 0;
    try {
      const ret = entryFunction(argc, argv);
      this.exit(ret, true);
    } catch (e) {
      if (e instanceof ExitStatus) {
        return;
      } else if (e == "unwind") {
        this.noExitRuntime = true;
        return;
      } else {
        let toLog = e;
        if (e && typeof e === "object" && e.stack) {
          toLog = [e, e.stack];
        }
        IO.stderr("exception thrown: " + toLog);
        quit_(1, e);
      }
    }
  }

  public run() {
    if (this.runDependencies > 0) {
      return;
    }

    if (this.calledRun) return;
    this.calledRun = true;
    if (SYSTEM_STATUS.ABORT) return;
    this.initRuntime();
    readyPromiseResolve(this.Module);
    this.callMain();
  }

  public writeArrayToMemory(array: ArrayLike<number>, buffer: number) {
    HEAP.HEAP8.set(array, buffer);
  }

  public ccall(
    ident: string,
    returnType: ArgType,
    argTypes: Array<ArgType>,
    args: any[]
  ) {
    const toC = {
      string: (str: string) => {
        const len = (str.length << 2) + 1;
        const ret = this.Module.stackAlloc(len);
        stringToUTF8(str, ret, len);
        return ret;
      },
      array: (arr: any[]) => {
        const ret = this.Module.stackAlloc(arr.length);
        this.writeArrayToMemory(arr, ret);
        return ret;
      },
    };
    function convertReturnValue(ret: number) {
      if (returnType === "string") return UTF8ToString(ret);
      if (returnType === "boolean") return Boolean(ret);
      return ret;
    }
    const cArgs = [];
    let stack = 0;

    if (args) {
      for (let i = 0; i < args.length; i++) {
        // @ts-ignore
        const converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = this.Module.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }

    let ret = this.Module[ident](...cArgs);
    ret = convertReturnValue(ret);
    if (stack !== 0) this.Module.stackRestore(stack);
    return ret;
  }

  public cwrap(
    ident: string,
    returnType: ArgType,
    argTypes: Array<ArgType> = []
  ) {
    const numericArgs = argTypes.every((type) => type === "number");
    if (returnType !== "string" && numericArgs) {
      return (...args: any[]) => this.Module[ident](...args);
    } else {
      return (...args: any[]) => this.ccall(ident, returnType, argTypes, args);
    }
  }
}
