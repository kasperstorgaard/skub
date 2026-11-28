---
name: Saana
slug: saana
createdAt: 2026-07-22T19:29:10.294Z
difficulty: hard
minMoves: 10
source: generated
genOptions:
  wallsRange:
    - 8
    - 25
  blockersRange:
    - 3
    - 8
  wallSpread: spread
  symmetry: 0.8
  targetMoves: 10
generatorVersion: 0.7.0
scoring:
  score: 0.4825
  mean: 0.4825
  min: 0.4825
  stddev: 0
  metrics:
    setupRatio: 0.5
    coverage: 0.1719
    deception: 1
    reversals: 2
    crossTrailOverlap: 8
    totalDistance: 31
    pieceUsage: 8
    stopWeighted: 23
    pointlessClearance: 0
    sameDirectionRepeat: 1
    openingSetup: 2
    uniqueSolutions: 2
    wallUtilization: 0.1875
    deadSpace: 0.6719
    puckPathVariety: 0.5
    clumping: 0.1301
    emptyRegion: 0.1563
    wallSymmetry: 0.75
    firstMovePrecision: 0.5
    searchProfile: 0.8325
    isolationGap: 0
    nearMissCount: 0
  solutions:
    - moves: H4H6-G6A6-C8C6-C5F5-A6B6-C6C1-H6C6-C1C5-E5-E4
      score: 0.4825
      metrics:
        setupRatio: 0.5
        coverage: 0.1719
        deception: 1
        reversals: 2
        crossTrailOverlap: 8
        totalDistance: 31
        pieceUsage: 8
        stopWeighted: 23
        pointlessClearance: 0
        sameDirectionRepeat: 1
        openingSetup: 2
        uniqueSolutions: 2
        wallUtilization: 0.1875
        deadSpace: 0.6719
        puckPathVariety: 0.5
        clumping: 0.1301
        emptyRegion: 0.1563
        wallSymmetry: 0.75
        firstMovePrecision: 0.5
        searchProfile: 0.8325
        isolationGap: 0
        nearMissCount: 0
    - moves: H4H6-G6A6-C8C6-C5F5-H6D6-C6C1-A6C6-C1C5-E5-E4
      score: 0.4825
      metrics:
        setupRatio: 0.5
        coverage: 0.1719
        deception: 1
        reversals: 2
        crossTrailOverlap: 8
        totalDistance: 31
        pieceUsage: 8
        stopWeighted: 23
        pointlessClearance: 0
        sameDirectionRepeat: 1
        openingSetup: 2
        uniqueSolutions: 2
        wallUtilization: 0.1875
        deadSpace: 0.6719
        puckPathVariety: 0.5
        clumping: 0.1301
        emptyRegion: 0.1563
        wallSymmetry: 0.75
        firstMovePrecision: 0.5
        searchProfile: 0.8325
        isolationGap: 0
        nearMissCount: 0
  calibrationVersion: 5.0.0
rating: 3.5
reasons:
  - pretty
solutionTags:
  H4H6-G6A6-C8C6-C5F5-A6B6-C6C1-H6C6-C1C5-E5-E4:
    - interesting
    - unique
note: >-
  Pretty, but the solution (2 almost identical) is a bit "railroaded" and with a
  few moves that are unnescessary (eg. would be single moves in other puzzles)
---

```
+ A B C D E F G H +
1    |       |    |
2 _     _ _       |
3       _ _       |
4    |    X  |  # |
5    |# _ _  |    |
6       _     # _ |
7                 |
8     @      |    |
+-----------------+
```
