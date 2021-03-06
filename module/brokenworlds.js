/**
 * A simple and flexible system for world-building using an arbitrary collection of character and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 * Modified by Quileggen
 */

// Import Modules
import { BW } from "./config.js";
import { BwClassList } from "./config.js";
import { ActorBw } from "./actor/actor.js";
import { ItemBw } from "./item/item.js";
import { BwItemSheet } from "./item/item-sheet.js";
import { BwActorSheet } from "./actor/actor-sheet.js";
import { BwActorNpcSheet } from "./actor/actor-npc-sheet.js";
import { BwClassItemSheet } from "./item/class-item-sheet.js";
import { BwRegisterHelpers } from "./handlebars.js";
import { BwUtility } from "./utility.js";
import { CombatSidebarBw } from "./combat/combat.js";
import { MigrateBw } from "./migrate/migrate.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`Initializing Broken Worlds!`);

  game.brokenworlds = {
    ActorBw,
    ItemBw,
    rollItemMacro,
    BwUtility,
    MigrateBw,
  };

  // TODO: Extend the combat class.
  // CONFIG.Combat.entityClass = CombatDw;

  CONFIG.BW = BW;
  CONFIG.Actor.entityClass = ActorBw;
  CONFIG.Item.entityClass = ItemBw;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("brokenworlds", BwActorSheet, {
    types: ['character'],
    makeDefault: true
  });
  Actors.registerSheet("brokenworlds", BwActorNpcSheet, {
    types: ['npc'],
    makeDefault: true
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("brokenworlds", BwItemSheet, { makeDefault: false });
  Items.registerSheet("brokenworlds", BwClassItemSheet, {
    types: ['class'],
    makeDefault: true
  });

  BwRegisterHelpers.init();

  let combatBw = new CombatSidebarBw();
  combatBw.startup();

  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("brokenworlds", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  // Configurable system settings.
  game.settings.register("brokenworlds", "itemIcons", {
    name: game.i18n.localize("BW.Settings.itemIcons.name"),
    hint: game.i18n.localize("BW.Settings.itemIcons.hint"),
    scope: 'client',
    config: true,
    type: Boolean,
    default: true
  });

  BwUtility.replaceRollData();
});

Hooks.once("ready", async function() {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createBwMacro(data, slot));

  BW.classlist = await BwClassList.getClasses();
  CONFIG.BW = BW;

  // Add a lang class to the body.
  const lang = game.settings.get('core', 'language');
  $('html').addClass(`lang-${lang}`);

  // Run migrations.
  MigrateBw.runMigration();
});

Hooks.on('renderChatMessage', (data, html, options) => {
  // Determine visibility.
  let chatData = data.data;
  const whisper = chatData.whisper || [];
  const isBlind = whisper.length && chatData.blind;
  const isVisible = (whisper.length) ? game.user.isGM || whisper.includes(game.user._id) || (!isBlind) : true;
  if (!isVisible) {
    html.find('.dice-formula').text('???');
    html.find('.dice-total').text('?');
    html.find('.dice-tooltip').remove();
  }
});

/* -------------------------------------------- */
/*  Foundry VTT Setup                           */
/* -------------------------------------------- */

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function() {

  // Localize CONFIG objects once up-front
  const toLocalize = [
    "abilities"
  ];
  for (let o of toLocalize) {
    CONFIG.BW[o] = Object.entries(CONFIG.BW[o]).reduce((obj, e) => {
      obj[e[0]] = game.i18n.localize(e[1]);
      return obj;
    }, {});
  }
});

/* -------------------------------------------- */
/*  Actor Updates                               */
/* -------------------------------------------- */
Hooks.on('createActor', async (actor, options, id) => {
  // Allow the character to levelup up when their level changes.
  if (actor.data.type == 'character') {
    actor.setFlag('brokenworlds', 'levelup', true);

    // Get the item moves as the priority.
    let moves = game.items.entities.filter(i => i.type == 'move' && i.data.data.moveType == 'basic');
    let pack = game.packs.get(`brokenworlds.basic-moves`);
    let compendium = pack ? await pack.getContent() : [];
    const actorMoves = actor.data.items.filter(i => i.type == 'move');
    // Get the compendium moves next.
    let moves_compendium = compendium.filter(m => {
      const notTaken = actorMoves.filter(i => i.name == m.data.name);
      return notTaken.length < 1;
    });
    // Append compendium moves to the item moves.
    let moves_list = moves.map(m => {
      return m.data.name;
    })
    for (let move of moves_compendium) {
      if (!moves_list.includes(move.data.name)) {
        moves.push(move);
        moves_list.push(move.data.name);
      }
    }

    // Sort the moves and build our groups.
    moves.sort((a, b) => {
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

    // Add to the actor.
    const movesToAdd = moves.map(m => duplicate(m));
    await actor.createEmbeddedEntity('OwnedItem', movesToAdd);
    await actor.update({ 'data.details.look': game.i18n.localize("BW.DefaultLook") });
  }
});

Hooks.on('preUpdateActor', (actor, data, options, id) => {
  if (actor.data.type == 'character') {
    // Allow the character to levelup up when their level changes.
    if (data.data && data.data.attributes && data.data.attributes.level) {
      if (data.data.attributes.level.value > actor.data.data.attributes.level.value) {
        actor.setFlag('brokenworlds', 'levelup', true);
      }
    }
  }
});

/* -------------------------------------------- */
/*  Level Up Listeners                          */
/* -------------------------------------------- */
Hooks.on('renderDialog', (dialog, html, options) => {
  // If this is the levelup dialog, we need to add listeners to it.
  if (dialog.data.id && dialog.data.id == 'level-up') {
    // If an ability score is chosen, we need to update the available options.
    html.find('.cell--ability-scores select').on('change', () => {
      // Build the list of selected score values.
      let scores = [];
      html.find('.cell--ability-scores select').each((index, item) => {
        let $self = $(item);
        if ($self.val()) {
          scores.push($self.val());
        }
      });
      // Loop over the list again, disabling invalid options.
      html.find('.cell--ability-scores select').each((index, item) => {
        let $self = $(item);
        // Loop over the options in the select.
        $self.find('option').each((opt_index, opt_item) => {
          let $opt = $(opt_item);
          let val = $opt.attr('value');
          if (val) {
            if (scores.includes(val) && $self.val() != val) {
              $opt.attr('disabled', true);
            }
            else {
              $opt.attr('disabled', false);
            }
          }
        });
      });
    })
  }
  // console.log(html.find('.cell--ability-scores'));
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createBwMacro(data, slot) {
  if (data.type !== "Item") return;
  if (!("data" in data)) return ui.notifications.warn("You can only create macro buttons for owned Items");
  const item = data.data;

  // Create the macro command
  const command = `game.brokenworlds.rollItemMacro("${item.name}");`;
  let macro = game.macros.entities.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "brokenworlds.itemMacro": true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  const item = actor ? actor.items.find(i => i.name === itemName) : null;
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  // if ( item.data.type === "spell" ) return actor.useSpell(item);
  return item.roll();
}