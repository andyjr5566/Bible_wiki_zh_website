/** 3D 模型的來源與授權。動物模型都從 poly.pizza 下載，再用 Blender 精簡動畫和貼圖。 */
export interface Credit {
  file: string;
  title: string;
  author: string;
  license: 'CC0' | 'CC-BY 3.0' | '本站自製';
  url: string;
}

export const LICENSES = {
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC-BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
};

const pp = (id: string) => `https://poly.pizza/m/${id}`;

export const CREDITS: Credit[] = [
  { file: 'horse', title: 'Horse', author: 'Quaternius', license: 'CC0', url: pp('qvTrSG9pZF') },
  { file: 'horse_w', title: 'White Horse', author: 'Quaternius', license: 'CC0', url: pp('bEdE4rmZy9') },
  { file: 'donkey', title: 'Donkey', author: 'Quaternius', license: 'CC0', url: pp('qmX6nhnvp7') },
  { file: 'cow', title: 'Cow', author: 'Quaternius', license: 'CC0', url: pp('26zM1outCr') },
  { file: 'bull', title: 'Bull', author: 'Quaternius', license: 'CC0', url: pp('a8PIIYwF7r') },
  { file: 'sheep', title: 'Sheep', author: 'Quaternius', license: 'CC0', url: pp('rgJXF570ZK') },
  { file: 'deer', title: 'Deer', author: 'Quaternius', license: 'CC0', url: pp('T6Cs7tmMHJ') },
  { file: 'stag', title: 'Stag', author: 'Quaternius', license: 'CC0', url: pp('tQdzbZ1Cmw') },
  { file: 'wolf', title: 'Wolf', author: 'Quaternius', license: 'CC0', url: pp('P1gU3Qkr9r') },
  { file: 'fox', title: 'Fox', author: 'Quaternius', license: 'CC0', url: pp('Bc97C66HKi') },
  { file: 'alpaca', title: 'Alpaca', author: 'Quaternius', license: 'CC0', url: pp('bCVFD48i2l') },
  { file: 'pig', title: 'Pig', author: 'Quaternius', license: 'CC0', url: pp('u35l6uP5vj') },
  { file: 'chicken', title: 'Chicken', author: 'Quaternius', license: 'CC0', url: pp('Z3RCoCYss4') },
  { file: 'elephant', title: 'Elephant', author: 'Poly by Google', license: 'CC-BY 3.0', url: pp('a27MA0rXyyj') },
  { file: 'giraffe', title: 'Giraffe', author: 'Poly by Google', license: 'CC-BY 3.0', url: pp('80w8kwQU0QH') },
  { file: 'lion', title: 'Lion', author: 'Poly by Google', license: 'CC-BY 3.0', url: pp('3XAJojWxSWz') },
  { file: 'camel', title: 'Camel', author: 'Poly by Google', license: 'CC-BY 3.0', url: pp('7XeLogrxLad') },
];

export const OWN_MODELS = '方舟、烏鴉與鴿子、挪亞一家、祭壇由本站用 Blender 製作（腳本在 scripts/blender/）。';
