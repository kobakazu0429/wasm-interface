import { FS } from "./FS";
import { PATH } from "./PATH";

export class PATH_FS {
  static resolve(...args: string[]) {
    let resolvedPath = "";
    let resolvedAbsolute = false;
    for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      const path = i >= 0 ? args[i] : FS.cwd();
      if (typeof path !== "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!path) {
        return "";
      }
      resolvedPath = path + "/" + resolvedPath;
      resolvedAbsolute = path.charAt(0) === "/";
    }
    resolvedPath = PATH.normalizeArray(
      resolvedPath.split("/").filter((p) => !!p),
      !resolvedAbsolute
    ).join("/");
    return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
  }

  static relative(from: string, to: string) {
    from = PATH_FS.resolve(from).substr(1);
    to = PATH_FS.resolve(to).substr(1);

    const fromParts = trim(from.split("/"));
    const toParts = trim(to.split("/"));
    const length = Math.min(fromParts.length, toParts.length);
    let samePartsLength = length;
    for (let i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }
    let outputParts = [];
    for (let i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..");
    }
    outputParts = outputParts.concat(toParts.slice(samePartsLength));
    return outputParts.join("/");
  }
}

function trim(arr: string[]) {
  let start = 0;
  for (; start < arr.length; start++) {
    if (arr[start] !== "") break;
  }
  let end = arr.length - 1;
  for (; end >= 0; end--) {
    if (arr[end] !== "") break;
  }
  if (start > end) return [];
  return arr.slice(start, end - start + 1);
}
