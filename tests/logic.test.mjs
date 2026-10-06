import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TOPICS, newDeviceId, snapshot, groupTopics, feedbackFor, groupCopyText, shareCards } from '../logic.js';
import { loadServer } from './fake-gas.mjs';

test('화면 기본 주제 목록은 서버 setup 목록과 같다', () => {
  assert.deepEqual(loadServer().get({ action: 'topics' }).topics, DEFAULT_TOPICS);
});

test('기기 ID는 서버 검사 규칙을 통과한다', () => {
  for (let i = 0; i < 500; i++) assert.match(newDeviceId(), /^[a-z0-9]{8,40}$/);
});

test('snapshot은 이름과 칸 내용이 같을 때만 같다', () => {
  assert.equal(snapshot('a', ['x', '']), snapshot('a', ['x', '']));
  assert.notEqual(snapshot('a', ['x', '']), snapshot('b', ['x', '']));
  assert.notEqual(snapshot('a', ['x', '']), snapshot('a', ['x ', '']));
});

test('groupTopics는 조 5개에 주제 2개씩, 순서를 지킨다', () => {
  const groups = groupTopics(DEFAULT_TOPICS);
  assert.deepEqual(groups.map((g) => g.group), ['형제1조', '형제2조', '형제3조', '자매1조', '자매2조']);
  assert.deepEqual(groups.map((g) => g.topics.map((t) => t.id)), [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]);
});

const entry = (name, byIndex) => ({ name, clientTime: 1, answers: Object.assign(Array(10).fill(''), byIndex) });

test('feedbackFor는 빈 칸을 빼고, 이름이 없으면 익명, 줄바꿈을 정리한다', () => {
  const entries = [entry('', { 0: '  좋았어요 ' }), entry('민지', { 0: '첫 줄\r\n둘째 줄' }), entry('준호', { 1: '다른 주제' })];
  assert.deepEqual(feedbackFor(DEFAULT_TOPICS[0], entries), [
    { name: '익명', text: '좋았어요' },
    { name: '민지', text: '첫 줄\n둘째 줄' },
  ]);
});

test('groupCopyText는 이름 없이 조별 문구를 만든다', () => {
  const [first] = groupTopics(DEFAULT_TOPICS);
  const entries = [entry('민지', { 0: '예시가 좋았어요' }), entry('', { 0: '첫 줄\n둘째 줄' })];
  assert.equal(groupCopyText(first, entries), [
    '[형제1조 피드백]',
    '',
    '1. 파스칼의 내기 (발표: 형제1)',
    '- 예시가 좋았어요',
    '- 첫 줄',
    '  둘째 줄',
    '',
    '2. 홍해의 기적 (발표: 형제2)',
    '(피드백 없음)',
  ].join('\n'));
});

test('shareCards는 작성자 이름 없이 내용과 기존 주제 표기를 반환한다', () => {
  const entries = [entry('민지', { 0: '  예시가 좋았어요  ' }), entry('', { 0: '첫 줄\r\n둘째 줄' })];
  const [card] = shareCards(DEFAULT_TOPICS, entries);
  assert.deepEqual(card, {
    group: '형제1조',
    items: [
      { label: '1. 파스칼의 내기 (발표: 형제1)', count: 2, texts: ['예시가 좋았어요', '첫 줄\n둘째 줄'] },
      { label: '2. 홍해의 기적 (발표: 형제2)', count: 0, texts: [] },
    ],
  });
  assert.equal(JSON.stringify(card).includes('민지'), false);
  assert.equal(JSON.stringify(card).includes('익명'), false);
});

test('shareCards는 빈 칸을 제외하고 피드백 없는 주제도 count 0으로 남긴다', () => {
  const cards = shareCards(DEFAULT_TOPICS, [entry('작성자', { 0: ' \r\n\t ', 1: '의견' })]);
  assert.deepEqual(cards[0].items.map(({ count, texts }) => ({ count, texts })), [
    { count: 0, texts: [] }, { count: 1, texts: ['의견'] },
  ]);
  assert.ok(shareCards(DEFAULT_TOPICS, []).every((card) => card.items.every((item) => item.count === 0 && item.texts.length === 0)));
});

test('shareCards는 전달받은 조와 주제 순서를 유지하며 입력을 바꾸지 않는다', () => {
  const topics = [DEFAULT_TOPICS[8], DEFAULT_TOPICS[9], DEFAULT_TOPICS[0], DEFAULT_TOPICS[1]];
  const entries = [entry('작성자', { 8: '마지막 조 의견' })];
  const before = JSON.stringify({ topics, entries });
  const cards = shareCards(topics, entries);
  assert.deepEqual(cards.map((card) => card.group), ['자매2조', '형제1조']);
  assert.deepEqual(cards[0].items.map((item) => item.label), ['9. 닭이 먼저냐 알이 먼저냐 (발표: 자매1)', '10. 666표 (발표: 자매2)']);
  assert.equal(JSON.stringify({ topics, entries }), before);
  assert.deepEqual(shareCards([], entries), []);
});
