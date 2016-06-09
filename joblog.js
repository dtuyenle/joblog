//
// Logging module for batch jobs.
//

"use strict";

var fs = require("fs");
var os = require("os");
var process = require("process");
var path = require("path");
var sprintf = require("sprintf-js").sprintf,
    vsprintf = require("sprintf-js").vsprintf;

var log;
var peakrss = 0;

function open_log() {
  var now = new Date();
  var year = now.getUTCFullYear(), month = now.getUTCMonth() + 1, day = now.getUTCDate(),
      hour = now.getUTCHours(), minute = now.getUTCMinutes(), second = now.getUTCSeconds();
  var directory = sprintf(path.join("logs", "%04i", "%04i%02i", "%04i%02i%02i"),
      year,
      year, month,
      year, month, day);
  makedirs(directory);
  var name = sprintf("%s/%04i%02i%02i_%02i%02i%02i_%s_%i_%s.log",
      directory, year, month, day, hour, minute, second,
      program_name, process.pid, os.hostname());
  var log = fs.createWriteStream(name);
  log.on('error', function (err) {
    warn("error %s", err);
  });
  info("logging to %s", name);
  return log;
}

function makedirs(directory) {
  var dirs = directory.split(path.sep);
  for (var i = 1; i <= dirs.length; i++)
    mkdir(path.join.apply(null, dirs.slice(0, i)));
}

function mkdir(dir) {
  try {
    fs.mkdirSync(dir);
  } catch (e) {
    if (e.code != "EEXIST")
      throw e;
  }
}

function info(format) {
  var args = Array.prototype.slice.call(arguments, 1);
  print_log("I", format, args);
}

function warn(format) {
  var args = Array.prototype.slice.call(arguments, 1);
  print_log("W", format, args);
}

function error(format) {
  var args = Array.prototype.slice.call(arguments, 1);
  print_log("E", format, args);
}

function fatal(format) {
  var args = Array.prototype.slice.call(arguments, 1);
  print_log("F", format, args);
  process.exit(1);
}

function print_log(severity, format, args) {
  if (format === "") {
    console.warn("");
    return;
  }
  var now = new Date();
  var mem = process.memoryUsage();
  var message = vsprintf(format, args);
  message = sprintf("%s%02i%02i %02i%02i%02i.%03i %s[%s] %s",
      severity,
      now.getUTCMonth() + 1, now.getUTCDate(),
      now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(),
      now.getUTCMilliseconds(),
      process.send ? "(child " + process.pid + ") " : "",
      format_size(mem.rss),
      message);
  if (severity == "W" || severity == "I")
    console.warn(message);
  else
    console.error(message);
  if (log)
    log.write(message + "\n", "utf8");
  peakrss = Math.max(peakrss, mem.rss);
}

function read_io_stats() {
  var io_stats = {};
  fs.readFileSync("/proc/self/io", "ascii").split("\n").forEach(function(line) {
    var nameval = line.split(": ");
    io_stats[nameval[0]] = parseInt(nameval[1]);
  });
  return io_stats;
}

function read_times() {
  var times = {};
  var stat = fs.readFileSync("/proc/self/stat", "ascii").split(" ");
  times.utime = parseInt(stat[14]) / 100.0;
  times.stime = parseInt(stat[15]) / 100.0;
  return times;
}

function format_size(i) {
  if (1024 * 1024 <= i)
    return sprintf("%iM", i / 1024 / 1024);
  if (1024 <= i)
    return sprintf("%iK", i / 1024);
  return sprintf("%i", i);
}

var start_time = process.hrtime();
var program_name = path.basename(process.argv[1], ".js");
log = open_log();
info("start %s: %s %s %s, hostname %s, user %s",
    program_name,
    process.release.name, process.version, process.platform,
    os.hostname(), process.env.USER);
info("invoked as: %s", process.argv.join(" "));
info("");

process.on("exit", function(code) {
  var t = process.hrtime(start_time);
  info("");
  var io_stats = read_io_stats();
  var times = read_times();
  peakrss = Math.max(peakrss, process.memoryUsage().rss);
  info("exit %s: pid %i, real %.3fs, user %.2fs, system %.2fs, " +
      "read %s, written %s, peak rss %s",
      program_name, process.pid, t[0] + 1e-9 * t[1],
      times.utime, times.stime,
      format_size(io_stats.rchar), format_size(io_stats.wchar), format_size(peakrss));
  log.close();
});

process.on("uncaughtException", function(err) {
  info("");
  error("uncaught exception: %s", err.stack);
});

exports.info = info;
exports.warn = warn;
exports.error = error;
exports.fatal = fatal;
