"use strict";

const fs = require("node:fs");

function readLocalFile(filename, limit) {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > limit) throw new Error("Input must be a regular file within the size limit");
    const result = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < result.length) {
      const count = fs.readSync(fd, result, length, result.length - length, null);
      if (count === 0) break;
      length += count;
    }
    if (length !== stat.size) throw new Error("Input size changed during verification");
    return result.subarray(0, length);
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { readLocalFile };
