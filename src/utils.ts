/* eslint-disable no-empty */
import { abort } from "./runner";

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
