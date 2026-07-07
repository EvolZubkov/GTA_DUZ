// import.meta.env.BASE_URL — путь деплоя (Vite подставляет '/' в dev и, для
// GitHub Pages project-сайта, '/GTA_DUZ/' в проде, см. vite.config.js base).
// Жёстко зашитый '/citykit/' работал только потому, что раньше сайт всегда
// был на корне домена — на Pages-поддиректории такой абсолютный путь мимо
// base уводил бы запрос на несуществующий /citykit/ на корне домена.
export const MODEL_BASE = `${import.meta.env.BASE_URL}citykit/`;

export const CITYKIT = {
  buildings: [
    'Building_Small_1.gltf',
    'Building_Medium_2_001.gltf',
    'Building_Large_2.gltf'
  ],
  roads: {
    asphalt: 'Street_Asphalt_9x9.gltf',
    road2: 'Street_2Lane.gltf',
    road4: 'Street_4Lane.gltf',
    cross: 'Street_4WayIntersection.gltf',
    t: 'Street_TIntersection.gltf'
  },
  props: {
    planter: 'Prop_Planter_Single.gltf',
    bollard: 'Prop_Bollard.gltf',
    manhole: 'Prop_ManholeCover.gltf',
    ac: 'Prop_ACUnit.gltf'
  },
  sidewalks: {
    straight: 'Sidewalk_Straight_3m.gltf',
    cornerFlat: 'Sidewalk_Corner_Flat_3m.gltf',
    cornerRound: 'Sidewalk_Corner_Round_3m.gltf',
    planter: 'Sidewalk_Planter.gltf'
  },
  decals: {
    brokenLine: 'Decal_BrokenLine_Straight.gltf',
    doubleYellow: 'Decal_DoubleYellow_Straight.gltf',
    crosswalk: 'Decal_Crosswalk.gltf',
    stop: 'Decal_Stop.gltf'
  },

  // Модульные детали фасадов (Downtown City MegaKit) для BuildingGenerator.
  // Сетка: 2м по ширине модуля, 3м на этаж.
  parts: {
    wall: {
      brick: {
        plain: 'Brick_Plain_3.gltf',
        plainGround: 'Brick_Plain_4.gltf',
        windowSquare: 'Brick_Window_Square_Single.gltf',
        windowTrim: 'Brick_Window_Trim.gltf',
        insetWindow2m: 'Brick_Inset_Window.gltf',
        doubleWindow2m: 'Brick_RedWhite_DoubleWindow.gltf'
      },
      metal: {
        plain: 'Metal_Plain_3.gltf',
        window: 'Metal_FullWindow.gltf',
        firstFloorWall: 'Metal_FirstFloor_Wall.gltf',
        firstFloorWindow: 'Metal_FirstFloor_Window.gltf'
      },
      filler: {
        half: 'Brick_Plain_1.gltf',
        halfMetal: 'Metal_Plain_1.gltf'
      }
    },
    corner: {
      brick: 'Brick_Corner_Plain.gltf',
      // У metal-стиля нет отдельного углового куска — используем нейтральный Trim.
      trim: 'Trim_Corner.gltf'
    },
    cornice: {
      brick: {
        center: 'Cornice_Brick_Center.gltf',
        angleL: 'Cornice_Brick_90Angle_L.gltf',
        angleR: 'Cornice_Brick_90Angle_R.gltf'
      },
      metal: {
        center: 'Cornice_Metal_Center.gltf',
        angleL: 'Cornice_Metal_90Angle_L.gltf',
        angleR: 'Cornice_Metal_90Angle_R.gltf'
      },
      topTrim: 'Brick_TopTrim.gltf',
      bottomTrim: 'Brick_BottomTrim.gltf'
    },
    door: {
      frameWooden: 'DoorFrame_Wooden.gltf',
      panel1: 'Door_1.gltf',
      panel2: 'Door_2.gltf',
      panel3: 'Door_3.gltf'
    },
    entrance: {
      concrete2x2: 'Entrance_Concrete_2x2.gltf'
    },
    stairs: {
      entrance: 'Stairs_Entrance_Concrete.gltf',
      rails: 'Stairs_Rails_Metal.gltf'
    },
    floor: {
      small: 'Floor_2x2.gltf',
      large: 'Floor_4x4.gltf'
    },
    roof: {
      flat: {
        small: 'Roof_2x2.gltf',
        large: 'Roof_4x4.gltf'
      },
      mansard: {
        center: 'Roof_Slate_Center.gltf',
        corner: 'Roof_Slate_Corner.gltf'
      }
    }
  }
};
