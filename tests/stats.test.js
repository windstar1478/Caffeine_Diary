const assert = require("node:assert/strict");
const {
  calculateAverageCutoff,
  calculateSleepDifficultyRates,
} = require("../shared/stats");

// 1. 숙면한 날의 마지막 섭취 시각 평균
assert.equal(
  calculateAverageCutoff([
    { refreshScore: 5, drinks: ["09:00", "14:00"] },
    { refreshScore: 4, drinks: ["10:00", "16:00"] },
    { refreshScore: 2, drinks: ["19:00"] },
    { refreshScore: 5, drinks: [] },
  ]),
  "15:00"
);

// 2. 기록이 없으면 null
assert.equal(calculateAverageCutoff([]), null);

// 3. 숙면한 날이 없으면 null
assert.equal(
  calculateAverageCutoff([
    { refreshScore: 2, drinks: ["14:00"] },
  ]),
  null
);

// 4. 18:00 포함, 미섭취일 포함, 수면 응답 누락일 제외
assert.deepEqual(
  calculateSleepDifficultyRates([
    { drinks: ["18:00"], sleepDifficulty: true },
    { drinks: ["19:00"], sleepDifficulty: false },
    { drinks: ["17:59"], sleepDifficulty: false },
    { drinks: [], sleepDifficulty: false },
    { drinks: ["20:00"] },
  ]),
  {
    after18: { totalDays: 2, difficultDays: 1, rate: 50 },
    noAfter18: { totalDays: 2, difficultDays: 0, rate: 0 },
  }
);

// 5. 기록이 없으면 두 그룹 모두 null
assert.deepEqual(calculateSleepDifficultyRates([]), {
  after18: { totalDays: 0, difficultDays: 0, rate: null },
  noAfter18: { totalDays: 0, difficultDays: 0, rate: null },
});

// 6. 한쪽 그룹만 기록이 있는 경우
assert.deepEqual(
  calculateSleepDifficultyRates([
    { drinks: ["19:00"], sleepDifficulty: true },
  ]),
  {
    after18: { totalDays: 1, difficultDays: 1, rate: 100 },
    noAfter18: { totalDays: 0, difficultDays: 0, rate: null },
  }
);

console.log("통계 함수 테스트 모두 통과!");
