export const BW = {};

BW.abilities = {
  "body": "BW.AbilityBody",
  "reflex": "BW.AbilityReflex",
  "heat": "BW.AbilityHeat",
  "breath": "BW.AbilityBreath",
  "mind": "BW.AbilityMind",
};

export class BwClassList {
  static async getClasses(labels_only = true) {
    // First, retrieve any custom or overridden classes so that we can
    // prioritize those.
    let classes = game.items.entities.filter(item => item.type == 'class');
    // Next, retrieve compendium classes and merge them in.
    for (let c of game.packs) {
      if (c.metadata.entity && c.metadata.entity == 'Item' && c.metadata.name == 'classes') {
        let items = c ? await c.getContent() : [];
        classes = classes.concat(items);
      }
    }
    // Reduce duplicates. Because item classes happen first, this will prevent
    // duplicate compendium entries from overriding the items.
    let charClassNames = [];
    for (let charClass of classes) {
      let charClassName = charClass.data.name;
      if (charClassNames.includes(charClassName) !== false) {
        classes = classes.filter(item => item._id != charClass._id);
      }
      else {
        charClassNames.push(charClassName);
      }
    }

    // Sort the charClassNames list.
    if (labels_only) {
      charClassNames.sort((a, b) => {
        const aSort = a.toLowerCase();
        const bSort = b.toLowerCase();
        if (aSort < bSort) {
          return -1;
        }
        if (aSort > bSort) {
          return 1;
        }
        return 0;
      });

      return charClassNames;
    }
    // Sort the class objects list.
    else {
      classes.sort((a, b) => {
        const aSort = a.data.name.toLowerCase();
        const bSort = b.data.name.toLowerCase();
        if (aSort < bSort) {
          return -1;
        }
        if (aSort > bSort) {
          return 1;
        }
        return 0;
      });

      return classes;
    }
  }
}