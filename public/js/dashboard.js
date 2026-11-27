document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('section-dashboard');
  if (!section) return;
  const byId = (id) => document.getElementById(id);
  const select = byId('dashboard-week-select');
  const sampleButton = byId('apply-sample-btn');
  const actualButton = byId('show-actual-btn');
  let weeks = [];
  let requestId = 0;

  function displayRate(group, rateId, countId) {
    byId(rateId).textContent = group.rate === null ? '데이터 부족' : `${group.rate}%`;
    byId(countId).textContent = `${group.totalDays}일 중 ${group.difficultDays}일 어려움`;
  }

  function renderWeek() {
    const week = weeks[Number(select.value)];
    if (!week) return;
    byId('average-cutoff').textContent = week.averageCutoff || '데이터 부족';
    displayRate(week.difficultyRates.after18, 'late-rate', 'late-count');
    displayRate(week.difficultyRates.noAfter18, 'early-rate', 'early-count');
    const body = byId('dashboard-table-body');
    body.replaceChildren();
    for (const day of week.days) {
      const row = document.createElement('tr');
      for (const value of [day.date, day.caffeineMg, `${day.refreshScore}점`, day.sleepDifficulty ? '있음' : '없음']) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      body.append(row);
    }
    drawChart(week.days);
  }

  // 외부 라이브러리 없이 SVG로 그려 네트워크 없이도 시연 가능합니다.
  function drawChart(days) {
    const ns = 'http://www.w3.org/2000/svg';
    function element(tag, attributes, text) {
      const node = document.createElementNS(ns, tag);
      for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
      if (text !== undefined) node.textContent = text;
      return node;
    }
    const svg = element('svg', { viewBox: '0 0 600 300', role: 'img', 'aria-labelledby': 'weekly-chart-title weekly-chart-desc' });
    svg.append(element('title', { id: 'weekly-chart-title' }, '주간 카페인 섭취량과 다음 날 개운함'));
    svg.append(element('desc', { id: 'weekly-chart-desc' }, '파란 막대는 일일 섭취량, 초록 점은 다음 날 개운함입니다. 정확한 수치는 아래 날짜별 수치 보기에서 확인하세요.'));
    const left = 48, top = 28, width = 500, height = 220;
    const maxMg = Math.max(400, Math.ceil(Math.max(...days.map((day) => day.caffeineMg)) / 100) * 100);
    for (let tick = 0; tick <= 5; tick++) {
      const y = top + height - height * tick / 5;
      svg.append(element('line', { x1: left, x2: left + width, y1: y, y2: y, stroke: '#e2e8f0' }));
      svg.append(element('text', { x: left - 8, y: y + 4, 'text-anchor': 'end' }, Math.round(maxMg * tick / 5)));
      if (tick > 0) svg.append(element('text', { x: left + width + 12, y: y + 4 }, tick));
    }
    svg.append(element('text', { x: left, y: 16 }, 'mg'));
    svg.append(element('text', { x: left + width + 12, y: 16 }, '점'));
    days.forEach((day, index) => {
      const x = left + (index + .5) * width / days.length;
      const barHeight = day.caffeineMg / maxMg * height;
      const bar = element('rect', { x: x - 17, y: top + height - barHeight, width: 34, height: barHeight, rx: 4, fill: '#3b82f6' });
      bar.append(element('title', {}, `${day.date}: ${day.caffeineMg}mg`));
      const dotY = top + height - day.refreshScore / 5 * height;
      const dot = element('circle', { cx: x, cy: dotY, r: 6, fill: '#0f766e', stroke: 'white', 'stroke-width': 2 });
      dot.append(element('title', {}, `${day.sleepDate} 개운함: ${day.refreshScore}점`));
      svg.append(bar, dot);
      svg.append(element('text', { x, y: Math.max(20, top + height - barHeight - 7), 'text-anchor': 'middle', class: 'chart-value' }, day.caffeineMg));
      svg.append(element('text', { x, y: 274, 'text-anchor': 'middle' }, day.date.slice(5).replace('-', '/')));
    });
    byId('weekly-chart').replaceChildren(svg);
  }

  async function loadStatistics(source) {
    const currentRequest = ++requestId;
    sampleButton.disabled = actualButton.disabled = true;
    byId('dashboard-status').textContent = '통계를 불러오는 중입니다.';
    // 데이터 출처가 바뀌면 이전 결과를 먼저 숨겨 혼동을 방지합니다.
    byId('dashboard-content').hidden = true;
    try {
      const response = await fetch(`/api/statistics?source=${source}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '통계 조회 실패');
      if (currentRequest !== requestId) return;
      weeks = data.weeks;
      byId('dashboard-source').textContent = data.source === 'sample' ? '샘플 · 가상 데이터' : '실제 기록';
      byId('dashboard-source').classList.toggle('is-sample', data.source === 'sample');
      actualButton.hidden = data.source !== 'sample';
      byId('dashboard-status').textContent = data.message;
      select.replaceChildren();
      weeks.forEach((week, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${week.startDate} ~ ${week.endDate}`;
        select.append(option);
      });
      if (weeks.length) {
        select.value = String(weeks.length - 1);
        renderWeek();
        byId('dashboard-content').hidden = false;
      }
    } catch (error) {
      if (currentRequest !== requestId) return;
      byId('dashboard-status').textContent = error.message;
    } finally {
      if (currentRequest === requestId) sampleButton.disabled = actualButton.disabled = false;
    }
  }

  sampleButton.addEventListener('click', () => loadStatistics('sample'));
  actualButton.addEventListener('click', () => loadStatistics('actual'));
  select.addEventListener('change', renderWeek);
  loadStatistics('actual');
});
