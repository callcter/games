/**
 * 小树游戏屋 Game UI Design Tokens
 *
 * 游戏内容可以有自己的视觉语言，但“应用级操作”必须来自这里：
 * 返回 / 声音 / 难度 / 撤销 / 提示 / 重开 / Dialog / Toast 等。
 *
 * 禁止游戏自行复制一份“差不多”的 forest / cream / honey。
 */
export const GAME_UI = {
  colors: {
    forest: 0x285c50,
    forestDark: 0x19483f,
    cream: 0xfff7dd,
    creamLight: 0xfffff4,
    honey: 0xe7b45e,
    honeyDark: 0xb67a35,
    coral: 0xe8755f,
    cocoa: 0x684a34,
    sage: 0x92ad79,
    sky: 0x66bfe3,
    ink: 0x244c43,
    text: 0x5a4939,
    disabled: 0x9a8d7c
  },

  alpha: {
    softBorder: 0.72,
    panel: 0.985,
    disabled: 0.46
  },

  radius: {
    iconButton: 32,
    tool: 21,
    mode: 28,
    chip: 18,
    dialog: 42
  },

  size: {
    iconButton: 64,
    iconGlyph: 30,
    toolWidth: 144,
    toolHeight: 60,
    modeWidth: 176,
    modeHeight: 58,
    chipWidth: 110,
    chipHeight: 38
  },

  depth: {
    chrome: 400,
    toast: 520,
    dialog: 600
  },

  shadow: {
    iconY: 6,
    buttonY: 7,
    dialogY: 12
  },

  motion: {
    pressMs: 55,
    releaseMs: 115,
    toastMs: 150,
    dialogMs: 270,
    pressedPush: 4
  },

  layout: {
    designWidth: 768,
    edgeX: 58,
    toolGap: 162
  },

  font: {
    family: 'Avenir Next, PingFang SC, sans-serif',
    toolSize: 18,
    modeSize: 20,
    chipSize: 16,
    dialogTitleSize: 35,
    dialogBodySize: 17
  }
} as const

export const GAME_UI_FONT = GAME_UI.font.family
