import {DialogApp} from '../applications/dialog.js';
import {constants, genericUtils} from '../utils.js';
function removeCompendiums(directory) {
    // eslint-disable-next-line no-undef
    if (!(directory instanceof foundry.applications.sidebar.tabs.CompendiumDirectory)) return;
    let html = directory.element;
    let ol = html.querySelectorAll('ol.directory-list');
    let lis = Object.values(ol).flatMap(i => Object.values(i.querySelectorAll('li')));
    let hiddenCompendiums = genericUtils.getCPRSetting('hiddenCompendiums');
    let hiddenCompendiumFolders = genericUtils.getCPRSetting('hiddenCompendiumFolders');
    Object.values(lis).filter(i => i.localName === 'li').forEach(element => {
        let pack = element.dataset.pack;
        let folderId = element.dataset.folderId;
        if (!pack && !folderId) return;
        if (pack) {
            if (!genericUtils.getCPRSetting('devTools')) {
                if (Object.values(constants.featurePacks).includes(pack)) {
                    element.remove();
                    return;
                }
            }
            if (hiddenCompendiums.includes(pack)) element.remove();
            return;
        } else if (folderId) {
            if (hiddenCompendiumFolders.includes(folderId)) element.remove();
            return;
        }
    });
}
async function selectHiddenCompendiums() {
    let oldSettings = genericUtils.getCPRSetting('hiddenCompendiums');
    let menuSettings = genericUtils.getCPRSetting('hiddenCompendiumFolders');
    let packs = game.packs.filter(i => {
        let folder = i.folder;
        while (folder) {
            if (menuSettings.includes(folder.id)) return false;
            folder = folder.folder;
        }
        return true;
    });
    let inputs = packs.filter(j => !Object.values(constants.featurePacks).includes(j.metadata.id)).map(i => ({label: i.metadata.label, name: i.metadata.id.replaceAll('.', '|PERIOD|'), options: {isChecked: oldSettings.includes(i.metadata.id)}}));
    let selection = await DialogApp.dialog('CHRISPREMADES.Settings.hiddenCompendiums.Name', 'CHRISPREMADES.Settings.hiddenCompendiums.Hint', [['checkbox', inputs, {displayAsRows: true}]], 'okCancel', {id: 'cpr-hidden-compendiums',height: 800});
    if (!selection?.buttons) return;
    delete selection.buttons;
    let newSettings = Object.entries(selection).filter(i => i[1]).map(j => j[0].replaceAll('|PERIOD|', '.'));
    await game.settings.set('chris-premades', 'hiddenCompendiums', newSettings);
}
async function selectHiddenCompendiumFolders() {
    let oldSettings = genericUtils.getCPRSetting('hiddenCompendiumFolders');
    let inputs = game.folders.filter(i => i.type === 'Compendium').map(i => ({label: i.name, name: i.id, options: {isChecked: oldSettings.includes(i.id)}}));
    let selection = await DialogApp.dialog('CHRISPREMADES.Settings.hiddenCompendiumFolders.Name', 'CHRISPREMADES.Settings.hiddenCompendiumFolders.Hint', [['checkbox', inputs, {displayAsRows: true}]], 'okCancel', {id: 'cpr-hidden-compendium-folders'});
    if (!selection?.buttons) return;
    delete selection.buttons;
    let newSettings = Object.entries(selection).filter(i => i[1]).map(j => j[0]);
    await game.settings.set('chris-premades', 'hiddenCompendiumFolders', newSettings);
}
export let sidebar = {
    removeCompendiums,
    selectHiddenCompendiums,
    selectHiddenCompendiumFolders
};