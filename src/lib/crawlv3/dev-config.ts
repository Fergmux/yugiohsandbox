import type { Crawlv3CatalogConfig } from '@/types/crawlv3'

export const CRAWLV3_DEV_CONFIG: { defaultRoomConfig: Crawlv3CatalogConfig } = {
  defaultRoomConfig: {
    csvUrl:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwWAkxl2JNM8SOhFda9s6R5y3OSw-9Fbf0g63aGHb4hlBbZo11-9whcd7CDYYPew/pub?gid=2145672500&single=true&output=csv',
    headers: {
      id: 'id',
      title: 'name',
      cost: 'cost',
      atk: 'atk',
      def: 'def',
      category: 'category',
      race: 'race',
      damageType: 'type',
      description: 'description',
    },
    imageUrlTemplate: 'https://yugioh-simulator.s3.eu-west-2.amazonaws.com/cards/{id}.png',
    imageOverridesText: '',
    statusCsvUrl:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwWAkxl2JNM8SOhFda9s6R5y3OSw-9Fbf0g63aGHb4hlBbZo11-9whcd7CDYYPew/pub?gid=2084882364&single=true&output=csv',
    statusHeaders: {
      id: 'id',
      name: 'name',
      type: 'type',
      description: 'description',
    },
    defaultLifePoints: 40,
    defaultActionPoints: 2,
  },
}
