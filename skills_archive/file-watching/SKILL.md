---
name: file-watching
description: Cross-platform file-watching reference (macOS FSEvents, Linux inotify, Windows ReadDirectoryChangesW, notify-rs, editor save patterns, LSP integration). Read before architecting any file-change-driven system.
metadata:
  type: reference
---

# File Watching: the last word

This document exists so you stop re-asking the same questions of LLMs whose training is
shallow on this topic. Every non-obvious claim is tagged:

- (Spec)  : from a kernel/OS man page or vendor spec.
- (Src)   : verified against the source code.
- (Obs)   : from a benchmark or a credible GitHub issue.
- (Lore)  : commonly believed but not directly verified here; flagged for the reader.
- (Open)  : not resolved by this document; verify before relying on it.

Numbered sources are listed at the bottom. Inline citations look like `[3]`.

---

## 1. TL;DR / decision matrix

If you only read one thing, read this table.

| Workload                                       | OS         | Strategy                                                                          |
|------------------------------------------------|------------|-----------------------------------------------------------------------------------|
| 1 repo, < 50k files                            | macOS      | `notify::RecommendedWatcher` recursive on root, FSEvents covers it free [1][16]   |
| 1 repo, < 50k files                            | Linux      | `notify` recursive on root, bump `max_user_watches` to 524288 first [3][16]       |
| 1 repo, < 50k files                            | Windows    | `notify` recursive on root, native `bWatchSubtree=TRUE` on ReadDirectoryChangesW [2]|
| 50-500 repos                                   | macOS      | one recursive FSEvents stream per repo root, cheap [1][17]                        |
| 50-500 repos                                   | Linux      | recursive on each root IFF `max_user_watches >= 1M`; else PollWatcher or fanotify |
| 50-500 repos                                   | Windows    | recursive on each root, watch IOCP-backed handles, increase buffer to 64 KB [2]   |
| Source on /mnt/c (WSL2)                        | WSL2       | PollWatcher with 1-2s interval, kernel events do not cross boundary [12][13]      |
| Source on NFS / SMB / CIFS                     | any        | PollWatcher only, inotify/FSEvents do not deliver [10][11]                        |
| Source on Docker bind mount (macOS/Windows)    | macOS/Win  | PollWatcher; bind mounts on these hosts behave like network FS                    |
| Workspace > 250k dirs, watch perf critical     | Linux      | drop inotify, use fanotify or `bazel --watchfs`-style strategy (Open)             |

The user's actual question, answered up front:

> Can we just watch the repo root recursively?

Yes on macOS and Windows. Yes on Linux IF you have raised `max_user_watches` above
the recursive directory count, because `notify` 6.x walks the tree and installs one
inotify watch per subdirectory [Src 16]. Filtering by path at receive time is fine.

---

## 2. FAQ

**Q: Can we just watch the repo root recursively?**
A: macOS: yes, free, one FSEvents stream covers any depth at latency you pick
   (typical 0.5-2.0s; `kFSEventStreamCreateFlagNoDefer` if you want first event
   immediately) [1][17]. Linux: yes, but `notify`'s "recursive" walks the tree
   itself and installs one `inotify_add_watch` per directory [Src 16]. Each watch
   costs 1080 bytes of kernel memory (64-bit) [3]. Default `max_user_watches`
   = 8192 on upstream kernels, 524288 on modern Ubuntu, 128 on stock Arch
   historically [3][6]. Windows: yes, `ReadDirectoryChangesW(..., bWatchSubtree=TRUE)`
   is a single kernel watch [2].

**Q: How bad is it on a 500-repo monorepo?**
A: Assume 500 repos x 500 dirs/repo = 250k directories. macOS: 500 FSEvents
   streams, sub-MB of user RAM, no per-watch kernel limit you will hit. Linux:
   250k * 1080 B = 270 MB of unswappable kernel RAM if you install all watches
   one-per-dir. You need `max_user_watches >= 262144`. Default 8192 on upstream
   gets you ~5% of the way; Ubuntu's 524288 covers it. Windows: 500 recursive
   handles is fine, but you must service IOCP per-handle and size each buffer to
   handle git-checkout-size bursts (64 KB recommended for local, 64 KB hard limit
   on UNC) [2].

**Q: Does VS Code save fire `IN_MODIFY`?**
A: By default in 1.87+, yes, VS Code uses non-atomic write: truncate-then-write,
   which produces `IN_OPEN, IN_MODIFY, IN_CLOSE_WRITE` [9]. With
   `files.enableAtomicSave: true` it does write-temp-then-rename which produces
   `IN_CREATE` and `IN_MOVED_TO` on the temp, then `IN_MOVED_FROM` / `IN_MOVED_TO`
   replacing the target. A watcher listening only for `IN_MODIFY` will miss
   atomic-save edits. Watch `IN_MODIFY | IN_CLOSE_WRITE | IN_MOVED_TO | IN_CREATE`
   at minimum.

**Q: What about `.git/` noise?**
A: `.git/` produces the highest event volume per byte of useful change in any
   real repo. A single `git status` invocation can write `.git/index.lock` and
   `.git/index`. A `git checkout` of a large branch writes thousands of
   `.git/objects/xx/...` files. Exclude `.git/` at filter time unless you are
   specifically building Git-aware tooling. Other heavy hitters by order of
   typical noise: `node_modules/`, `target/`, `.next/`, `build/`, `dist/`,
   `__pycache__/`, `.venv/`, `.gradle/`, `.idea/`. (Obs, from watchexec
   maintenance discussions; not benchmarked here.)

**Q: Polling: how bad?**
A: `notify::PollWatcher` default interval is 30 seconds [Src 7]. Cost is
   `stat(2)` per watched path per interval plus an optional content-hash if you
   set `with_compare_contents(true)`. At 50k files and `stat` ~5 us cold (warm
   page cache), one sweep is 0.25 s of CPU and 50k random reads of inode
   metadata. At 1s interval that is 25% of one core continuous; at 30s default
   it is ~0.8%. The real cost on cold caches is disk seek, not CPU. On NFS each
   `stat` is a network round trip.

**Q: Why didn't my watcher catch the edit?**
A: Pick the one that applies:
   1. Editor used atomic save and you only listened for `IN_MODIFY` (see VS Code FAQ).
   2. Linux: `IN_Q_OVERFLOW` fired (queue default 16384 events) [3][5]; you
      missed everything past the overflow point. Listen for it.
   3. macOS: `kFSEventStreamEventFlagMustScanSubDirs` set on a coalesced batch;
      you must rescan or you have stale state [4][17].
   4. macOS: `kFSEventStreamEventFlagKernelDropped` or `UserDropped` after sleep
      or under load [4]. Re-scan from `lastEventId`.
   5. Linux: `inotify` on NFS/SMB/CIFS/AFS does not deliver events [10][11].
   6. WSL2: source on `/mnt/c`. Windows-side writes do not trigger Linux inotify [12].
   7. macOS case-only rename (`Foo.rs` -> `foo.rs`) on default case-insensitive
      APFS is a no-op; no event because no change [14].
   8. Symlinks: the target changed, but the symlink itself emits nothing. Watch
      target, not symlink, or set `follow_symlinks(true)` and accept the
      walk cost.

---

## 3. The three kernel APIs

### 3.1 inotify (Linux)

(Spec) [3][5]

| Property                     | Value                                                    |
|------------------------------|----------------------------------------------------------|
| Granularity                  | per file or per directory; NOT recursive                 |
| Recursion                    | not supported; userspace must walk and add per-dir       |
| Per-watch kernel cost        | 540 B on 32-bit, 1080 B on 64-bit                        |
| Default `max_user_watches`   | 8192 upstream; Ubuntu 22.04+: 524288 (Obs); Arch: 1048576 since 2018 (Lore) |
| Default `max_user_instances` | 128 (one process can hold one instance, so per-user cap) |
| Default `max_queued_events`  | 16384 per instance                                       |
| Overflow signal              | `IN_Q_OVERFLOW`, `wd = -1`; you missed events past this  |
| Latency                      | kernel notifies on `vfs_*` hook; effectively sub-ms      |
| Rename cookie                | `IN_MOVED_FROM` and `IN_MOVED_TO` share a 32-bit cookie; events may be split across `read()` calls and may not be adjacent |
| Network FS                   | NFS, SMB/CIFS, AFS: events NOT delivered for remote-side changes [10][11] |
| Symlinks                     | watch follows the resolved target by default; `IN_DONT_FOLLOW` flag to watch the link itself |
| Sleep/wake                   | inotify state survives suspend; events that fire during sleep are queued (may overflow) |
| Replay on subscribe          | none; you must seed state by an initial scan             |
| Path semantics               | absolute or relative; kernel returns the basename in `name`, you reconstruct the path |
| Directory delete             | watched dir delete -> `IN_DELETE_SELF` + `IN_IGNORED`; the wd is now stale |
| Unmount                      | `IN_UNMOUNT` + `IN_IGNORED`                              |

Raise the limits permanently with `/etc/sysctl.d/40-inotify.conf`:

```
fs.inotify.max_user_watches=1048576
fs.inotify.max_user_instances=1024
fs.inotify.max_queued_events=65536
```

Then `sudo sysctl --system`.

### 3.2 FSEvents (macOS)

(Spec) [1][4][17]

| Property                     | Value                                                                |
|------------------------------|----------------------------------------------------------------------|
| Granularity                  | directory by default; file-level with `kFSEventStreamCreateFlagFileEvents` (10.7+) |
| Recursion                    | native: one stream covers a path and all children                    |
| Per-watch kernel cost        | n/a, watches are not held in the kernel like inotify; `fseventsd` userspace daemon maintains the index per volume |
| Per-process limit            | open file descriptors apply (`launchctl limit maxfiles`); `kern.maxfilesperproc` default 24576 on recent macOS (Obs) |
| Latency                      | application-controlled `latency` parameter to `FSEventStreamCreate`; common 0.1-2.0 s; `kFSEventStreamCreateFlagNoDefer` causes the FIRST event of a burst to fire immediately rather than waiting `latency` seconds |
| Coalescing                   | events within the latency window are merged; you may get one event for many file changes inside a single directory |
| Drop signaling               | `kFSEventStreamEventFlagKernelDropped`, `UserDropped`, `MustScanSubDirs` flags require full rescan |
| Rename                       | with `FileEvents`: emits `ItemRenamed` flag on both old and new; without: only the parent directory is reported |
| Network volumes              | works on locally-mounted volumes that have `.fseventsd`; SMB shares from another Mac sharing via macOS work; foreign-server SMB / NFS DOES NOT [15] |
| Symlinks                     | events fire on the resolved target, not the symlink                  |
| Sleep/wake                   | events during sleep are journaled to `/.fseventsd/`; on subscribe with `sinceWhen != kFSEventStreamEventIdSinceNow`, the daemon replays from the journal |
| Replay on subscribe          | yes, `FSEventStreamCreate(..., sinceWhen, ...)` accepts a `lastEventId`; use `FSEventsGetLastEventIdForDeviceBeforeTime` to seed |
| Path semantics               | resolves to absolute, canonical paths via the volume's `.fseventsd` index |
| Case sensitivity             | APFS default volume is case-INsensitive; `Foo.rs` -> `foo.rs` rename is a no-op and produces NO event [14] |
| Root delete                  | with `kFSEventStreamCreateFlagWatchRoot`: emits `kFSEventStreamEventFlagRootChanged` |

Flag cheatsheet:

| Flag                              | Effect                                                            |
|-----------------------------------|-------------------------------------------------------------------|
| `kFSEventStreamCreateFlagNoDefer` | first event of a burst fires immediately; subsequent ones obey latency |
| `kFSEventStreamCreateFlagFileEvents` | file-level events (Create / Removed / Renamed / Modified / FinderInfoMod / ChangeOwner / XattrMod); without this you only get a directory path |
| `kFSEventStreamCreateFlagWatchRoot` | get notified if the watched root is itself moved or deleted     |
| `kFSEventStreamCreateFlagIgnoreSelf` | exclude events caused by this process                          |
| `kFSEventStreamCreateFlagUseExtendedData` | also report file inode numbers (helps rename tracking)    |

### 3.3 ReadDirectoryChangesW (Windows)

(Spec) [2]

| Property                     | Value                                                          |
|------------------------------|----------------------------------------------------------------|
| Granularity                  | per directory; subtree with `bWatchSubtree = TRUE`             |
| Recursion                    | native subtree flag, one handle covers the tree                |
| Per-watch kernel cost        | one kernel buffer per directory handle, application-sized via `nBufferLength`; the system allocates this once for the lifetime of the handle |
| Buffer max on network        | 64 KB hard limit; larger -> `ERROR_INVALID_PARAMETER` [2]      |
| Buffer recommended local     | 64 KB; testing shows Windows 8.1+ accepts buffers up to 128 MB (Obs) but pinning at 64 KB is the safe default |
| Overflow                     | call returns TRUE with `lpBytesReturned = 0`, OR fails with `ERROR_NOTIFY_ENUM_DIR`; both mean "rescan" |
| Latency                      | sub-ms; kernel pushes to the buffer on every matching change   |
| Rename                       | atomic-ish: emits `FILE_ACTION_RENAMED_OLD_NAME` then `FILE_ACTION_RENAMED_NEW_NAME` in the same buffer fill |
| Network drives               | works over SMB 3.0+; ReFS, CsvFS supported [2]; older SMB has the 64 KB buffer limit |
| Symlinks / junctions          | follows the kernel reparse-point chain; an event on a junction-target propagates to the junction's parent only if you watch the resolved path |
| Sleep/wake                   | survives sleep on local volumes; network volumes may drop the watch and require re-issue |
| Replay on subscribe          | none; pair with USN Change Journal for retroactive deltas      |
| Path semantics               | returns paths RELATIVE to the watched root, with backslashes; canonicalize before comparing |
| FILE_NOTIFY_INFORMATION fields | `NextEntryOffset`, `Action`, `FileNameLength`, `FileName[1]` (variable length, UTF-16) |

Notify filter bits (combine with `|`):

| Bit                                  | Hex    | Watches                       |
|--------------------------------------|--------|-------------------------------|
| `FILE_NOTIFY_CHANGE_FILE_NAME`       | 0x01   | create / rename / delete file |
| `FILE_NOTIFY_CHANGE_DIR_NAME`        | 0x02   | create / delete dir           |
| `FILE_NOTIFY_CHANGE_ATTRIBUTES`      | 0x04   | attribute change              |
| `FILE_NOTIFY_CHANGE_SIZE`            | 0x08   | size after flush              |
| `FILE_NOTIFY_CHANGE_LAST_WRITE`      | 0x10   | mtime after flush             |
| `FILE_NOTIFY_CHANGE_LAST_ACCESS`     | 0x20   | atime change                  |
| `FILE_NOTIFY_CHANGE_CREATION`        | 0x40   | birth-time change             |
| `FILE_NOTIFY_CHANGE_SECURITY`        | 0x100  | ACL change                    |

Sensible default for source-code watching: `FILE_NAME | DIR_NAME | LAST_WRITE | SIZE`.
`LAST_WRITE` and `SIZE` only fire after a kernel flush, which is non-trivial for
write-then-immediately-read tools; use them in addition to `FILE_NAME`, not as a
substitute.

### 3.4 kqueue EVFILT_VNODE (macOS, BSD)

(Spec / Lore) Secondary path on macOS, primary on FreeBSD/OpenBSD/NetBSD.

| Property                     | Value                                                         |
|------------------------------|---------------------------------------------------------------|
| Granularity                  | per OPEN file descriptor; you must `open()` every file        |
| Recursion                    | none; descriptor per file or per directory                    |
| Per-watch cost               | one file descriptor; `ulimit -n` applies (macOS default 256 soft, 4096-10240 hard; raise with `launchctl limit maxfiles`) |
| Latency                      | sub-ms                                                        |
| Overflow                     | none (events are not queued in a fixed buffer)                |
| Rename                       | `NOTE_RENAME` on the fd; the path the fd refers to is now wrong; you have no path information beyond the original |
| Network volumes              | works on most local mounts; NFS support is implementation-defined and generally unreliable (Lore) |
| Sleep/wake                   | descriptors survive sleep; events that happened during sleep are lost (no journaling) |

Used by `notify` only as a fallback (e.g. iOS). Not appropriate for large
codebases: 50k files = 50k open fds.

---

## 4. The `notify` crate (6.x and 7.x)

(Src) [7][16]

### 4.1 `RecommendedWatcher` resolves to

| Platform       | Backend                                            |
|----------------|----------------------------------------------------|
| macOS          | `FsEventWatcher` (FSEvents)                        |
| Linux          | `INotifyWatcher`                                   |
| Windows        | `ReadDirectoryChangesWatcher`                      |
| BSDs, iOS      | `KqueueWatcher`                                    |
| else / fallback| `PollWatcher`                                      |

### 4.2 `RecursiveMode::Recursive` semantics

| Platform | What happens                                                                              |
|----------|-------------------------------------------------------------------------------------------|
| macOS    | one FSEvents stream over the path; FREE recursion in the kernel [Src 16]                  |
| Linux    | `notify` calls `walkdir` and installs ONE inotify watch per subdirectory found [Src 16]   |
| Windows  | `ReadDirectoryChangesW(..., bWatchSubtree=TRUE)`; native, one handle [Src 16]             |

The Linux behavior is the load-bearing surprise. The crate's `add_watch()`:

```rust
let entries = WalkDir::new(&root.absolute)
    .follow_links(self.follow_links)
    .into_iter()
    .filter_map(filter_dir)
    .map(move |entry| root.child(entry.into_path()));
self.add_watches_for_paths(entries, is_recursive, watch_self)
```

[Src 16]. There is no throttle; on a 100k-directory tree you do 100k
`inotify_add_watch()` syscalls back-to-back. Time this in your startup budget.

If a subdirectory is created AFTER the initial walk, the crate's Linux backend
detects the `IN_CREATE` on the parent and adds a new inotify watch for it, but
ONLY if you opened with `RecursiveMode::Recursive`. There is a TOCTOU window
between create and watch installation where events on grandchildren can be lost
(Lore, common knowledge; check before relying).

### 4.3 `Config` defaults

(Src) [7]

| Field                | Default      | Notes                                                            |
|----------------------|--------------|------------------------------------------------------------------|
| `poll_interval`      | 30 seconds   | applies to `PollWatcher` only                                    |
| `compare_contents`   | false        | when true, hash file contents to suppress no-op modify events    |
| `follow_symlinks`    | true         | applies to inotify, kqueue, poll                                 |

### 4.4 `PollWatcher`

(Src / Spec) [7]

- Scans every watched root every `poll_interval` (default 30 s).
- Uses `stat(2)` mtime + size to detect changes; with `with_compare_contents(true)`
  also reads file contents and hashes.
- Picked automatically only as a last resort (no native backend).
- Use it explicitly via `PollWatcher::new(...)` on NFS, SMB, WSL2 `/mnt/`, and
  Docker bind mounts on macOS / Windows.
- CPU cost dominated by I/O; on warm cache, a 50k-file sweep is sub-second on
  modern hardware.

### 4.5 `notify-debouncer-mini` vs `notify-debouncer-full`

(Src) [8]

| Property                  | mini                                  | full                                                                 |
|---------------------------|---------------------------------------|----------------------------------------------------------------------|
| API                       | emits at most ONE event per file per debounce window | emits all distinct events, but deduplicated and rename-stitched |
| Rename pairing            | no                                    | YES; matches `From`/`To`; merges multi-step renames                  |
| File-id cache (rename)    | no                                    | YES; uses `FileIdMap` on macOS / Windows for stitching across paths  |
| Create/Modify dedup       | no                                    | suppresses Modify after Create; suppresses duplicate Create          |
| Event ordering            | per-file collapsing, not global       | preserves order across files                                         |
| Dependencies              | minimal                               | adds `file-id`, `walkdir`                                            |
| Pick when                 | you only need "this file is dirty"    | you want a clean stream of high-level events                         |

Both take a debounce duration; common values: 100-500 ms for interactive, 1-2 s
for build triggering, 5-10 s for batch sync.

### 4.6 Notable fixes by version

(Src) [18]

| Version    | Change                                                                            |
|------------|-----------------------------------------------------------------------------------|
| 6.0.0      | Linux: files moved INTO a watched folder now emit `rename to` (was `create`)      |
| 6.0.0      | Linux: `rename from` no longer spawns a thread                                    |
| 6.1.0      | Manual poll mode for PollWatcher; PollWatcher emits initial scan events           |
| 6.1.0      | Windows: fixed potential double-free                                              |
| 6.1.0      | kqueue: now emits `Modify` on writes                                              |
| 7.0.0      | Linux: deleted directories now reported correctly                                  |
| 7.0.0      | Linux: reports access/open events (new opt-in)                                    |
| 7.0.0      | Windows: fixed UB causing illegal instructions                                    |

### 4.7 `Watcher::unwatch` cost

(Lore / Open)

- macOS: stop the FSEvents stream, O(1).
- Linux: one `inotify_rm_watch()` per subdirectory in the tree; O(N) syscalls for
  a recursive watch. Slow at scale; budget for it.
- Windows: close the directory handle; O(1).

### 4.8 Watched directory deleted then recreated

| Platform | Behavior                                                                       |
|----------|--------------------------------------------------------------------------------|
| Linux    | `IN_DELETE_SELF` + `IN_IGNORED` on the wd; subsequent recreation is NOT re-watched automatically; you must re-`watch()` |
| macOS    | `kFSEventStreamEventFlagRootChanged` IF you opened with `kFSEventStreamCreateFlagWatchRoot`; stream continues but path is stale; recreate the stream |
| Windows  | the directory handle becomes invalid; ReadDirectoryChangesW returns an error; re-open and re-issue |

The `notify` crate does NOT auto-recover from any of these. Application code
must observe the error and re-watch.

---

## 5. Editor save patterns

What follows is the sequence of inotify events a watcher on the containing
directory sees for each editor's save of an existing file `foo.rs`. The same
pattern translates to FSEvents `Modify` vs `Renamed`, and Windows
`Modified` vs `RenamedOld/RenamedNew`.

### 5.1 VS Code / Cursor

Default in 1.87+: NON-atomic, truncate-then-write.

```
IN_OPEN foo.rs
IN_MODIFY foo.rs
IN_CLOSE_WRITE foo.rs
```

With `files.enableAtomicSave: true` (or for files VS Code deems
"non-trivial"; precise rules in (Open) and changed across versions):

```
IN_CREATE  foo.rs.<random>.tmp
IN_OPEN    foo.rs.<random>.tmp
IN_MODIFY  foo.rs.<random>.tmp
IN_CLOSE_WRITE foo.rs.<random>.tmp
IN_MOVED_FROM foo.rs.<random>.tmp  (cookie K)
IN_MOVED_TO   foo.rs               (cookie K, replaces existing)
```

A watcher listening only for `IN_MODIFY foo.rs` MISSES atomic save entirely.

VS Code's recursive watcher (parcel-watcher) on the host side does not have this
problem because it watches the directory and sees the `IN_MOVED_TO`. Your
downstream tool does have the problem unless it also watches the directory and
listens for the right event set.

### 5.2 vim

Default (`backup` off, `writebackup` on, which is the shipping default):

```
IN_CREATE foo.rs~        (write-backup; depends on backup options)
... write to foo.rs ...
IN_OPEN foo.rs
IN_MODIFY foo.rs
IN_CLOSE_WRITE foo.rs
IN_DELETE foo.rs~        (only if 'backup' is off)
```

vim writes IN-PLACE by default unless `writebackup` and `backupcopy=no` push it
into rename-mode. With `:set backupcopy=yes` (the default on most filesystems
where the inode matters for permissions), the sequence above holds. With
`:set backupcopy=no`, vim renames `foo.rs` to `foo.rs~`, writes a new `foo.rs`:

```
IN_MOVED_FROM foo.rs    (cookie K)
IN_MOVED_TO   foo.rs~   (cookie K)
IN_CREATE foo.rs
IN_OPEN foo.rs
IN_MODIFY foo.rs
IN_CLOSE_WRITE foo.rs
```

A naive `IN_MODIFY foo.rs` watcher catches the first form but misses the second
on the new file (it would have to catch `IN_CREATE` and re-watch by inode).

Swap files (`.foo.rs.swp`, `.foo.rs.swo`, ...) live alongside and emit constant
`IN_MODIFY` events while editing. Exclude `.*.sw?` at filter time.

### 5.3 JetBrains (IntelliJ, RustRover, etc.)

JetBrains uses write-temp-then-rename by default ("safe write", set via
"System Settings > Use safe write"):

```
IN_CREATE ___jb_tmp___foo.rs
IN_OPEN   ___jb_tmp___foo.rs
IN_MODIFY ___jb_tmp___foo.rs
IN_CLOSE_WRITE ___jb_tmp___foo.rs
IN_MOVED_FROM foo.rs              (cookie K1)
IN_MOVED_TO   ___jb_old___foo.rs  (cookie K1)
IN_MOVED_FROM ___jb_tmp___foo.rs  (cookie K2)
IN_MOVED_TO   foo.rs              (cookie K2)
IN_DELETE     ___jb_old___foo.rs
```

(Lore; exact prefix strings vary by IDE version.) JetBrains ships its own
native helper `fsnotifier` (`fsnotifier`, `fsnotifier64.exe`) that runs as a
separate process and feeds events to the JVM over a pipe [19]. On Linux it uses
inotify, on macOS FSEvents, on Windows ReadDirectoryChangesW. Same kernel
APIs, different language wrapper.

### 5.4 Emacs

Default (`backup-by-copying nil`, which is the default):

```
IN_MOVED_FROM foo.rs    (cookie K)
IN_MOVED_TO   foo.rs~   (cookie K)
IN_CREATE foo.rs
IN_OPEN foo.rs
IN_MODIFY foo.rs
IN_CLOSE_WRITE foo.rs
```

With `(setq backup-by-copying t)`:

```
IN_CREATE foo.rs~
IN_MODIFY foo.rs~        (copy)
IN_CLOSE_WRITE foo.rs~
IN_OPEN foo.rs
IN_MODIFY foo.rs
IN_CLOSE_WRITE foo.rs
```

The first form changes the inode of `foo.rs`. Watchers keyed by inode
(`kqueue`) will lose the file unless they re-resolve by path.

### 5.5 What to listen for

To catch every common editor's save of an existing file, listen for:

```
IN_MODIFY | IN_CLOSE_WRITE | IN_MOVED_TO | IN_CREATE
```

Then deduplicate against your last-seen state hash. `IN_CLOSE_WRITE` is the
strongest single signal that an in-place write has finished. `IN_MOVED_TO` is
the strongest single signal that an atomic-write replacement landed.

On FSEvents with `kFSEventStreamCreateFlagFileEvents`: listen for
`ItemModified | ItemRenamed | ItemCreated`.

On Windows: `FILE_ACTION_MODIFIED | FILE_ACTION_RENAMED_NEW_NAME | FILE_ACTION_ADDED`.

---

## 6. Practical limits and how to raise them

### 6.1 Linux

```sh
# inspect
sysctl fs.inotify
# fs.inotify.max_queued_events = 16384
# fs.inotify.max_user_instances = 128
# fs.inotify.max_user_watches = 8192     # or 524288 on Ubuntu 22.04+
```

| Distro / kernel | `max_user_watches` default                       |
|-----------------|--------------------------------------------------|
| Upstream kernel | 8192 [3]                                         |
| Ubuntu 20.04+   | 65536 (Obs)                                      |
| Ubuntu 22.04+   | 524288 (Obs)                                     |
| Ubuntu 24.04    | 524288 (Lore; not directly verified here)        |
| Debian 12       | 65536 (Lore)                                     |
| Arch Linux      | 1048576 since `filesystem` package 2018.06 (Lore)|
| Fedora 38+      | 65536 (Lore)                                     |
| RHEL 8          | 65536 (Lore)                                     |
| WSL2            | 8192 (upstream); not relevant for `/mnt/c` [12]  |

Bump permanently:

```
# /etc/sysctl.d/40-inotify.conf
fs.inotify.max_user_watches=1048576
fs.inotify.max_user_instances=1024
fs.inotify.max_queued_events=65536
```

`sudo sysctl --system` to apply without reboot.

Memory cost at 1048576 watches on 64-bit: ~1.1 GB of unswappable kernel RAM
per user that fully consumes the limit. The limit is per real UID, NOT
per process.

### 6.2 macOS

```sh
# inspect
launchctl limit maxfiles
# maxfiles    256            unlimited
sysctl kern.maxfiles kern.maxfilesperproc
# kern.maxfiles: 245760
# kern.maxfilesperproc: 24576
ulimit -n
# 256
```

Defaults: soft 256, hard varies (often 10240) [Obs]. Raise via a launch daemon:

```xml
<!-- /Library/LaunchDaemons/limit.maxfiles.plist -->
<plist version="1.0">
<dict>
  <key>Label</key><string>limit.maxfiles</string>
  <key>ProgramArguments</key>
  <array>
    <string>launchctl</string>
    <string>limit</string>
    <string>maxfiles</string>
    <string>524288</string>
    <string>524288</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>ServiceIPC</key><false/>
</dict>
</plist>
```

`sudo launchctl load -w /Library/LaunchDaemons/limit.maxfiles.plist`.

On macOS 13.5+ with SIP, `launchctl limit maxfiles ...` from the command line
may fail with "Operation not permitted"; the launch-daemon plist still works.

FSEvents itself does not consume file descriptors per directory. fd limits
matter for kqueue, for opening source files in the application, and for
`open(2)`-based libraries.

### 6.3 Windows

- File handle limits: per-process default ~16M handles (`SetHandleCount` is a
  no-op in modern Windows); not the constraint.
- ReadDirectoryChangesW buffer: see 3.3. Pin to 64 KB unless you have measured.
- IOCP threadpool: one thread serving N completion ports is fine; do not spawn
  one thread per directory.

---

## 7. Recursive-on-root vs targeted per-directory

### Decision matrix

| Workload                       | Recursive-on-root                   | Targeted per-dir                          |
|--------------------------------|-------------------------------------|-------------------------------------------|
| macOS, any size                | WIN. Free. Always pick this.        | Lose. Adds complexity for no benefit.     |
| Windows, any size              | WIN. Native subtree flag.           | Lose.                                     |
| Linux, < 1k dirs               | WIN. Cheap.                         | Tie.                                      |
| Linux, 1k-10k dirs             | OK. Watch the limit.                | OK if you can map dirs to needs.          |
| Linux, 10k-100k dirs           | OK only if `max_user_watches` raised. Otherwise polls. | WIN if you can prune (e.g. only watch leaf source dirs). |
| Linux, > 100k dirs             | LOSE for default limits. Use fanotify, PollWatcher, or aggressive exclusion. | WIN if you can prune. |
| Network FS (NFS/SMB)           | LOSE.                               | LOSE. Both must poll.                     |

### Exclude lists in practice

Most event noise per repo, ordered (Lore / observed in watchexec, chokidar,
parcel-watcher discussions):

1. `.git/` (especially `.git/objects/`, `.git/index.lock`)
2. `node_modules/`
3. `target/` (Cargo)
4. `.next/`, `.nuxt/`, `.svelte-kit/` (JS frameworks)
5. `dist/`, `build/`, `out/`
6. `__pycache__/`, `.venv/`, `venv/`
7. `.gradle/`, `.idea/`, `.vscode/` (mostly fine to leave on for `.vscode/`)
8. `.terraform/`
9. `coverage/`, `.nyc_output/`

The standard sprefa-equivalent exclude list: `^\.git/`, `^node_modules/`,
`^target/`, `^\.next/`, `^dist/`, `^build/`, `^__pycache__/`, `^\.venv/`.

On Linux with `notify` recursive, exclusion happens at WATCH-INSTALL time
(walkdir filter), not at event-receive time, so excluded directories cost zero
inotify watches. Code that filters at receive time is paying full kernel cost.

### Scale arithmetic

- 1 repo, 50k files, ~2k dirs:
  - macOS: 1 stream. Fine.
  - Linux: 2k inotify watches, ~2 MB kernel RAM. Fine even at default 8192.
  - Windows: 1 handle. Fine.
- 500 repos, 250k dirs total:
  - macOS: 500 streams. Fine.
  - Linux: 250k watches, ~270 MB kernel RAM, need `max_user_watches >= 262144`.
    Ubuntu 22.04+ covers it at 524288. Arch covers it. Stock RHEL/Debian
    DOES NOT.
  - Windows: 500 handles. Fine. Size buffers to absorb a git-checkout burst
    (default 8 KB is too small; pin 64 KB).

---

## 8. Network mounts and remote filesystems

| Filesystem                         | inotify    | FSEvents   | RDCW        | Workaround        |
|------------------------------------|------------|------------|-------------|-------------------|
| NFS (any version, Linux client)    | NO [10][11]| n/a        | n/a         | Poll              |
| SMB / CIFS (Linux client)          | NO [10][11]| n/a        | n/a         | Poll              |
| AFS                                | NO [10]    | n/a        | n/a         | Poll              |
| FUSE                               | depends on FS implementation [10] | n/a | n/a | Poll fallback |
| SMB share served BY macOS, mounted on macOS | n/a | partial; works if `.fseventsd` is accessible [15] | n/a | If unsure, poll |
| Arbitrary SMB server, macOS client | n/a | NO [15]    | n/a         | Poll              |
| NFS, macOS client                  | n/a | NO [15]    | n/a         | Poll              |
| Windows SMB share, Windows client  | n/a | n/a        | YES [2]; SMB 3.0+; 64 KB buffer hard limit | (works)|
| Older SMB / non-Microsoft server, Windows client | n/a | n/a | unreliable | Poll |
| WSL2 `/mnt/c/...`                  | NO [12]    | n/a        | n/a (Linux side) | Poll, or run watcher Windows-side |
| Docker bind mount, macOS host      | NO [13]    | NO         | n/a         | Poll, or use mutagen / docker-sync |
| Docker bind mount, Windows host    | NO         | n/a        | depends     | Poll, or WSL2-native |

Real cost of polling at scale:

- `stat(2)` per file is 1 syscall. Locally, ~1-5 us warm cache; cold cache or
  network = much slower.
- 50k files at 5 us = 0.25 s of CPU per sweep; at 1 s interval that is 25%
  of a core. At 30 s default, ~0.8%.
- Over NFS, each `stat` is a round trip. Even at 1 ms RTT, 50k files = 50 s
  per sweep. Use very long intervals or rsync-style block comparisons.

Watchman has explicit cookie-based synchronization for network filesystems and
high-load FSEvents [17]. It plants a temp file in the watched root and waits
to see the event for it before declaring "caught up." That technique is worth
copying in any tool that wants "I have observed all events up to time T"
semantics.

---

## 9. LSP integration

### 9.1 `workspace/didChangeWatchedFiles`

(Spec) LSP 3.17 [20]

- Client capability: `workspace.didChangeWatchedFiles.dynamicRegistration`.
- The SERVER registers patterns via `client/registerCapability` with method
  `"workspace/didChangeWatchedFiles"` and a list of `FileSystemWatcher` entries.
- Each `FileSystemWatcher` has:
  - `globPattern`: a `string` glob OR a `RelativePattern` (`{ baseUri, pattern }`).
  - `kind`: bitfield `Create=1 | Change=2 | Delete=4`. Default `7` (all).
- Glob syntax: `*`, `?`, `**`, `{a,b}`, `[abc]`. Single segment vs multi-segment
  rules match VS Code's spec [20].
- The CLIENT is responsible for the file watching. It sends
  `workspace/didChangeWatchedFiles` notifications with an array of
  `FileEvent { uri, type }`. `FileChangeType` is `Created=1, Changed=2, Deleted=3`.
- The spec allows servers to ALSO watch the filesystem themselves, but discourages
  it because: (a) the client may already be watching, doubling kernel cost,
  (b) the client knows about editor-internal pending changes the OS cannot see.

### 9.2 Client-side vs server-side watcher tradeoffs

| Concern                          | Client-side (LSP `didChangeWatchedFiles`) | Server-side (own watcher)       |
|----------------------------------|-------------------------------------------|---------------------------------|
| Avoids double watching           | YES, one watcher per workspace            | NO, every server you run watches|
| Sees unsaved editor buffers      | YES (client gates dirty buffers)          | NO                              |
| Cross-platform abstraction       | client handles it                         | server reimplements per OS      |
| Glob filtering done by           | client                                    | server                          |
| Sees events from non-editor source (git, build) | YES, client watches the FS    | YES                             |
| Performance under monorepo       | client may throttle / batch               | per-server overhead             |
| Survives editor restart          | NO                                        | YES                             |

### 9.3 What real servers do

- `vscode-languageclient` (the canonical reference): the client implements
  `didChangeWatchedFiles` by registering with VS Code's native `FileSystemWatcher`,
  which under the hood uses `parcel-watcher` for recursive and `fs.watch` for
  non-recursive [21].
- `rust-analyzer`'s `vfs-notify` crate uses `notify` with
  `RecursiveMode::Recursive` and a hand-rolled exclude list (filters dirs at
  `walkdir` time, BEFORE installing inotify watches) [Src 22]. Rust-analyzer
  defaults to server-side watching disabled; if the client implements
  `didChangeWatchedFiles`, it relies on that.
- `typescript-language-server`: relies on the client by default.
- `pyright` / `pylance`: relies on the client; can be configured server-side
  but is not the default.

The pattern across mature servers: PREFER client-side watching. Only fall
back to server-side if the client lacks the capability (Helix, some Neovim
versions historically [20]).

---

## 10. Production references

| Project                    | Backend, recursion, notable                                                                |
|----------------------------|--------------------------------------------------------------------------------------------|
| Watchman (Facebook) [17]   | per-OS native; cookie-based query sync; SCM-aware queries; explicit settle_period for FSEvents flakiness; triggers as saved queries |
| rust-analyzer `vfs-notify` | `notify` + walkdir, recursive, exclude list, disabled by default in favor of LSP client    |
| JetBrains `fsnotifier`     | native helper binary per OS, stdio protocol to JVM; ships per IDE [19]                     |
| chokidar (Node.js)         | wraps `fs.watch` (ReadDirectoryChangesW on Windows), per-file `fs.watchFile` polling for atomic-write detection on macOS |
| `entr`                     | kqueue-based; one fd per file; argument list capped by `ARG_MAX`                           |
| `watchexec` (Rust CLI)     | `notify` + `ignore` (gitignore parser); tokio-based; rotates SIGINT to subprocess          |
| `bazel --watchfs`          | per-OS native; recursive on the workspace root; integrates with bazel's action cache       |
| VS Code (`parcel-watcher`) | per-OS native C++ binding; recursive subtree; non-recursive falls back to `fs.watch`       |

---

## 11. Failure modes you WILL hit

1. **VS Code `files.autoSave: onWindowChange`**: file is dirty in the editor,
   no `IN_MODIFY` fires until the user switches windows; your "save and
   trigger" pipeline appears broken because the editor never saved.
2. **`git checkout` of a large branch**: 50k file writes in under a second.
   Linux `max_queued_events` default 16384; you exceed it and get
   `IN_Q_OVERFLOW`. `notify-debouncer-mini` collapses your downstream
   events, but the kernel queue overflow is upstream of the debouncer and
   you have already lost data. Mitigation: bump `max_queued_events`, listen
   for `Q_OVERFLOW`, and on overflow trigger a full rescan.
3. **Atomic-save tmp file**: a tmp file appears, vanishes, target gets
   `IN_MOVED_TO`. A watcher listening only on `foo.rs` (the specific path)
   sees nothing. Watch the DIRECTORY for `IN_MOVED_TO foo.rs`, not the file
   for `IN_MODIFY foo.rs`.
4. **Symlink target change**: a symlink's target file is modified. The
   symlink itself produces no event. Watch the target, or use
   `with_follow_symlinks(true)` and accept the walk cost.
5. **Case-only rename on macOS APFS default**: `Foo.rs` -> `foo.rs` is a
   no-op on a case-insensitive volume; no event because no change [14].
6. **macOS lid-close / sleep**: FSEvents may journal during sleep but you
   may miss the journal if you reconnect with `kFSEventStreamEventIdSinceNow`.
   Persist `lastEventId` and reconnect with it [17]. Also handle
   `kFSEventStreamEventFlagKernelDropped` and rescan.
7. **`MustScanSubDirs` coalesced batch**: an FSEvents event with
   `kFSEventStreamEventFlagMustScanSubDirs` is a flag, not data. You must
   re-enumerate the subtree yourself or accept stale state [4][17].
8. **inotify watched directory deleted then recreated**: the wd is dead
   (`IN_IGNORED`). The recreated directory is a different inode; you must
   re-`watch()`. `notify` does NOT do this automatically.
9. **Linux inotify on `tmpfs`**: works for normal events but the kernel
   may not emit `IN_MOVED_FROM`/`IN_MOVED_TO` cookies the way disk-backed
   FSes do under load. (Lore; verify.)
10. **Windows: opened-for-delete file**: `FILE_ACTION_REMOVED` fires when
    the last handle closes, NOT when delete is requested. Tools that
    write-then-delete-then-write (some installers, some compilers) produce
    delete events much later than expected.
11. **JetBrains "safe write" + git hook**: the cascade of MOVED events
    confuses watchers that try to track by name. Use file ID stitching
    (`notify-debouncer-full`) or accept "the file went away and came back"
    as your model.
12. **WSL2 `/mnt/c` is a 9P/Plan-9 mount in disguise**: no kernel inotify
    crosses the boundary. Run the watcher on the Windows side, or copy
    source into the WSL2 filesystem [12][13].
13. **NFS `noac`**: even polling lies; `stat` returns cached attributes
    until cache expires. Set `actimeo=1` if you must poll over NFS.

---

## 12. Glossary

- **Recursive mode**: a single watch covers a directory and all descendants.
  Native on FSEvents and ReadDirectoryChangesW; emulated on Linux by walking
  and installing one watch per subdir.
- **Coalescing**: merging multiple events into one within a time window.
  Done by FSEvents (latency parameter), by `notify-debouncer-*`, and at the
  application layer.
- **Debouncing**: waiting for events to stop arriving for a window before
  acting. Done by `notify-debouncer-*`.
- **Cookie (inotify)**: a 32-bit integer linking a `MOVED_FROM` to a
  `MOVED_TO`. Not unique across processes; not guaranteed contiguous in
  the event stream.
- **Watch descriptor (wd)**: integer handle returned by `inotify_add_watch`;
  dies on `IN_IGNORED`.
- **fseventsd**: macOS userspace daemon at `/System/Library/CoreServices/fseventsd`
  that journals events to `/.fseventsd` on each volume and serves them via
  FSEvents API.
- **MustScanSubDirs**: FSEvents flag meaning "events were coalesced or
  dropped; rescan."
- **PollWatcher**: scan-the-tree-on-a-timer fallback. Use on network FS,
  WSL2 `/mnt/c`, Docker bind mounts, or any FS that does not support
  native notifications.
- **`bWatchSubtree`**: Windows boolean parameter to ReadDirectoryChangesW
  enabling native recursion.
- **USN Change Journal**: NTFS-only journal of all FS changes since boot;
  retroactive equivalent of FSEvents `lastEventId`. Not exposed by `notify`.

---

## 13. Sources

1. Apple, "File System Events Programming Guide", https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/FSEvents_ProgGuide/Introduction/Introduction.html
2. Microsoft, "ReadDirectoryChangesW function (winbase.h)", https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-readdirectorychangesw
3. man-pages, "inotify(7) - Linux manual page", https://man7.org/linux/man-pages/man7/inotify.7.html
4. Apple, FSEvents.h header, `kFSEventStreamEventFlag*` constants (in CoreServices framework headers)
5. Linux kernel source, `fs/notify/inotify/inotify_user.c` and `inotify_fsnotify.c`
6. Linus Torvalds / Waiman Long, "[PATCH v3] inotify: Increase default inotify.max_user_watches limit to 1048576", https://lore.kernel.org/all/20201029194256.7954-1-longman@redhat.com/
7. notify-rs, `notify::Config` docs and source, https://docs.rs/notify/latest/notify/struct.Config.html and https://github.com/notify-rs/notify/blob/main/notify/src/poll.rs
8. notify-rs, `notify-debouncer-full` and `notify-debouncer-mini` docs, https://docs.rs/notify-debouncer-full and https://docs.rs/notify-debouncer-mini
9. microsoft/vscode, "File Watcher Internals" wiki and issue #98063 ("Add an option to save files atomically"), https://github.com/microsoft/vscode/wiki/File-Watcher-Internals
10. LWN, "Change notifications for network filesystems", https://lwn.net/Articles/896055/
11. Linux NFS list, "NFS and inotify", https://nfsv4.linux-nfs.narkive.com/vJgyTOl2/nfs-and-inotify
12. microsoft/WSL #4739, "File changes made by Windows apps on Windows filesystem don't trigger notifications for Linux apps", https://github.com/microsoft/WSL/issues/4739
13. webpack/webpack-dev-server #2661, "Hot Module Replacement/HMR doesn't trigger reload in wsl2", https://github.com/webpack/webpack-dev-server/issues/2661
14. APFS case-sensitivity discussion, https://swild.dev/dev/apfs-case-insensitive/ and Apple, "Apple File System Guide"
15. Eclectic Light, "Watching macOS file systems: FSEvents and volume journals", https://eclecticlight.co/2017/09/12/watching-macos-file-systems-fsevents-and-volume-journals/
16. notify-rs source, `notify/src/inotify.rs` `add_watch()`, https://github.com/notify-rs/notify/blob/main/notify/src/inotify.rs
17. Facebook Watchman docs, https://facebook.github.io/watchman/docs/cookies.html and https://facebook.github.io/watchman/docs/scm-query
18. notify-rs CHANGELOG, https://github.com/notify-rs/notify/blob/main/notify/CHANGELOG.md
19. JetBrains, "intellij-community/native/fsNotifier", https://github.com/JetBrains/intellij-community/tree/master/native/fsNotifier
20. Microsoft, LSP 3.17 spec, "Workspace Did Change Watched Files", https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/
21. microsoft/vscode-languageserver-node #1227, "How to use workspace/didChangeWatchedFiles", https://github.com/microsoft/vscode-languageserver-node/issues/1227
22. rust-lang/rust-analyzer, `crates/vfs-notify/src/lib.rs`, https://github.com/rust-lang/rust-analyzer/tree/master/crates/vfs-notify
23. watchexec docs, "Linux inotify limits", https://watchexec.github.io/docs/inotify-limits.html
24. watchexec docs, "Mac FSEvents limitations", https://watchexec.github.io/docs/macos-fsevents.html

---

## 14. Items flagged for verification

(Open) and (Lore) facts in this document, listed for the reader to verify
when they matter:

1. Exact `max_user_watches` defaults for Debian 12, Fedora 38+, RHEL 8/9,
   Ubuntu 24.04. The 524288 figure for Ubuntu 22.04 is confirmed; later
   distros are inferred.
2. JetBrains "safe write" exact temp-file names per IDE version.
3. VS Code `files.enableAtomicSave` precise file-selection rules (which
   files VS Code treats as "non-trivial" enough to atomic-save).
4. notify-rs Linux recursive-watch race window between `IN_CREATE` of a
   subdir and installation of its inotify watch; events on grandchildren
   during this window are believed to be lost.
5. kqueue NFS behavior on macOS: empirically flaky, not specified.
6. Windows ReadDirectoryChangesW buffer upper bound on local volumes
   (documented 64 KB on network; tested up to 128 MB on Windows 8.1
   locally per dotnet/corefx; pin at 64 KB unless measured).
7. `tmpfs` inotify rename cookie behavior under load.
