#!/usr/bin/node
//
// Example of using joblog.js.
//

"use strict";

var joblog = require("./joblog.js");

joblog.info("running example");

var total = Math.floor(1000000 + Math.random() * 1000000);
var sum = 0;
for (var i = 0; i != total; i++) {
  sum += do_something(i);
  if (((i + 1) % 100000) == 0 || i + 1 == total) {
    joblog.info("processed %i/%i (%.1f%%), sum %i", i + 1, total, 100.0 * (i + 1) / total, sum);
  }
}

joblog.warn("final sum %i", sum);


function do_something(i) {
  return Math.floor(Math.random() * 100);
}

