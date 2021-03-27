export class PATH {
  static splitPath(filename: string) {
    const splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^/]+?|)(\.[^./]*|))(?:[/]*)$/;
    return splitPathRe.exec(filename).slice(1);
  }

  static normalizeArray(parts: string[], allowAboveRoot: boolean) {
    let up = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const last = parts[i];
      if (last === ".") {
        parts.splice(i, 1);
      } else if (last === "..") {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }
    if (allowAboveRoot) {
      for (; up; up--) {
        parts.unshift("..");
      }
    }
    return parts;
  }

  static normalize(path: string) {
    const isAbsolute = path.charAt(0) === "/",
      trailingSlash = path.substr(-1) === "/";
    path = PATH.normalizeArray(
      path.split("/").filter((p) => !!p),
      !isAbsolute
    ).join("/");
    if (!path && !isAbsolute) {
      path = ".";
    }
    if (path && trailingSlash) {
      path += "/";
    }
    return (isAbsolute ? "/" : "") + path;
  }

  static dirname(path: string) {
    const result = PATH.splitPath(path);
    const root = result[0];
    let dir = result[1];
    if (!root && !dir) return ".";
    if (dir) {
      dir = dir.substr(0, dir.length - 1);
    }
    return root + dir;
  }

  static basename(path: string) {
    if (path === "/") return "/";
    path = PATH.normalize(path);
    path = path.replace(/\/$/, "");
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) return path;
    return path.substr(lastSlash + 1);
  }

  static extname(path: string) {
    return PATH.splitPath(path)[3];
  }

  static join(...args: string[]) {
    const paths = Array.prototype.slice.call(args, 0);
    return PATH.normalize(paths.join("/"));
  }

  static join2(l: string, r: string) {
    return PATH.normalize(l + "/" + r);
  }
}
