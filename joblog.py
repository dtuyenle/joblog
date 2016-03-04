#
# Logging module for batch jobs.
#
# To use, import joblog and logging, and use logging.info() etc. as normal.
#

import atexit
import logging
import os
import os.path
import platform
import pwd
import resource
import sys
import time
import traceback

class JoblogFormatter(logging.Formatter):
    def format(self, record):
        datetime = time.strftime("%m%d %H%M%S", time.gmtime(record.created))
        msecs = int(record.created * 1000) % 1000
        ru = resource.getrusage(resource.RUSAGE_SELF)
        rss = format_size(ru.ru_maxrss * 1024)
        message = record.msg % record.args
        return "%s%s.%03i [%s] %s" % (record.levelname[0], datetime, msecs, rss, message)

def setup_logging():
    now = time.gmtime()
    directory = os.path.join("logs", time.strftime("%Y", now), time.strftime("%Y%m", now),
                             time.strftime("%Y%m%d", now))
    try:
        os.makedirs(directory)
    except OSError as e:
        pass
    name = os.path.join(directory,
            "%s_%s_%i_%s.log" % (time.strftime("%Y%m%d_%H%M%S", now), program_name,
                os.getpid(), platform.node()))
    fh = logging.FileHandler(name)
    ch = logging.StreamHandler()
    formatter = JoblogFormatter()
    fh.setLevel(logging.DEBUG)
    ch.setLevel(logging.INFO)
    ch.setFormatter(formatter)
    fh.setFormatter(formatter)
    logging.getLogger().addHandler(ch)
    logging.getLogger().addHandler(fh)
    logging.getLogger().setLevel(logging.DEBUG)
    logging.info("logging to %s", name)

def read_io_stats():
    io_stats = {}
    for line in open("/proc/self/io", "r"):
        key, value = line.rstrip().split(": ")
        io_stats[key] = int(value)
    return io_stats

def format_size(i):
    if 1024 * 1024 <= i:
        return "%iM" % (i / 1024 / 1024,)
    if 1024 <= i:
        return "%iK" % (i / 1024,)
    return "%i" % (i,)

def exit_handler():
    last_value = getattr(sys, "last_value", None)
    if last_value is not None:
        logging.error("%s: %s", type(last_value).__name__, last_value)
        for frame in traceback.extract_tb(sys.last_traceback):
            logging.error("  %s:%s in %s", *frame[:3])
    t = time_fn() - start_time
    ru = resource.getrusage(resource.RUSAGE_SELF)
    io_stats = read_io_stats()
    logging.info("exit %s: pid %i, real %.3fs, user %.2fs, system %.2fs, " +
            "read %s, written %s, peak rss %s",
            program_name, os.getpid(), t,
            ru.ru_utime, ru.ru_stime,
            format_size(io_stats["rchar"]), format_size(io_stats["wchar"]),
            format_size(ru.ru_maxrss * 1024));

time_fn = time.time
if hasattr(time, "monotonic"):
    time_fn = time.monotonic  # Python 3.3+
start_time = time_fn()
program_name = os.path.splitext(os.path.basename(sys.argv[0]))[0]
setup_logging()
logging.info("start %s: %s %s %s, hostname %s, user %i(%s)", program_name,
        platform.python_implementation(), platform.python_version(), platform.system(),
        platform.node(), os.getuid(), pwd.getpwuid(os.getuid()).pw_name)
logging.info("invoked as: %s\n", " ".join(sys.argv))

atexit.register(exit_handler)
