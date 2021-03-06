// import { BwUtility } from '../utility.js';

/**
 * Extends the basic Actor class for Broken Worlds
 * @extends {Actor}
 */
export class ActorBw extends Actor {
  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    const actorData = this.data;
    const data = actorData.data;
    const flags = actorData.flags;

    if (actorData.type === 'character') this._prepareCharacterData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    const data = actorData.data;

    // Ability Scores
    for (let [a, abl] of Object.entries(data.abilities)) {
      // TODO: This is a possible formula, but would require limits on the
      // upper and lower ends.
      // abl.mod = Math.floor(abl.value * 0.4 - (abl.value < 11 ? 3.4 : 4.2));

      // Ability modifiers.
      // abl.mod = BwUtility.getAbilityMod(abl.value);
      abl.mod = abl.value
      // Add labels.
      abl.label = CONFIG.BW.abilities[a];
    }
  }

  /**
   * Listen for click events on rollables.
   * @param {MouseEvent} event
   */
  async _onRoll(event, actor = null) {
    actor = !actor ? this.actor : actor;

    // Initialize variables.
    event.preventDefault();

    if (!actor.data) {
      return;
    }

    const a = event.currentTarget;
    const data = a.dataset;
    const actorData = actor.data.data;
    const itemId = $(a).parents('.item').attr('data-item-id');
    const item = actor.getOwnedItem(itemId);
    let formula = null;
    let titleText = null;
    let flavorText = null;
    let templateData = {};

    // Handle rolls coming directly from the ability score.
    if ($(a).hasClass('ability-rollable') && data.mod) {
      formula = `2d6+${data.mod}`;
      flavorText = data.label;
      if (data.debility) {
        flavorText += ` (${data.debility})`;
      }

      templateData = {
        title: flavorText
      };

      this.rollMove(formula, actor, data, templateData);
    }
    else if ($(a).hasClass('damage-rollable') && data.roll) {
      formula = data.roll;
      titleText = data.label;
      flavorText = data.flavor;
      templateData = {
        title: titleText,
        flavor: flavorText
      };

      this.rollMove(formula, actor, data, templateData, null, true);
    }
    else if (itemId != undefined) {
      item.roll();
    }
  }

  /**
   * Roll a move and use the chat card template.
   * @param {Object} templateData
   */
  rollMove(roll, actor, dataset, templateData, form = null, applyDamage = false) {
    let actorData = actor.data.data;
    // Render the roll.
    let template = 'systems/brokenworlds/templates/chat/chat-move.html';
    // GM rolls.
    let chatData = {
      user: game.user._id,
      speaker: ChatMessage.getSpeaker({ actor: actor })
    };
    let rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user._id];
    if (rollMode === "blindroll") chatData["blind"] = true;
    // Handle dice rolls.
    if (roll) {
      // Roll can be either a formula like `2d6+3` or a raw stat like `str`.
      let formula = '';
      // Handle bond (user input).
      if (roll.match(/(\d*)d\d+/g)) {
        formula = roll;
      }
      // Handle moves.
      else {
        formula = `2d6+${actorData.abilities[roll].mod}`;
        if (dataset.mod && dataset.mod != 0) {
          formula += `+${dataset.mod}`;
        }
      }
      if (formula != null) {
        // Do the roll.
        let roll = new Roll(`${formula}`, actor.getRollData());
        roll.roll();
        // Add success notification.
        if (formula.includes('2d6')) {
          if (roll.total < 7) {
            templateData.result = 'failure';
          }
          else if (roll.total > 6 && roll.total < 10) {
            templateData.result = 'partial';
          }
          else {
            templateData.result = 'success';
          }
        }
        // Render it.
        roll.render().then(r => {
          templateData.rollDw = r;
          renderTemplate(template, templateData).then(content => {
            chatData.content = content;
            if (game.dice3d) {
              game.dice3d.showForRoll(roll, game.user, true, chatData.whisper, chatData.blind).then(displayed => ChatMessage.create(chatData));
            }
            else {
              chatData.sound = CONFIG.sounds.dice;
              ChatMessage.create(chatData);
            }
            // Deal damage to targets.
            // if (applyDamage) {
            //   console.log(game.user.targets);
            // }
          });
        });
      }
    }
    else {
      renderTemplate(template, templateData).then(content => {
        chatData.content = content;
        ChatMessage.create(chatData);
      });
    }
  }
}