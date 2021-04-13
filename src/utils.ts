import { readyPromiseReject } from "./CLangRunner";
import { SYSTEM_STATUS } from "./system_status";
import { IO } from "./IO";

/* eslint-disable no-empty */

export function getRandomDevice() {
  if (
    typeof crypto === "object" &&
    typeof crypto["getRandomValues"] === "function"
  ) {
    const randomBuffer = new Uint8Array(1);
    return function () {
      crypto.getRandomValues(randomBuffer);
      return randomBuffer[0];
    };
    // eslint-disable-next-line no-constant-condition
  } else if (/*ENVIRONMENT_IS_NODE*/ true) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const crypto_module = require("crypto");
      return function () {
        return crypto_module["randomBytes"](1)[0];
      };
    } catch (e) {}
  }
  return function () {
    abort("randomDevice");
  };
}

export function abort(what?: string) {
  what += "";
  IO.stderr(what);
  SYSTEM_STATUS.ABORT = true;
  SYSTEM_STATUS.EXITSTATUS = 1;
  what = "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
  const e = new WebAssembly.RuntimeError();
  readyPromiseReject(e);
  throw e;
}

export function logger(...message: any) {
  IO.debug(...message);
}
