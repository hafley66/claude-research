---
name: common-lisp-logic
description: Build and evaluate Common Lisp compiler-front-end and logic-programming experiments, including Prolog, Datalog, miniKanren, constraints, executable images, and SWI or Racket capability comparisons.
---

# Common Lisp Logic

Use the local references before web research. They contain the established toolchain, experiment contract, and SWI capability crosswalk.

1. Read [the Common Lisp lab guide](references/0_COMMON_LISP_LAB_GUIDE.md) before writing or running Common Lisp.
2. Read [the SWI, Common Lisp, and Racket crosswalk](references/1_SWI_CL_RACKET_CROSSWALK.md) when comparing runtimes or deciding what could leave SWI-Prolog.
3. Read [the lab report contract](references/2_LAB_REPORT_CONTRACT.md) before creating an experiment.
4. Preserve the experiment's library API. Adapter code belongs in the lab beside the probe.
5. Record exact implementation versions, dependency commits, commands, outputs, executable size, and elapsed time.
6. Use a fresh package for every lab. Avoid changes to `CL-USER` beyond loading the lab system.
7. Prefer project-local ASDF systems and dependencies. Do not mutate a user's global Quicklisp setup.
8. Bound every probe. Recursive and relational examples need a finite input domain, answer limit, timeout, or all three.
9. Classify every observed capability as `native`, `adapter`, `implement`, `external-runtime`, or `absent-from-probe`.

The reference date is 2026-08-28. Verify versions only when the task depends on a newer release.
