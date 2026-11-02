# ORBIT validation report

Validation performed in the build environment on 2026-11-02.

## Passed

- `node --check backend/src/server.js`
- `node --check backend/src/deadlock.js`
- `node --check backend/src/scheduler.js`
- `node --check backend/src/routes/auth.js`
- `python scheduler/test_scheduler.py`: 5 tests passed. The test suite compiles the C scheduler into a temporary directory before testing.
- `python scheduler/test_deadlock.py`: 3 tests passed. The test suite compiles the C Banker checker into a temporary directory before testing.
- Direct Node-to-C smoke test of `runBanker()` returned safe sequence `2, 4, 5, 1, 3` for the classic five-process, three-resource example.
- Both C programs compiled with GCC using `-std=c11 -O2 -Wall -Wextra -pedantic`.

## Not verified in this environment

- Frontend production build: dependency installation did not complete within the available execution window, so `vite build` was not run.
- Live MySQL schema/migration execution and API integration tests.
- Concurrent booking behaviour against a real MySQL server.
- Browser end-to-end tests.
- Email delivery, password reset, and email verification. These require a configured mail provider and are not implemented in this package.
- Multi-resource deadlock detection and recovery. Current booking schema represents one resource per booking; the Banker monitor is a single-resource-type safety model.

Do not interpret the passed C/unit checks as proof of production readiness. Run the remaining checks on the target Windows/MySQL environment before replacing the working project.
