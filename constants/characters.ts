import type { ImageSourcePropType } from 'react-native';

export type Character = {
  id: string;
  name: string;
  image: ImageSourcePropType;
  /** 구매에 필요한 코인. 0 = 기본 캐릭터 (무료) */
  price: number;
};

export const CHARACTERS: Character[] = [
  {
    id: 'mulbeom',
    name: '물범',
    image: require('../assets/characters/mulbeom.png'),
    price: 0,
  },
  {
    id: 'sudal',
    name: '수달',
    image: require('../assets/characters/sudal.png'),
    price: 200,
  },
  {
    id: 'belluga',
    name: '벨루가',
    image: require('../assets/characters/belluga.png'),
    price: 200,
  },
  {
    id: 'haepari',
    name: '해파리',
    image: require('../assets/characters/jellyfish.png'),
    price: 200,
  },
  {
    id: 'turtle',
    name: '거북이',
    image: require('../assets/characters/turtle.png'),
    price: 500,
  },
  {
    id: 'bokeo',
    name: '복어',
    image: require('../assets/characters/bokeo.png'),
    price: 500,
  },
];

export const DEFAULT_CHARACTER_ID = 'mulbeom';

export function getCharacterById(id: string): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
