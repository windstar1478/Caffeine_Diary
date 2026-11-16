// 개운함 4점 이상인 날의 마지막 카페인 섭취 시각 평균 계산
// drinks에는 카페인이 있는 음료의 섭취 시각을 넣습니다.
function calculateAverageCutoff(dailyRecords) {
  const cutoffMinutes = [];

  for (const day of dailyRecords) {
    if (day.refreshScore < 4 || day.drinks.length === 0) {
      continue;
    }

    const times = day.drinks.map((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    });

    // 그날 마지막으로 마신 시각
    cutoffMinutes.push(Math.max(...times));
  }

  if (cutoffMinutes.length === 0) {
    return null;
  }

  const total = cutoffMinutes.reduce((sum, value) => sum + value, 0);
  const average = Math.round(total / cutoffMinutes.length);

  const hours = String(Math.floor(average / 60)).padStart(2, "0");
  const minutes = String(average % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
}

// 18:00 이상 섭취 여부별 입면 어려움 비율 계산
// sleepDifficulty: true = 어려웠음, false = 어렵지 않았음
// 수면 응답이 없는 날은 집계에서 제외합니다.
function calculateSleepDifficultyRates(dailyRecords) {
  const groups = {
    after18: { totalDays: 0, difficultDays: 0 },
    noAfter18: { totalDays: 0, difficultDays: 0 },
  };

  for (const day of dailyRecords) {
    if (typeof day.sleepDifficulty !== "boolean") {
      continue;
    }

    const hasLateDrink = day.drinks.some((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes >= 18 * 60;
    });

    const group = hasLateDrink ? groups.after18 : groups.noAfter18;
    group.totalDays += 1;

    if (day.sleepDifficulty) {
      group.difficultDays += 1;
    }
  }

  for (const group of Object.values(groups)) {
    group.rate = group.totalDays === 0
      ? null
      : Math.round((group.difficultDays / group.totalDays) * 1000) / 10;
  }

  return groups;
}

// 다른 파일에서 두 함수를 불러올 수 있도록 내보내기
module.exports = {
  calculateAverageCutoff,
  calculateSleepDifficultyRates,
};
