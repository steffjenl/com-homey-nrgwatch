'use strict';

const BaseClient = require('./base-class');

/**
 * Virtual remote mode definitions for Itho ventilation systems.
 * Provides multilingual mode definitions for all supported fan modes.
 * @extends BaseClient
 */
class VirtualRemoteModes extends BaseClient {
  /**
   * Away mode - minimal ventilation when nobody is home
   * @type {Object}
   * @readonly
   */
  static AWAY = {
    id: 'away',
    title: {
      en: 'Away',
      nl: 'Afwezig',
      de: 'Abwesend',
      fr: 'Absent',
      it: 'Assente',
      sv: 'Borta',
      no: 'Borte',
      es: 'Ausente',
      da: 'Væk',
      ru: 'Отсутствие',
      pl: 'Nieobecny',
      ko: '부재중',
    },
  };

  /**
   * Low speed mode - basic ventilation
   * @type {Object}
   * @readonly
   */
  static LOW = {
    id: 'low',
    title: {
      en: 'Low',
      nl: 'Laag',
      de: 'Niedrig',
      fr: 'Bas',
      it: 'Basso',
      sv: 'Låg',
      no: 'Lav',
      es: 'Bajo',
      da: 'Lav',
      ru: 'Низкий',
      pl: 'Niski',
      ko: '낮음',
    },
  };

  /**
   * Medium speed mode - standard ventilation
   * @type {Object}
   * @readonly
   */
  static MEDIUM = {
    id: 'medium',
    title: {
      en: 'Medium',
      nl: 'Middel',
      de: 'Mittel',
      fr: 'Moyen',
      it: 'Medio',
      sv: 'Medium',
      no: 'Middels',
      es: 'Medio',
      da: 'Medium',
      ru: 'Средний',
      pl: 'Średni',
      ko: '중간',
    },
  };

  /**
   * High speed mode - maximum ventilation
   * @type {Object}
   * @readonly
   */
  static HIGH = {
    id: 'high',
    title: {
      en: 'High',
      nl: 'Hoog',
      de: 'Hoch',
      fr: 'Haut',
      it: 'Alto',
      sv: 'Hög',
      no: 'Høy',
      es: 'Alto',
      da: 'Høj',
      ru: 'Высокий',
      pl: 'Wysoki',
      ko: '높음',
    },
  };

  /**
   * Auto mode - automatic speed adjustment based on sensors
   * @type {Object}
   * @readonly
   */
  static AUTO = {
    id: 'auto',
    title: {
      en: 'Auto',
      nl: 'Auto',
      de: 'Auto',
      fr: 'Auto',
      it: 'Auto',
      sv: 'Auto',
      no: 'Auto',
      es: 'Auto',
      da: 'Auto',
      ru: 'Авто',
      pl: 'Auto',
      ko: '자동',
    },
  };

  /**
   * Auto night mode - automatic with reduced speed during night
   * @type {Object}
   * @readonly
   */
  static AUTONIGHT = {
    id: 'autonight',
    title: {
      en: 'Auto Night',
      nl: 'Auto Nacht',
      de: 'Auto Nacht',
      fr: 'Auto Nuit',
      it: 'Auto Notte',
      sv: 'Auto Natt',
      no: 'Auto Natt',
      es: 'Auto Noche',
      da: 'Auto Nat',
      ru: 'Авто Ночь',
      pl: 'Auto Noc',
      ko: '자동 야간',
    },
  };

  /**
   * Timer 1 mode - temporary high speed for predefined duration
   * @type {Object}
   * @readonly
   */
  static TIMER1 = {
    id: 'timer1',
    title: {
      en: 'Timer 1',
      nl: 'Timer 1',
      de: 'Timer 1',
      fr: 'Minuteur 1',
      it: 'Timer 1',
      sv: 'Timer 1',
      no: 'Timer 1',
      es: 'Temporizador 1',
      da: 'Timer 1',
      ru: 'Таймер 1',
      pl: 'Timer 1',
      ko: '타이머 1',
    },
  };

  /**
   * Timer 2 mode - temporary high speed for predefined duration
   * @type {Object}
   * @readonly
   */
  static TIMER2 = {
    id: 'timer2',
    title: {
      en: 'Timer 2',
      nl: 'Timer 2',
      de: 'Timer 2',
      fr: 'Minuteur 2',
      it: 'Timer 2',
      sv: 'Timer 2',
      no: 'Timer 2',
      es: 'Temporizador 2',
      da: 'Timer 2',
      ru: 'Таймер 2',
      pl: 'Timer 2',
      ko: '타이머 2',
    },
  };

  /**
   * Timer 3 mode - temporary high speed for predefined duration
   * @type {Object}
   * @readonly
   */
  static TIMER3 = {
    id: 'timer3',
    title: {
      en: 'Timer 3',
      nl: 'Timer 3',
      de: 'Timer 3',
      fr: 'Minuteur 3',
      it: 'Timer 3',
      sv: 'Timer 3',
      no: 'Timer 3',
      es: 'Temporizador 3',
      da: 'Timer 3',
      ru: 'Таймер 3',
      pl: 'Timer 3',
      ko: '타이머 3',
    },
  };

  /**
   * Join mode - activate ventilation when joining/arriving
   * @type {Object}
   * @readonly
   */
  static JOIN = {
    id: 'join',
    title: {
      en: 'Join',
      nl: 'Deelnemen',
      de: 'Beitreten',
      fr: 'Rejoindre',
      it: 'Unisciti',
      sv: 'Gå med',
      no: 'Bli med',
      es: 'Unirse',
      da: 'Deltag',
      ru: 'Присоединиться',
      pl: 'Dołącz',
      ko: '참여',
    },
  };

  /**
   * Leave mode - reduce ventilation when leaving
   * @type {Object}
   * @readonly
   */
  static LEAVE = {
    id: 'leave',
    title: {
      en: 'Leave',
      nl: 'Verlaten',
      de: 'Verlassen',
      fr: 'Quitter',
      it: 'Lasciare',
      sv: 'Lämna',
      no: 'Forlatte',
      es: 'Salir',
      da: 'Forlad',
      ru: 'Покинуть',
      pl: 'Opuść',
      ko: '떠나다',
    },
  };

  /**
   * Motion detected mode - activate ventilation on motion detection
   * @type {Object}
   * @readonly
   */
  static MOTION_ON = {
    id: 'motion_on',
    title: {
      en: 'Motion On',
      nl: 'Beweging Aan',
      de: 'Bewegung An',
      fr: 'Mouvement Activé',
      it: 'Movimento Attivo',
      sv: 'Rörelse På',
      no: 'Bevegelse På',
      es: 'Movimiento Activado',
      da: 'Bevægelse Til',
      ru: 'Движение Вкл',
      pl: 'Ruch Włączony',
      ko: '모션 켜기',
    },
  };

  /**
   * No motion mode - reduce ventilation when no motion detected
   * @type {Object}
   * @readonly
   */
  static MOTION_OFF = {
    id: 'motion_off',
    title: {
      en: 'Motion Off',
      nl: 'Beweging Uit',
      de: 'Bewegung Aus',
      fr: 'Mouvement Désactivé',
      it: 'Movimento Disattivato',
      sv: 'Rörelse Av',
      no: 'Bevegelse Av',
      es: 'Movimiento Desactivado',
      da: 'Bevægelse Fra',
      ru: 'Движение Выкл',
      pl: 'Ruch Wyłączony',
      ko: '모션 끄기',
    },
  };

  /**
   * Cooking mode - 30 minutes high ventilation
   * @type {Object}
   * @readonly
   */
  static COOK30 = {
    id: 'cook30',
    title: {
      en: 'Cook 30',
      nl: 'Koken 30',
      de: 'Kochen 30',
      fr: 'Cuisson 30',
      it: 'Cucina 30',
      sv: 'Koka 30',
      no: 'Kok 30',
      es: 'Cocinar 30',
      da: 'Kog 30',
      ru: 'Готовка 30',
      pl: 'Gotowanie 30',
      ko: '요리 30',
    },
  };

  /**
   * Cooking mode - 60 minutes high ventilation
   * @type {Object}
   * @readonly
   */
  static COOK60 = {
    id: 'cook60',
    title: {
      en: 'Cook 60',
      nl: 'Koken 60',
      de: 'Kochen 60',
      fr: 'Cuisson 60',
      it: 'Cucina 60',
      sv: 'Koka 60',
      no: 'Kok 60',
      es: 'Cocinar 60',
      da: 'Kog 60',
      ru: 'Готовка 60',
      pl: 'Gotowanie 60',
      ko: '요리 60',
    },
  };
}

module.exports = VirtualRemoteModes;
