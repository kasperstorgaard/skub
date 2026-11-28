---
name: Camilla
slug: camilla
createdAt: 2026-07-22T19:29:10.294Z
difficulty: hard
minMoves: 10
source: generated
promotedAs: camilla
genOptions:
  wallsRange:
    - 6
    - 17
  blockersRange:
    - 2
    - 7
  wallSpread: spread
  symmetry: 0.55
  targetMoves: 10
generatorVersion: 0.7.0
scoring:
  score: 0.4378
  mean: 0.4378
  min: 0.423
  stddev: 0.0126
  metrics:
    setupRatio: 0.5
    coverage: 0.4219
    deception: 9
    reversals: 2
    crossTrailOverlap: 18
    totalDistance: 53
    pieceUsage: 6.1699
    stopWeighted: 19
    pointlessClearance: 0
    sameDirectionRepeat: 0
    openingSetup: 0
    uniqueSolutions: 4
    wallUtilization: 0.2727
    deadSpace: 0.25
    puckPathVariety: 0.75
    clumping: 0.1786
    emptyRegion: 0.6406
    wallSymmetry: 0.8182
    firstMovePrecision: 0.2
    searchProfile: 0.726
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: E4A4-A8-B7B1-H8B8-B2-A8H8-B1A1-A8-H8B8-B3
      score: 0.4275
      metrics:
        setupRatio: 0.5
        coverage: 0.3125
        deception: 9
        reversals: 1
        crossTrailOverlap: 18
        totalDistance: 52
        pieceUsage: 6.1699
        stopWeighted: 18
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.2727
        deadSpace: 0.25
        puckPathVariety: 0.75
        clumping: 0.1786
        emptyRegion: 0.6406
        wallSymmetry: 0.8182
        firstMovePrecision: 0.2
        searchProfile: 0.726
        isolationGap: 0
        nearMissCount: 0
    - moves: E4A4-B7B1-H1-H8H2-H1A1-A3-A4A8-H8-H3-B3
      score: 0.423
      metrics:
        setupRatio: 0.5
        coverage: 0.4219
        deception: 9
        reversals: 1
        crossTrailOverlap: 8
        totalDistance: 53
        pieceUsage: 5.9773
        stopWeighted: 18
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.2727
        deadSpace: 0.25
        puckPathVariety: 0.75
        clumping: 0.1786
        emptyRegion: 0.6406
        wallSymmetry: 0.8182
        firstMovePrecision: 0.2
        searchProfile: 0.726
        isolationGap: 0
        nearMissCount: 0
    - moves: E4F4-F1-H8A8-A1-F1B1-B7B2-G2-B1B8-G2B2-B8B3
      score: 0.4502
      metrics:
        setupRatio: 0.5
        coverage: 0.25
        deception: 5
        reversals: 2
        crossTrailOverlap: 8
        totalDistance: 49
        pieceUsage: 5.9069
        stopWeighted: 19
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.2727
        deadSpace: 0.25
        puckPathVariety: 0.75
        clumping: 0.1786
        emptyRegion: 0.6406
        wallSymmetry: 0.8182
        firstMovePrecision: 0.2
        searchProfile: 0.726
        isolationGap: 0
        nearMissCount: 0
    - moves: E4F4-H8H1-A1-F4F1-B1-B7B2-G2-B1B8-G2B2-B8B3
      score: 0.4502
      metrics:
        setupRatio: 0.5
        coverage: 0.25
        deception: 5
        reversals: 2
        crossTrailOverlap: 12
        totalDistance: 49
        pieceUsage: 5.9069
        stopWeighted: 19
        pointlessClearance: 0
        sameDirectionRepeat: 0
        openingSetup: 0
        uniqueSolutions: 4
        wallUtilization: 0.2727
        deadSpace: 0.25
        puckPathVariety: 0.75
        clumping: 0.1786
        emptyRegion: 0.6406
        wallSymmetry: 0.8182
        firstMovePrecision: 0.2
        searchProfile: 0.726
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
rating: 4
reasons:
  - pretty
solutionTags:
  E4A4-B7B1-H1-H8H2-H1A1-A3-A4A8-H8-H3-B3:
    - interesting
    - unique
  E4A4-A8-B7B1-H8B8-B2-A8H8-B1A1-A8-H8B8-B3:
    - interesting
  E4F4-F1-H8A8-A1-F1B1-B7B2-G2-B1B8-G2B2-B8B3:
    - boring
  E4F4-H8H1-A1-F4F1-B1-B7B2-G2-B1B8-G2B2-B8B3:
    - boring
note: >-
  lower left wall added could make it prettier, not sure what it would do to
  solutions though
---

```
+ A B C D E F G H +
1                 |
2  |           |  |
3   X   _ _       |
4       _ @  |    |
5    |  _ _  |    |
6                 |
7   #          |  |
8               # |
+-----------------+
```
