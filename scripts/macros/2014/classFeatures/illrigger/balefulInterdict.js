import {activityUtils, actorUtils, dialogUtils, effectUtils, genericUtils, itemUtils, socketUtils, tokenUtils, workflowUtils} from '../../../../utils.js';
async function damaged({trigger, workflow}) {
    if (!workflow.targets.size || !workflow.damageRolls.length) return;
    let identifer = genericUtils.getIdentifier(workflow.item);
    if (identifer === 'balefulInterdict') return;
    let effectCounts = [];
    for (let token of workflow.hitTargets) {
        let effects = effectUtils.getAllEffectsByIdentifier(token.actor, 'balefulInterdictEffect');
        if (!effects.length) continue;
        for (let effect of effects) {
            let originItem = await effectUtils.getOriginItem(effect);
            if (!originItem) continue;
            if (effectUtils.getEffectByStatusID(originItem.actor, 'incapacitated')) continue;
            let firstToken = actorUtils.getFirstToken(originItem.actor);
            if (!firstToken) continue;
            let canSee = tokenUtils.canSee(firstToken, token);
            if (!canSee) continue;
            let distance = tokenUtils.getDistance(firstToken, token);
            let combatMasteryUnfettered = itemUtils.getItemByIdentifier(token.actor, 'combatMasteryUnfettered');
            let maxDistance = combatMasteryUnfettered ? 60 : 30;
            if (distance > maxDistance) continue;
            let effectCount = effectCounts.find(i => i.originItem === originItem);
            if (!effectCount) {
                effectCounts.push({
                    originItem,
                    count: 1,
                    target: token
                });
            } else {
                effectCount.count += 1;
            }
        }
    }
    if (!effectCounts.length) return;
    for (let i of effectCounts) {
        let selection = await dialogUtils.selectTargetDialog('CHRISPREMADES.Macros.BalefulInterdict.BurningSeals', 'CHRISPREMADES.Macros.BalefulInterdict.BurnSeals', [i.target], {type: 'selectAmount', maxAmount: i.count, skipDeadAndUnconscious: false, userId: socketUtils.firstOwner(i.originItem, true), buttons: 'yesNo'});
        if (!selection?.[0]?.[0]?.value) continue;
        let burnFire = activityUtils.getActivityByIdentifier(i.originItem, 'burnFire', {strict: true});
        let burnNecrotic = activityUtils.getActivityByIdentifier(i.originItem, 'burnNecrotic', {strict: true});
        if (!burnFire || !burnNecrotic) continue;
        let activitySelection = await dialogUtils.selectDocumentDialog(i.originItem.name, undefined, [burnFire, burnNecrotic], {userId: socketUtils.firstOwner(i.originItem, true)});
        if (!activitySelection) continue;
        let activityData = genericUtils.duplicate(activitySelection.toObject());
        let classIdentifier = itemUtils.getConfig(i.originItem, 'classIdentifier');
        let damageScaleIdentifier = itemUtils.getConfig(i.originItem, 'damageScaleIdentifier');
        let scale = workflow.actor.system.scale[classIdentifier]?.[damageScaleIdentifier];
        if (!scale) continue;
        let diceNumber = Number(selection[0][0].value) * scale.number;
        activityData.damage.parts[0].bonus = diceNumber + scale.die;
        await workflowUtils.syntheticActivityDataRoll(activityData, i.originItem, i.originItem.actor, [i.target]);
        let effects = effectUtils.getAllEffectsByIdentifier(i.target.actor, 'balefulInterdictEffect');
        for (let j = 0; j < i.count; j++) await genericUtils.remove(effects[j]);
    }
}
async function distance({trigger, workflow}) {
    let combatMasteryUnfettered = itemUtils.getItemByIdentifier(workflow.actor, 'combatMasteryUnfettered');
    let maxDistance = combatMasteryUnfettered ? 60 : 30;
    if (tokenUtils.getDistance(workflow.token, workflow.targets.first()) <= maxDistance) return;
    workflow.aborted = true;
    genericUtils.notify('CHRISPREMADES.Macros.BalefulInterdict.Move.TooFar', 'info', {localize: true});
}
async function attackHelper(item, workflow) {
    if (!workflow.hitTargets.size || !item.system.uses.value || !workflowUtils.isAttackType(workflow, 'weaponAttack')) return;
    let selection = await dialogUtils.confirm(item.name, 'CHRISPREMADES.Macros.BalefulInterdict.PlaceSeal');
    if (!selection) return;
    let activity = activityUtils.getActivityByIdentifier(item, 'placeSeal', {strict: true});
    if (!activity) return;
    await workflowUtils.specialItemUse(item, [workflow.targets.first()], workflow.item, {activity, consumeResources: true, consumeUsage: true});
}
async function attack({trigger: {entity: item}, workflow}) {
    let canTriggerImmediately = itemUtils.getConfig(item, 'canTriggerImmediately');
    if (canTriggerImmediately) return;
    await attackHelper(item, workflow);
}
async function attackAlt({trigger: {entity: item}, workflow}) {
    let canTriggerImmediately = itemUtils.getConfig(item, 'canTriggerImmediately');
    if (!canTriggerImmediately) return;
    await attackHelper(item, workflow);
}
async function added({trigger: {entity: item}}) {
    await itemUtils.fixScales(item);
}
async function move({trigger, workflow}) {
    if (!workflow.token || !workflow.targets.size) return;
    let validTokens = workflow.token.document.parent.tokens.filter(token => {
        if (!token.actor) return;
        let effect = effectUtils.getAllEffectsByIdentifier(token.actor, 'balefulInterdictEffect').find(effect => {
            let originItem = effectUtils.getOriginItemSync(effect);
            if (!originItem) return;
            if (!token.actor.statuses.has('dead') && !token.actor.statuses.has('unconscious')) return;
            if (originItem.actor.uuid === workflow.actor.uuid) return true;
        });
        if (effect) return true;
    }).map(i => i.object);
    if (!validTokens.length) {
        genericUtils.notify('CHRISPREMADES.Macros.BalefulInterdict.Move.NoValidTargets', 'info', {localize: true});
        return;
    }
    let targetToken;
    if (validTokens.length > 1) {
        let selection = await dialogUtils.selectTargetDialog(workflow.item.name, 'CHRISPREMADES.Generic.SelectATarget', validTokens, {skipDeadAndUnconscious: false});
        if (!selection) return;
        targetToken = selection[0];
    } else {
        targetToken = validTokens[0];
    }
    let distance = tokenUtils.getDistance(targetToken, workflow.targets.first());
    if (distance > 30) {
        genericUtils.notify('CHRISPREMADES.Macros.BalefulInterdict.Move.TooFar', 'info', {localize: true});
        return;
    }
    let effects = effectUtils.getAllEffectsByIdentifier(targetToken.actor, 'balefulInterdictEffect').filter(effect => {
        let originItem = effectUtils.getOriginItemSync(effect);
        if (!originItem) return;
        if (originItem.actor.uuid === workflow.actor.uuid) return true;
    });
    if (!effects.length) return;
    let effectDatas = effects.map(effect => {
        let effectData = genericUtils.duplicate(effect.toObject());
        delete effectData._id;
        return effectData;
    });
    await genericUtils.deleteEmbeddedDocuments(targetToken.actor, 'ActiveEffect', effects.map(effect => effect.id));
    await genericUtils.createEmbeddedDocuments(workflow.targets.first().actor, 'ActiveEffect', effectDatas);
}
async function burnSpecial({trigger, workflow}) {
    if (!workflow.targets.size) return;
    let interdictBoonBedevil = itemUtils.getItemByIdentifier(workflow.actor, 'interdictBoonBedevil');
    let interdictSoulEater = itemUtils.getItemByIdentifier(workflow.actor, 'interdictSoulEater');
    let interdictStyxsApathy = itemUtils.getItemByIdentifier(workflow.actor, 'interdictStyxsApathy');
    let interdictUnleashHell = itemUtils.getItemByIdentifier(workflow.actor, 'interdictUnleashHell');
    let documents = [interdictBoonBedevil, interdictSoulEater, interdictStyxsApathy, interdictUnleashHell].filter(i => i).filter(i => {
        if (!i.system.uses.value) return;
        let identifer = genericUtils.getIdentifier(i);
        switch (identifer) {
            case 'interdictStyxsApathy':
                if (actorUtils.hasUsedReaction(i.actor)) return;
        }
        return true;
    });
    if (!documents.length) return;
    let selection = await dialogUtils.selectDocumentDialog('CHRISPREMADES.Macros.InterdictBoons.Name', genericUtils.format('CHRISPREMADES.Dialog.Use', {itemName: genericUtils.translate('CHRISPREMADES.Macros.InterdictBoons.Name')}), documents, {sortAlphabetical: true, userId: socketUtils.firstOwner(workflow.item, true)});
    if (!selection) return;
    await workflowUtils.syntheticItemRoll(selection, [workflow.targets.first()], {consumeResources: true, consumeUsage: true});
    for (let document of documents.filter(i => i.id != selection.id)) await genericUtils.update(document, {'system.uses.spent': document.system.uses.spent + 1});
}
async function burnBonus({trigger, workflow}) {

}
export let balefulInterdict = {
    name: 'Baleful Interdict',
    version: '1.3.65',
    rules: 'legacy',
    midi: {
        item: [
            {
                pass: 'preambleComplete',
                macro: distance,
                priority: 50,
                activities: ['placeSeal']
            },
            {
                pass: 'rollFinished',
                macro: move,
                priority: 50,
                activities: ['move']
            },
            {
                pass: 'rollFinished',
                macro: burnSpecial,
                priority: 50,
                activities: ['burnFire', 'burnNecrotic']
            }
        ],
        actor: [
            {
                pass: 'rollFinishedLate',
                macro: attack,
                priority: 250
            },
            {
                pass: 'rollFinished',
                macro: attackAlt,
                priority: 250
            }
        ]
    },
    item: [
        {
            pass: 'created',
            macro: added,
            priority: 50
        },
        {
            pass: 'itemMedkit',
            macro: added,
            priority: 50
        },
        {
            pass: 'actorMunch',
            macro: added,
            priority: 50
        }
    ],
    config: [
        {
            value: 'classIdentifier',
            label: 'CHRISPREMADES.Config.ClassIdentifier',
            type: 'text',
            default: 'illrigger',
            category: 'homebrew',
            homebrew: true
        },
        {
            value: 'scaleIdentifier',
            label: 'CHRISPREMADES.Config.ScaleIdentifier',
            type: 'text',
            default: 'baleful-interdict',
            category: 'homebrew',
            homebrew: true
        },
        {
            value: 'damageScaleIdentifier',
            label: 'CHRISPREMADES.Config.DamageScaleIdentifier',
            type: 'text',
            default: 'baleful-interdict-damage',
            category: 'homebrew',
            homebrew: true
        },
        {
            value: 'canTriggerImmediately',
            label: 'CHRISPREMADES.Macros.BalefulInterdict.CanTriggerImmediately',
            type: 'checkbox',
            default: true,
            category: 'homebrew',
            homebrew: true
        }
    ],
    scales: [
        {
            classIdentifier: 'classIdentifier',
            scaleIdentifier: 'damageScaleIdentifier',
            data: {
                type: 'ScaleValue',
                configuration: {
                    identifier: 'baleful-interdict-damage',
                    type: 'dice',
                    distance: {
                        units: ''
                    },
                    scale: {
                        1: {
                            number: 1,
                            faces: 6,
                            modifiers: []
                        },
                        5: {
                            number: 2,
                            faces: 6,
                            modifiers: []
                        },
                        11: {
                            number: 3,
                            faces: 6,
                            modifiers: []
                        },
                        20: {
                            number: 4,
                            faces: 6,
                            modifiers: []
                        }
                    }
                },
                value: {},
                title: 'Baleful Interdict Damage',
                hint: ''
            }
        },
        {
            classIdentifier: 'classIdentifier',
            scaleIdentifier: 'scaleIdentifier',
            data: {
                type: 'ScaleValue',
                configuration: {
                    identifier: 'baleful-interdict',
                    type: 'number',
                    distance: {
                        units: ''
                    },
                    scale: {
                        1: {
                            value: 3
                        },
                        3: {
                            value: 4
                        },
                        7: {
                            value: 5
                        },
                        13: {
                            value: 6
                        },
                        18: {
                            value: 7
                        }
                    }
                },
                value: {},
                title: 'Baleful Interdict'
            }
        }
    ]
};
export let balefulInterdictEffect = {
    name: 'Baleful Interdict: Effect',
    version: balefulInterdict.version,
    rules: balefulInterdict.rules,
    midi: {
        actor: [
            {
                pass: 'targetRollFinished',
                priority: 250,
                macro: damaged
            }
        ]
    }
};