// Suppress Node's DEP0060 by replacing util._extend with Object.assign
// Must run before any dependency that uses util._extend (e.g., http-proxy)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const util: any = require("util");
  if (util && typeof util._extend === "function") {
    util._extend = Object.assign;
  }
} catch {
  // noop
}

