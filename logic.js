// 화면과 무관한 계산. 브라우저(app.js, admin.js)와 node 테스트가 함께 쓴다.

export const DEFAULT_TOPICS = [
  { id: 1, group: '형제1조', title: '파스칼의 내기', presenter: '형제1' },
  { id: 2, group: '형제1조', title: '홍해의 기적', presenter: '형제2' },
  { id: 3, group: '형제2조', title: '에덴동산', presenter: '형제1' },
  { id: 4, group: '형제2조', title: '예수님의 부활', presenter: '형제2' },
  { id: 5, group: '형제3조', title: '노아의 방주', presenter: '형제1' },
  { id: 6, group: '형제3조', title: '기독교 질문', presenter: '형제2' },
  { id: 7, group: '자매1조', title: '죽음에 관하여', presenter: '자매1' },
  { id: 8, group: '자매1조', title: '전도서와 허무함', presenter: '자매2' },
  { id: 9, group: '자매2조', title: '닭이 먼저냐 알이 먼저냐', presenter: '자매1' },
  { id: 10, group: '자매2조', title: '666표', presenter: '자매2' },
];

// 서버 검사 규칙 /^[a-z0-9]{8,40}$/ 를 만족한다.
export const newDeviceId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// 마지막으로 보낸 내용과 비교하는 데 쓴다.
export const snapshot = (name, answers) => JSON.stringify({ name, answers });

// 이어지는 같은 조끼리 묶는다: [{ group, topics: [...] }]
export function groupTopics(topics) {
  const groups = [];
  for (const t of topics) {
    const last = groups[groups.length - 1];
    if (last && last.group === t.group) last.topics.push(t);
    else groups.push({ group: t.group, topics: [t] });
  }
  return groups;
}

// 한 주제의 피드백 목록. 빈 칸은 빼고, 이름이 없으면 '익명'.
export function feedbackFor(topic, entries) {
  return entries
    .map((e) => ({
      name: (e.name || '').trim() || '익명',
      text: (e.answers[topic.id - 1] || '').replace(/\r\n?/g, '\n').trim(),
    }))
    .filter((f) => f.text);
}

// 조별 복사 문구. 작성자 이름은 넣지 않는다.
export function groupCopyText(group, entries) {
  const lines = [`[${group.group} 피드백]`];
  for (const t of group.topics) {
    lines.push('', `${t.id}. ${t.title} (발표: ${t.presenter})`);
    const items = feedbackFor(t, entries);
    if (!items.length) lines.push('(피드백 없음)');
    for (const f of items) lines.push(`- ${f.text.split('\n').join('\n  ')}`);
  }
  return lines.join('\n');
}

// 공유 카드와 공개 페이지에 표시할 내용. 이름을 비웠으면 '익명'으로 표시한다.
export function shareCards(topics, entries) {
  return groupTopics(topics).map(({ group, topics: list }) => ({
    group,
    items: list.map((t) => {
      const feedbacks = feedbackFor(t, entries);
      return { label: `${t.id}. ${t.title} (발표: ${t.presenter})`, count: feedbacks.length, feedbacks };
    }),
  }));
}

// 관리자 화면에서 체크한 항목만 공유한다. 키는 '주제 ID:피드백 순서'다.
export function selectedShareCards(topics, entries, selected) {
  const groups = groupTopics(topics);
  return shareCards(topics, entries).map((card, groupIndex) => ({
    group: card.group,
    items: card.items.map((item, topicIndex) => {
      const topicId = groups[groupIndex].topics[topicIndex].id;
      const feedbacks = item.feedbacks.filter((_, index) => selected.has(`${topicId}:${index}`));
      return { label: item.label, count: feedbacks.length, feedbacks };
    }),
  }));
}

// 게시한 항목을 다시 체크한다. 같은 이름·내용이 반복되어도 게시한 개수만 선택한다.
export function publishedSelection(topics, entries, published) {
  const selected = new Set();
  groupTopics(topics).forEach((group, groupIndex) => {
    group.topics.forEach((topic, topicIndex) => {
      const remaining = new Map();
      for (const f of published[groupIndex]?.card.items[topicIndex]?.feedbacks || []) {
        const key = JSON.stringify([f.name, f.text]);
        remaining.set(key, (remaining.get(key) || 0) + 1);
      }
      feedbackFor(topic, entries).forEach((f, index) => {
        const key = JSON.stringify([f.name, f.text]);
        if (!remaining.get(key)) return;
        selected.add(`${topic.id}:${index}`);
        remaining.set(key, remaining.get(key) - 1);
      });
    });
  });
  return selected;
}
