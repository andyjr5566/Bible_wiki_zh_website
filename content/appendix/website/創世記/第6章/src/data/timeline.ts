import type { Fact } from './types';

/**
 * 洪水的日子。`day` 是從洪水開始（600 歲 2 月 17 日）算起的第幾天，
 * 用 GT 拾穗資料「一個月三十天」的假設換算，只用來排版位置。
 * 經文明寫日期的標 explicit；照天數推算出來的標 interpretation（GT 拾穗）。
 */
export interface Day {
  date: string;
  day: number;
  what: Fact;
  /** 水位示意 0–1（畫圖用，不是資料） */
  water: number;
}

const m = (month: number, d: number, year = 600) => (year - 600) * 360 + (month - 2) * 30 + (d - 17);

export const DAYS: Day[] = [
  { date: '600 歲 2 月 17 日', day: m(2, 17), water: 0.05, what: { text: '洪水開始', status: 'explicit', refs: ['創7:11'], q: '二月十七日那一天，大淵的泉源都裂開了' } },
  { date: '3 月 26 日', day: m(3, 26), water: 0.82, what: { text: '四十晝夜的大雨下完', status: 'interpretation', refs: ['創7:12', '創7:17'] } },
  { date: '7 月 16 日', day: m(7, 16), water: 1, what: { text: '水勢浩大滿一百五十天', status: 'interpretation', refs: ['創7:24', '創8:3'] } },
  { date: '7 月 17 日', day: m(7, 17), water: 0.93, what: { text: '方舟停在亞拉臘山上', status: 'explicit', refs: ['創8:4'], q: '七月十七日，方舟停在亞拉臘山上' } },
  { date: '10 月 1 日', day: m(10, 1), water: 0.62, what: { text: '山頂現出來', status: 'explicit', refs: ['創8:5'], q: '到十月初一日，山頂都現出來了' } },
  { date: '11 月 10 日', day: m(11, 10), water: 0.45, what: { text: '過了四十天，開窗放出烏鴉', status: 'interpretation', refs: ['創8:6-7'] } },
  { date: '11 月 17 日', day: m(11, 17), water: 0.4, what: { text: '放出鴿子，飛回來了', status: 'interpretation', refs: ['創8:8-9'] } },
  { date: '11 月 24 日', day: m(11, 24), water: 0.34, what: { text: '鴿子叼回橄欖葉', status: 'interpretation', refs: ['創8:10-11'] } },
  { date: '12 月 1 日', day: m(12, 1), water: 0.26, what: { text: '鴿子不再回來', status: 'interpretation', refs: ['創8:12'] } },
  { date: '601 歲 1 月 1 日', day: m(1, 1, 601), water: 0.08, what: { text: '地面上的水乾了，撤去方舟的蓋', status: 'explicit', refs: ['創8:13'], q: '到挪亞六百零一歲，正月初一日，地上的水都乾了' } },
  { date: '2 月 27 日', day: m(2, 27, 601), water: 0, what: { text: '地都乾了，出方舟', status: 'explicit', refs: ['創8:14'], q: '到了二月二十七日，地就都乾了' } },
];

export const DAYS_NOTE = '沒有標「經文明說」的日期，是 GT 拾穗資料假設一個月三十天推算出來的；水位線只是示意。';
