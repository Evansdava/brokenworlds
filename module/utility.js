export class BwUtility {
  static cleanClass(string) {
    // Lower case everything
    string = string.toLowerCase();
    // Make alphanumeric (removes all other characters)
    string = string.replace(/[^a-z0-9\s]/g, "");
    // Convert whitespaces and underscore to dash
    string = string.replace(/[\s\_]/g, "-");
    // Clean up multiple dashes or whitespaces
    string = string.replace(/[\s\-]+/g, "-");
    return string;
  };

  static isEmpty(arg) {
    return [null, false, undefined, 0, ''].includes(arg);
  }

  static async getEquipment(update = false) {
    if (typeof game.items == 'undefined') {
      return false;
    }

    // Cache results.
    if (game.brokenworlds.equipment && !update) {
      return game.brokenworlds.equipment;
    }

    // Load new results.
    let items = game.items.filter(i => i.type == 'equipment');
    for (let pack of game.packs) {
      if (pack.metadata.name.includes('equipment')) {
        if (pack) {
          items = items.concat(await pack.getContent());
        }
      }
    }

    game.brokenworlds.equipment = items;

    return items;
  }

  static getAbilityMod(abilityScore) {
    return abilityScore
  }

  static getProgressCircle({ current = 100, max = 100, radius = 16 }) {
    let circumference = radius * 2 * Math.PI;
    let percent = current < max ? current / max : 1;
    let percentNumber = percent * 100;
    let offset = circumference - (percent * circumference);
    let strokeWidth = 4;
    let diameter = (radius * 2) + strokeWidth;
    let colorClass = Math.round((percent * 100) / 10) * 10;

    return {
      radius: radius,
      diameter: diameter,
      strokeWidth: strokeWidth,
      circumference: circumference,
      offset: offset,
      position: diameter / 2,
      color: 'red',
      class: colorClass,
    };
  }

  static replaceRollData() {
    /**
     * Override the default getRollData() method to add abbreviations for the
     * abilities and attributes properties.
     */
    const original = Actor.prototype.getRollData;
    Actor.prototype.getRollData = function() {
      // Use the actor by default.
      let actor = this;

      // Use the current token if possible.
      let token = canvas.tokens.controlled.find(t => t.actor.data._id == this.data._id);
      if (token) {
        actor = token.actor;
      }

      const data = original.call(actor);

      // Re-map all attributes onto the base roll data
      let newData = mergeObject(data.attributes, data.abilities);
      delete data.init;
      for (let [k, v] of Object.entries(newData)) {
        switch (k) {
          // case 'level':
          //   data.lvl = v.value;
          //   break;

          default:
            if (!(k in data)) {
              v.val = v.value;
              delete v.value;
              data[k] = v;
            }
            break;
        }
      }

      // Old syntax shorthand.
      data.attr = data.attributes;
      data.abil = data.abilities;
      return data;
    };
  }
}