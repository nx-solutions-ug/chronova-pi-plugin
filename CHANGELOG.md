## [1.7.1](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.7.0...v1.7.1) (2026-07-28)


### Bug Fixes

* **ci:** cancel omp-ci workflows when PR is merged ([6d261a8](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/6d261a82839e629e51ddfd8140ebed80cc94cc86))

# [1.7.0](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.6.3...v1.7.0) (2026-07-28)


### Bug Fixes

* include APPROVED state in review thread dedup filter ([239428b](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/239428b843ce1d3b67ce2ce57dd6d38c5e87f487))


### Features

* add eyes reaction to /omp trigger comments ([f88fe2d](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/f88fe2d724585f579ae801d5b2c362f6fc3c157c))

## [1.6.3](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.6.2...v1.6.3) (2026-07-28)


### Bug Fixes

* resolve review threads and approve PR when all findings addressed ([cea0fc9](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/cea0fc9f1863fcf86b108a53e543f3c9b6170617))

## [1.6.2](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.6.1...v1.6.2) (2026-07-27)


### Bug Fixes

* **omp:** ensure /omp PR commands commit and push changes ([#85](https://github.com/nx-solutions-ug/chronova-pi-plugin/issues/85)) ([c5641b2](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/c5641b26e905098c358fc8968a8c6550ee229ace)), closes [nx-solutions-ug/chronova#637](https://github.com/nx-solutions-ug/chronova/issues/637)

## [1.6.1](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.6.0...v1.6.1) (2026-07-26)


### Bug Fixes

* update actions/checkout to v7 in vouch-manage workflow ([44c2309](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/44c2309c445b86bcd388098c002ca7503e81c23c))

# [1.6.0](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.5.1...v1.6.0) (2026-07-26)


### Bug Fixes

* **issue-76:** prevent stream-log.py from crashing on non-dict args or non-string text ([01d7304](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/01d7304592bec694bd3eae4ba53c304bcc170c23))


### Features

* add lightweight vouch system for PR gating via discussions ([0979c4f](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/0979c4fce142f89bc891c6911b9bc1e9b2c1b4b9))

## [1.5.1](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.5.0...v1.5.1) (2026-07-24)


### Bug Fixes

* crop banner to 3:1 ratio for better README display ([4eff73d](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/4eff73d11b1b5b683efb1d2ceb7f9c8de7f86327))

# [1.5.0](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.4.3...v1.5.0) (2026-07-24)


### Features

* add FLUX 2 Max generated README banner ([f559938](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/f55993823b0b08193ddc923d2232bb3887ff3002))

## [1.4.3](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.4.2...v1.4.3) (2026-07-22)


### Bug Fixes

* resolve mangled paths, invalid category, dropped heartbeats, dead ai-line-changes flag ([50cb780](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/50cb780c8764b937583b6910c4876a811c932d28))

## [1.4.2](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.4.1...v1.4.2) (2026-07-21)


### Bug Fixes

* update wiki ([5362bba](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/5362bbab695ccd65abf48a5fb404720e47084f3d))
* update wiki ([60c6263](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/60c6263423b6274ff741120479a35ee7e9f636b8))

## [1.4.1](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.4.0...v1.4.1) (2026-06-28)


### Bug Fixes

* source plugin and oh-my-pi versions dynamically for User-Agent ([27cea9e](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/27cea9ef5c473c5c25f1579309babd4628259de2))

# [1.4.0](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.3.1...v1.4.0) (2026-06-18)


### Features

* add ESLint configuration matching chronova repo rules ([#13](https://github.com/nx-solutions-ug/chronova-pi-plugin/issues/13)) ([70509a4](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/70509a4232641b2d24245371bdf7ddd84feea3f4))

## [1.3.1](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.3.0...v1.3.1) (2026-05-25)


### Bug Fixes

* **ci:** update OMP auth to use source install + sqlite3 injection ([8093428](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/80934280321da4166bb6653ac9eee00e3b0c3f77))
* **ci:** update OMP CI auth to use source install + sqlite3 injection ([e57bb42](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/e57bb424909ee27647031012c20c697595feddc6))

# [1.3.0](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.2.2...v1.3.0) (2026-05-22)


### Features

* **ci:** delete stale dependency summary comments and link Renovate Dashboard ([04a00ad](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/04a00ad0dfc578edc64b715198c263f345e5bf6d))

## [1.2.2](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.2.1...v1.2.2) (2026-05-22)


### Bug Fixes

* add label-skip pre-check and run label-pr on synchronize/ready_for_review ([bbbbbc7](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/bbbbbc7deab669b503d8e10bd5ed5bcfce8d12a7))
* strengthen skip check - never comment, stop immediately when labels exist ([232c811](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/232c811582f8d0bdf5dffaba8c8d18de1643e748))

## [1.2.1](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.2.0...v1.2.1) (2026-05-22)


### Bug Fixes

* add dedup check to review-pr command to prevent duplicate comments ([4f69bab](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/4f69bab5d158d1fd4555c7013238a2383befef0c))

# [1.2.0](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.1.0...v1.2.0) (2026-05-21)


### Features

* **ci:** use chronova-agent GitHub App token instead of GITHUB_TOKEN ([d7b229b](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/d7b229b909c8a76c6f245ebd88e5610f98034419))

# [1.1.0](https://github.com/nx-solutions-ug/chronova-pi-plugin/compare/v1.0.0...v1.1.0) (2026-05-21)


### Features

* **ci:** add OMP workflows for issue triage, PR labeling, and PR review ([243cdb0](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/243cdb0f8a33f437ecb1ae4578acc64506bc6505))

# 1.0.0 (2026-05-21)


### Bug Fixes

* heartbeats not firing ([d9194a8](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/d9194a86b401f4539aa3831c5dd9add32d2051bf))
* simplify release workflow — semantic-release only, no app token required ([da2eeff](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/da2eeffd8c6e291ad8fbbc89fb32bca1a5e3ec5b))


### Features

* add npm publishing config and CI/CD workflows ([85d495d](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/85d495d45abd42d9f66c82586eba88b5baeca0f7))
* initial release of chronova-pi-plugin ([74d8009](https://github.com/nx-solutions-ug/chronova-pi-plugin/commit/74d80098a62865242c2116cc7a0f6737415d78a1))
